"""
Training loop.

Run the sanity check FIRST, before any real training:

    python -m src.train --overfit 100

That trains on a fixed set of 100 samples. The loss must fall close to zero
and rmse_anom must go well below 0.1. If it does not, the model is wired
wrong, and finding that out now costs two minutes instead of six hours.

Then the real run:

    python -m src.train --epochs 40

Splitting: by TIME, never randomly. Consecutive days are near-identical
ocean states, so a random split puts the test set inside the training set
and reports a beautiful fictional error. With real data pass explicit
dates; with the synthetic data the default fractional split is fine.
"""

import argparse
import json
import os
import time

import numpy as np
import torch
from torch.utils.data import DataLoader

from src.common.grid import DEPTHS, NCHAN
from src.datasets.patch_dataset import PatchProfileDataset
from src.losses.crps import HaloclineLoss
from src.models.depth_field import DepthField, Halocline
from src.models.encoder import SurfaceEncoder, build_cond, count_params


def time_bounds(processed_dir):
    """Read the time axis so we can split without hard-coding dates."""
    import xarray as xr

    with xr.open_zarr(f"{processed_dir}/surface.zarr") as ds:
        t = ds["time"].values
    return t[0], t[-1]


def fractional_split(processed_dir, frac=0.8):
    """First `frac` of the record for training, the rest for validation."""
    import xarray as xr

    with xr.open_zarr(f"{processed_dir}/surface.zarr") as ds:
        t = ds["time"].values
    cut = t[int(len(t) * frac)]
    return slice(None, cut), slice(cut, None)


def forward_with_curvature(model, x, cond, z, want_curvature):
    """
    One encoder pass, reused for both the prediction and the depth
    derivative. Calling model.curvature() separately would run the encoder
    twice for no reason.
    """
    emb = model.encoder(x, cond)

    if not want_curvature:
        return model.depth_field(emb, z), None

    z = z.clone().requires_grad_(True)
    pred = model.depth_field(emb, z)
    g = torch.autograd.grad(pred["t_mean"].sum(), z, create_graph=True)[0]
    gg = torch.autograd.grad(g.sum(), z, create_graph=True)[0]
    return pred, gg


def run_epoch(model, loader, loss_fn, device, opt=None, w_smooth=0.0, clip=1.0):
    train = opt is not None
    model.train(train)
    totals, n = {}, 0

    for batch in loader:
        x = batch["x"].to(device)
        y = batch["y"].to(device)
        mask = batch["mask"].to(device)
        meta = batch["meta"].to(device)
        doy = batch["doy"].to(device)
        z = batch["z"].to(device)

        cond = build_cond(meta, doy)
        want_curv = w_smooth > 0

        with torch.set_grad_enabled(train or want_curv):
            pred, curv = forward_with_curvature(model, x, cond, z, want_curv)
            loss, parts = loss_fn(pred, {"y": y, "mask": mask}, curv)

        if train:
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), clip)
            opt.step()

        b = x.shape[0]
        n += b
        for k, v in parts.items():
            totals[k] = totals.get(k, 0.0) + float(v) * b

    return {k: v / max(n, 1) for k, v in totals.items()}


