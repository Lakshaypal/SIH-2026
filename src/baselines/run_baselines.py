"""
Baselines, and the comparison table.

The headline number from the neural network means nothing on its own. It
only means something next to these three:

  1. CLIMATOLOGY   guess the seasonal average for that place and day.
                   In anomaly space this is literally predicting zero.
                   This is the bar. Not clearing it means the model
                   contributed nothing.

  2. LINEAR        ridge regression per depth on the centre-cell surface
                   values. Captures the classic result that sea level
                   anomaly is a near-linear proxy for thermocline depth.

  3. GRADIENT BOOSTING  the same features, nonlinear. If the deep model
                   does not beat this, the architecture is not earning
                   its complexity and we should say so.

Showing baselines is a credibility signal. Hiding them tells a jury you
did not test yourself honestly.

Run:
    python -m src.baselines.run_baselines
    python -m src.baselines.run_baselines --ckpt runs/smoke/best.pt
"""

import argparse
import json
import os

import numpy as np
import torch
from torch.utils.data import DataLoader

from src.common.grid import DEPTHS, LATS, LONS, NCHAN
from src.datasets.patch_dataset import PatchProfileDataset
from src.eval.metrics import per_depth, summary, table
from src.train import fractional_split

HALF = 16   # centre index of a 32x32 patch


def collect(ds, batch_size=256, workers=0):
    """
    Pull a dataset into flat arrays.

    Features for the baselines are the centre-cell surface values plus
    position and season — the same information the network gets at the
    centre, minus the spatial context. That difference is precisely what
    the patch encoder is supposed to be buying us.
    """
    dl = DataLoader(ds, batch_size=batch_size, num_workers=workers)
    X, Y, M, META, DOY = [], [], [], [], []

    for b in dl:
        x = b["x"]
        centre = x[:, :, HALF, HALF]                       # (B, C)
        lat = torch.as_tensor(LATS)[b["meta"][:, 1]]
        lon = torch.as_tensor(LONS)[b["meta"][:, 2]]
        feats = torch.cat(
            [centre, b["doy"], lat[:, None] / 30.0, lon[:, None] / 105.0], dim=1
        )
        X.append(feats.numpy())
        Y.append(b["y"].numpy())
        M.append(b["mask"].numpy())
        META.append(b["meta"].numpy())
        DOY.append(b["doy"].numpy())

    return (
        np.concatenate(X),
        np.concatenate(Y),
        np.concatenate(M),
        np.concatenate(META),
        np.concatenate(DOY),
    )


def fit_linear(Xtr, Ytr, Mtr, Xva):
    from sklearn.linear_model import Ridge

    L = Ytr.shape[1]
    out = np.zeros((len(Xva), L))
    for k in range(L):
        m = Mtr[:, k] > 0
        if m.sum() < 50:
            continue
        out[:, k] = Ridge(alpha=1.0).fit(Xtr[m], Ytr[m, k]).predict(Xva)
    return out


def fit_gbm(Xtr, Ytr, Mtr, Xva, max_iter=200):
    from sklearn.ensemble import HistGradientBoostingRegressor

    L = Ytr.shape[1]
    out = np.zeros((len(Xva), L))
    for k in range(L):
        m = Mtr[:, k] > 0
        if m.sum() < 50:
            continue
        g = HistGradientBoostingRegressor(
            max_iter=max_iter, learning_rate=0.08, max_depth=6, random_state=0
        )
        out[:, k] = g.fit(Xtr[m], Ytr[m, k]).predict(Xva)
    return out


def predict_model(ckpt, ds, device="cpu", batch_size=256):
    from src.models.depth_field import DepthField, Halocline
    from src.models.encoder import SurfaceEncoder, build_cond

    model = Halocline(SurfaceEncoder(in_ch=NCHAN), DepthField()).to(device)
    state = torch.load(ckpt, map_location=device)
    model.load_state_dict(state["model"])
    model.eval()
    print(f"  loaded {ckpt} (epoch {state.get('epoch')}, val CRPS {state.get('val_crps'):.4f})")

    dl = DataLoader(ds, batch_size=batch_size)
    preds, stds = [], []
    with torch.no_grad():
        for b in dl:
            cond = build_cond(b["meta"].to(device), b["doy"].to(device))
            out = model(b["x"].to(device), cond, b["z"].to(device))
            preds.append(out["t_mean"].cpu().numpy())
            stds.append(out["t_std"].cpu().numpy())
    return np.concatenate(preds), np.concatenate(stds)


def coverage(pred, std, true, mask, k=1.96):
    """Fraction of observations inside the stated 95% interval."""
    m = mask > 0
    inside = np.abs(pred - true) <= k * std
    return float(inside[m].mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/processed")
    ap.add_argument("--ckpt", default=None, help="optional model checkpoint to include")
    ap.add_argument("--train-samples", type=int, default=8000)
    ap.add_argument("--val-samples", type=int, default=3000)
    ap.add_argument("--out", default="runs/baselines.json")
    args = ap.parse_args()

    tr_slice, va_slice = fractional_split(args.data)
    train_ds = PatchProfileDataset(
        args.data,
        time_slice=tr_slice,
        samples_per_epoch=args.train_samples,
        deterministic=True,
        seed=7,
    )
    val_ds = PatchProfileDataset(
        args.data,
        time_slice=va_slice,
        samples_per_epoch=args.val_samples,
        deterministic=True,
        seed=999,
    )

    print(f"  train {train_ds.ntime} days   val {val_ds.ntime} days")
    print("  collecting features ...")
    Xtr, Ytr, Mtr, _, _ = collect(train_ds)
    Xva, Yva, Mva, _, _ = collect(val_ds)
    print(f"  train {Xtr.shape}   val {Xva.shape}")

    results = {}

    # climatology: zero anomaly by construction
    results["climatology"] = per_depth(np.zeros_like(Yva), Yva, Mva)

    print("  fitting ridge ...")
    results["linear"] = per_depth(fit_linear(Xtr, Ytr, Mtr, Xva), Yva, Mva)

    print("  fitting gradient boosting ...")
    results["gbm"] = per_depth(fit_gbm(Xtr, Ytr, Mtr, Xva), Yva, Mva)

    order = ["climatology", "linear", "gbm"]

    if args.ckpt and os.path.exists(args.ckpt):
        pred, std = predict_model(args.ckpt, val_ds)
        results["halocline"] = per_depth(pred, Yva, Mva)
        order.append("halocline")
        cov = coverage(pred, std, Yva, Mva)
    else:
        cov = None

    print()
    print(table(results, DEPTHS, order))

    print("\n  mean skill over the thermocline (20-200 m)")
    for n in order:
        print(f"    {n:12s} {summary(results[n], DEPTHS):+.3f}")

    if cov is not None:
        print(f"\n  95% interval coverage: {cov:.3f}   (want ~0.95)")
        if cov < 0.85:
            print("    overconfident — the uncertainty is too narrow")
        elif cov > 0.99:
            print("    underconfident — the uncertainty is too wide")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(
            {
                n: {k: np.asarray(v).tolist() for k, v in r.items()}
                for n, r in results.items()
            },
            f,
            indent=2,
        )
    print(f"\n  wrote {args.out}")


if __name__ == "__main__":
    main()