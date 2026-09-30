"""
Export full-field predictions.

This file is the contract with the rest of the team. It runs the model once
over a date range and writes a plain zarr store that the backend reads. The
website never loads PyTorch and never runs the network — except for the
single near-real-time demo panel.

That boundary is what makes the demo fast and crash-proof: the map responds
instantly, it works with the wifi unplugged, and nothing can fail on stage.

RUN THIS EARLY, EVEN WITH A BAD MODEL. B1 and the frontend need the file
format, not good numbers. A week of them building against the real schema
is worth far more than a week of them waiting.

Output:
    predictions.zarr    (time, depth, lat, lon)  t_mean, t_std  in degC
    metrics.json        per-depth skill, written by run_baselines

Run:
    python -m src.export --ckpt runs/long/best.pt --out data/processed/predictions.zarr
"""

import argparse
import os
import time

import numpy as np
import torch
import xarray as xr

from src.common.grid import DEPTHS, LATS, LONS, NCHAN, NDEPTH, NLAT, NLON, SURFACE_VARS
from src.models.depth_field import DepthField, Halocline
from src.models.encoder import SurfaceEncoder, build_cond

PATCH = 32
HALF = PATCH // 2


def load_model(ckpt, device):
    model = Halocline(SurfaceEncoder(in_ch=NCHAN), DepthField()).to(device)
    state = torch.load(ckpt, map_location=device)
    model.load_state_dict(state["model"])
    model.eval()
    return model, state


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--data", default="data/processed")
    ap.add_argument("--out", default="data/processed/predictions.zarr")
    ap.add_argument("--start", default=None, help="ISO date, inclusive")
    ap.add_argument("--end", default=None, help="ISO date, inclusive")
    ap.add_argument("--max-days", type=int, default=0, help="0 = all")
    ap.add_argument("--chunk", type=int, default=2048, help="cells per forward pass")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, state = load_model(args.ckpt, device)
    print(f"  {args.ckpt}  epoch {state.get('epoch')}  device {device}")

    surface = xr.open_zarr(f"{args.data}/surface.zarr")
    clim = xr.open_zarr(f"{args.data}/clim.zarr")
    if args.start or args.end:
        surface = surface.sel(time=slice(args.start, args.end))
    times = surface["time"].values
    if args.max_days:
        times = times[: args.max_days]
        surface = surface.isel(time=slice(0, args.max_days))
    print(f"  {len(times)} days to export")

    # climatology, loaded once
    s_mean = np.stack([clim[f"{v}_mean"].values for v in SURFACE_VARS], axis=1)
    s_std = np.stack([clim[f"{v}_std"].values for v in SURFACE_VARS], axis=0)
    t_mean_c = clim["thetao_mean"].values
    t_std_c = clim["thetao_std"].values
    doy_index = {d: i for i, d in enumerate(clim["dayofyear"].values.astype(int))}

    # every ocean cell is a prediction target; land stays NaN
    ocean = np.isfinite(surface[SURFACE_VARS[0]].isel(time=0).values)
    cells = np.argwhere(ocean)
    print(f"  {len(cells)} ocean cells per day")

    t_out = np.full((len(times), NDEPTH, NLAT, NLON), np.nan, dtype="float32")
    s_out = np.full((len(times), NDEPTH, NLAT, NLON), np.nan, dtype="float32")

    z_row = torch.as_tensor(DEPTHS, device=device)
    lat_t = torch.as_tensor(np.asarray(LATS), device=device)
    lon_t = torch.as_tensor(np.asarray(LONS), device=device)

    t0 = time.time()
    for ti, tstamp in enumerate(times):
        doy = int(surface["time"].dt.dayofyear.values[ti])
        d = doy_index[doy]

        raw = np.stack(
            [surface[v].isel(time=ti).values for v in SURFACE_VARS], axis=0
        ).astype("float32")
        anom = (raw - s_mean[d]) / s_std
        anom = np.nan_to_num(anom, nan=0.0, posinf=0.0, neginf=0.0)
        padded = np.pad(anom, ((0, 0), (HALF, HALF), (HALF, HALF)), mode="edge")

        ang = 2 * np.pi * doy / 365.25
        doy_vec = torch.tensor(
            [np.sin(ang), np.cos(ang)], dtype=torch.float32, device=device
        )

        for c0 in range(0, len(cells), args.chunk):
            sub = cells[c0 : c0 + args.chunk]
            patches = np.stack(
                [padded[:, i : i + PATCH, j : j + PATCH] for i, j in sub]
            )
            x = torch.from_numpy(patches).to(device)

            meta = torch.stack(
                [
                    torch.zeros(len(sub), dtype=torch.long, device=device),
                    torch.as_tensor(sub[:, 0], device=device),
                    torch.as_tensor(sub[:, 1], device=device),
                ],
                dim=1,
            )
            cond = build_cond(meta, doy_vec[None].repeat(len(sub), 1), lat_t, lon_t)
            z = z_row[None].repeat(len(sub), 1)

            with torch.no_grad():
                out = model(x, cond, z)

            mu = out["t_mean"].cpu().numpy()
            sd = out["t_std"].cpu().numpy()
            ii, jj = sub[:, 0], sub[:, 1]

            # back to degrees Celsius. Every reported number is in degC,
            # never in anomaly units.
            t_out[ti, :, ii, jj] = mu * t_std_c[:, ii, jj].T + t_mean_c[d][:, ii, jj].T
            s_out[ti, :, ii, jj] = sd * t_std_c[:, ii, jj].T

        if (ti + 1) % 10 == 0 or ti == len(times) - 1:
            el = time.time() - t0
            print(f"    {ti+1}/{len(times)} days   {el:.0f}s   {el/(ti+1):.1f}s per day")

    # mask depths below the sea floor, using GLORYS as the reference
    with xr.open_zarr(f"{args.data}/glorys.zarr") as g:
        floor = np.isfinite(g["thetao"].isel(time=0).values)
    t_out[:, ~floor] = np.nan
    s_out[:, ~floor] = np.nan

    ds = xr.Dataset(
        {
            "t_mean": (("time", "depth", "lat", "lon"), t_out),
            "t_std": (("time", "depth", "lat", "lon"), s_out),
        },
        coords={"time": times, "depth": DEPTHS, "lat": LATS, "lon": LONS},
        attrs={
            "title": "Halocline subsurface temperature reconstruction",
            "problem_statement": "SIH26066",
            "units": "degC",
            "checkpoint": os.path.basename(args.ckpt),
            "note": "t_std is one standard deviation, not a confidence interval",
        },
    )
    ds["t_mean"].attrs = {"units": "degC", "long_name": "reconstructed temperature"}
    ds["t_std"].attrs = {"units": "degC", "long_name": "predicted uncertainty (1 sigma)"}

    ds.to_zarr(args.out, mode="w")
    print(f"\n  wrote {args.out}")
    print(f"  dims {dict(ds.sizes)}")
    v = ds["t_mean"].isel(time=0).values
    print(f"  surface temperature range {np.nanmin(v[0]):.1f} .. {np.nanmax(v[0]):.1f} degC")
    print(f"  mean uncertainty at 100 m  {np.nanmean(ds['t_std'].isel(depth=7).values):.3f} degC")


if __name__ == "__main__":
    main()