def fmt(d):
    return "  ".join(f"{k}={v:.4f}" for k, v in d.items() if k != "total")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed")
    ap.add_argument("--out", default="runs/default")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=128)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--samples-per-epoch", type=int, default=20000)
    ap.add_argument("--val-samples", type=int, default=4000)
    ap.add_argument("--w-smooth", type=float, default=0.05)
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--patience", type=int, default=8)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument(
        "--overfit",
        type=int,
        default=0,
        help="sanity check: train on this many fixed samples and watch the loss collapse",
    )
    args = ap.parse_args()

    # The sanity check needs its own settings: one batch per epoch means very
    # few gradient steps, and a cosine schedule decaying to zero over a short
    # run will stall it long before it has had a chance to fit anything.
    if args.overfit:
        if args.epochs == 40:
            args.epochs = 400
        if args.lr == 3e-4:
            args.lr = 1e-3
        args.w_smooth = 0.0      # test capacity first; regularise later

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    os.makedirs(args.out, exist_ok=True)

    # ------------------------------------------------------------------
    # data
    # ------------------------------------------------------------------
    if args.overfit:
        train_ds = PatchProfileDataset(
            args.data,
            samples_per_epoch=args.overfit,
            deterministic=True,
            seed=args.seed,
        )
        val_ds = train_ds          # the point is to memorise, so this is fine
        args.batch_size = min(args.batch_size, args.overfit)
    else:
        tr_slice, va_slice = fractional_split(args.data)
        train_ds = PatchProfileDataset(
            args.data,
            time_slice=tr_slice,
            samples_per_epoch=args.samples_per_epoch,
            seed=args.seed,
        )
        val_ds = PatchProfileDataset(
            args.data,
            time_slice=va_slice,
            samples_per_epoch=args.val_samples,
            deterministic=True,
            seed=999,
        )
        print(f"  train days {train_ds.ntime}   val days {val_ds.ntime}")

    train_dl = DataLoader(
        train_ds, batch_size=args.batch_size, num_workers=args.workers, drop_last=True
    )
    val_dl = DataLoader(val_ds, batch_size=args.batch_size, num_workers=args.workers)

    # ------------------------------------------------------------------
    # model
    # ------------------------------------------------------------------
    model = Halocline(SurfaceEncoder(in_ch=NCHAN), DepthField()).to(device)
    loss_fn = HaloclineLoss(w_smooth=args.w_smooth)
    opt = torch.optim.AdamW(
        model.parameters(), lr=args.lr, weight_decay=args.weight_decay
    )
    # constant lr for the sanity check, cosine decay for real training
    sched = (
        torch.optim.lr_scheduler.ConstantLR(opt, factor=1.0, total_iters=1)
        if args.overfit
        else torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    )

    print(f"  device {device}   params {count_params(model):,}")
    if args.overfit:
        print(f"  OVERFIT SANITY CHECK on {args.overfit} fixed samples "
              f"({args.epochs} steps, lr {args.lr}, smoothing off)")
        print("  expect the loss to collapse; if it does not, the model is broken\n")

    # ------------------------------------------------------------------
    # loop
    # ------------------------------------------------------------------
    best, bad, history = float("inf"), 0, []
    for ep in range(1, args.epochs + 1):
        t0 = time.time()
        tr = run_epoch(
            model, train_dl, loss_fn, device, opt=opt, w_smooth=args.w_smooth
        )
        va = run_epoch(model, val_dl, loss_fn, device, w_smooth=0.0)
        sched.step()

        history.append({"epoch": ep, "train": tr, "val": va})
        print(
            f"  ep {ep:3d}  {time.time()-t0:5.1f}s  "
            f"train {fmt(tr)}   |   val crps={va['crps']:.4f} rmse={va['rmse_anom']:.4f}"
        )

        score = va["crps"]
        if score < best - 1e-5:
            best, bad = score, 0
            torch.save(
                {"model": model.state_dict(), "epoch": ep, "val_crps": best},
                os.path.join(args.out, "best.pt"),
            )
        else:
            bad += 1
            if bad >= args.patience and not args.overfit:
                print(f"  early stop at epoch {ep}; best val CRPS {best:.4f}")
                break

    with open(os.path.join(args.out, "history.json"), "w") as f:
        json.dump(history, f, indent=2)

    if args.overfit:
        final = history[-1]["train"]
        print(f"\n  final train rmse_anom {final['rmse_anom']:.4f}")
        if final["rmse_anom"] < 0.15:
            print("  PASS — the model can fit the data. Wiring is correct.")
        else:
            print("  FAIL — the model cannot memorise 100 samples. Something is wrong:")
            print("     check the learning rate, the mask, and that y is not all zeros.")
    else:
        print(f"\n  best val CRPS {best:.4f}   checkpoint {args.out}/best.pt")


if __name__ == "__main__":
    main()