"""
Generate synthetic surface.zarr, glorys.zarr and clim.zarr in the exact
shapes of the real thing, so M1 and M2 can build and test the model,
the losses and the validation harness before D1's download finishes.

This is not noise. It contains a deliberate, learnable surface-to-subsurface
relationship:

    thermocline depth  D = D0 + k * SLA
    T(z) = T_deep + (T_surf - T_deep) * 0.5 * (1 - tanh((z - D) / W))

so sea level anomaly genuinely controls how deep the warm water goes,
exactly as it does in the real ocean. A correct model must recover this.
A broken model will not. That makes this file a unit test for the
architecture, not just a shape placeholder.

It also injects winter temperature inversions in the northern Bay of
Bengal, so the no-monotonicity requirement is exercised from day one.

Run:
    python -m src.data.make_fake_data
"""

import argparse
import os

import numpy as np
import pandas as pd
import xarray as xr

from src.common.grid import (
    DEPTHS,
    LATS,
    LONS,
    NDEPTH,
    NLAT,
    NLON,
    SURFACE_VARS,
)

RNG = np.random.default_rng(20260914)


def _land_mask():
    """Crude land mask: a few blocks so the code meets NaNs like it will in reality."""
    mask = np.zeros((NLAT, NLON), dtype=bool)
    lat2d = np.broadcast_to(LATS[:, None], (NLAT, NLON))
    lon2d = np.broadcast_to(LONS[None, :], (NLAT, NLON))
    # Indian peninsula wedge
    mask |= (lat2d > 8) & (lat2d < 24) & (lon2d > 72) & (lon2d < 80) & (
        lat2d > 8 + 2.0 * (lon2d - 72)
    )
    # Arabian land to the northwest
    mask |= (lat2d > 20) & (lon2d < 60)
    # Southeast Asia
    mask |= (lon2d > 97) & (lat2d > 8)
    return mask


def _smooth_field(shape, scale=8):
    """Spatially correlated random field, so patches carry real structure."""
    small = RNG.standard_normal((shape[0] // scale + 2, shape[1] // scale + 2))
    x = np.linspace(0, small.shape[0] - 1, shape[0])
    y = np.linspace(0, small.shape[1] - 1, shape[1])
    xi = np.clip(x.astype(int), 0, small.shape[0] - 2)
    yi = np.clip(y.astype(int), 0, small.shape[1] - 2)
    fx = (x - xi)[:, None]
    fy = (y - yi)[None, :]
    a = small[np.ix_(xi, yi)]
    b = small[np.ix_(xi + 1, yi)]
    c = small[np.ix_(xi, yi + 1)]
    d = small[np.ix_(xi + 1, yi + 1)]
    return (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy)
            + c * (1 - fx) * fy + d * fx * fy).astype("float32")


def build(days, step, start="2017-01-01"):
    times = pd.date_range(start, periods=days, freq=f"{step}D")
    land = _land_mask()
    lat2d = np.broadcast_to(LATS[:, None], (NLAT, NLON)).astype("float32")
    lon2d = np.broadcast_to(LONS[None, :], (NLAT, NLON)).astype("float32")

    surf = {v: np.empty((days, NLAT, NLON), dtype="float32") for v in SURFACE_VARS}
    temp = np.empty((days, NDEPTH, NLAT, NLON), dtype="float32")

    for t, ts in enumerate(times):
        doy = ts.dayofyear
        seas = np.sin(2 * np.pi * (doy - 80) / 365.25).astype("float32")

        # --- surface fields -------------------------------------------------
        sla = 0.12 * _smooth_field((NLAT, NLON), scale=10)
        sst = (29.0 - 0.12 * (lat2d - 5.0) + 1.2 * seas
               + 3.0 * sla + 0.15 * _smooth_field((NLAT, NLON), scale=6))
        # fresher in the northern Bay of Bengal, saltier in the Arabian Sea
        sss = (35.0 - 3.5 * np.exp(-((lat2d - 21) ** 2) / 40 - ((lon2d - 89) ** 2) / 60)
               + 0.6 * np.exp(-((lat2d - 20) ** 2) / 60 - ((lon2d - 62) ** 2) / 90)
               + 0.1 * _smooth_field((NLAT, NLON), scale=7))
        u_cur = 0.4 * _smooth_field((NLAT, NLON), scale=9)
        v_cur = 0.4 * _smooth_field((NLAT, NLON), scale=9)
        u_wind = -4.0 * seas + 1.5 * _smooth_field((NLAT, NLON), scale=12)
        v_wind = 2.0 * seas + 1.5 * _smooth_field((NLAT, NLON), scale=12)

        for name, arr in zip(
            SURFACE_VARS, [sst, sss, sla, u_cur, v_cur, u_wind, v_wind]
        ):
            a = arr.copy()
            a[land] = np.nan
            surf[name][t] = a

        # --- subsurface temperature, driven by SLA ---------------------------
        # thermocline sits deeper where sea level is high
        D = 80.0 + 220.0 * sla + 10.0 * seas              # (NLAT, NLON)
        W = 45.0 + 10.0 * _smooth_field((NLAT, NLON), scale=14)
        T_deep = 4.0
        z = DEPTHS[:, None, None]
        prof = T_deep + (sst - T_deep) * 0.5 * (
            1.0 - np.tanh((z - D[None]) / W[None])
        )

        # winter inversion in the northern Bay of Bengal: warmer at ~30 m
        winter = np.clip(np.cos(2 * np.pi * (doy - 10) / 365.25), 0, 1)
        bob_north = np.exp(-((lat2d - 20) ** 2) / 30 - ((lon2d - 89) ** 2) / 50)
        inv_amp = (1.4 * winter * bob_north).astype("float32")
        bump = np.exp(-((z - 30.0) ** 2) / (2 * 18.0 ** 2))
        prof = prof - inv_amp[None] * (1.0 - bump) * (z < 90)

        prof = prof.astype("float32")
        prof[:, land] = np.nan
        temp[t] = prof

    # --- bathymetry: blank out depths below the sea floor --------------------
    floor = 1200.0 * np.ones((NLAT, NLON), dtype="float32")
    shelf = np.exp(-((lat2d - 21) ** 2) / 25 - ((lon2d - 89) ** 2) / 40)
    floor -= 1050.0 * shelf
    for k, d in enumerate(DEPTHS):
        temp[:, k][:, floor < d] = np.nan

    surface = xr.Dataset(
        {v: (("time", "lat", "lon"), surf[v]) for v in SURFACE_VARS},
        coords={"time": times, "lat": LATS, "lon": LONS},
    )
    glorys = xr.Dataset(
        {"thetao": (("time", "depth", "lat", "lon"), temp)},
        coords={"time": times, "depth": DEPTHS, "lat": LATS, "lon": LONS},
    )
    return surface, glorys


def build_climatology(surface, glorys):
    """
    Day-of-year climatology, in two parts:

      *_mean  seasonal cycle per day-of-year, smoothed with a circular
              31-day window so a short record still gives a usable curve
      *_std   standard deviation of the ANOMALIES (data minus seasonal mean),
              with NO day-of-year dimension

    Why the std has no day-of-year axis: with only a few years per calendar
    day, a per-day std is near zero and the normalisation explodes. The
    anomaly std is stable, is the right scale for the loss, and is a third
    the size on disk.

    NOTE FOR THE REAL PIPELINE: compute this from TRAINING YEARS ONLY.
    Using all years leaks the test set into training.
    """
    from scipy.ndimage import uniform_filter1d

    doy = surface["time"].dt.dayofyear.values
    uniq = np.unique(doy)

    def _seasonal(arr):
        """arr (T, ...) -> (n_doy, ...) smoothed circularly across day-of-year."""
        out = np.empty((len(uniq),) + arr.shape[1:], dtype="float32")
        for k, d in enumerate(uniq):
            out[k] = np.nanmean(arr[doy == d], axis=0)
        return uniform_filter1d(out, size=31, axis=0, mode="wrap")

    cl = {}
    dmap = {d: k for k, d in enumerate(uniq)}
    idx = np.array([dmap[d] for d in doy])

    for v in SURFACE_VARS:
        a = surface[v].values.astype("float32")
        m = _seasonal(a)
        sd = np.nanstd(a - m[idx], axis=0).astype("float32")
        sd = np.where(np.isfinite(sd) & (sd > 1e-3), sd, 1e-3)
        cl[f"{v}_mean"] = (("dayofyear", "lat", "lon"), m)
        cl[f"{v}_std"] = (("lat", "lon"), sd)
        del a, m

    a = glorys["thetao"].values.astype("float32")
    m = _seasonal(a)
    sd = np.nanstd(a - m[idx], axis=0).astype("float32")
    sd = np.where(np.isfinite(sd) & (sd > 1e-3), sd, 1e-3)
    cl["thetao_mean"] = (("dayofyear", "depth", "lat", "lon"), m)
    cl["thetao_std"] = (("depth", "lat", "lon"), sd)
    del a, m

    return xr.Dataset(
        cl,
        coords={
            "dayofyear": uniq,
            "depth": DEPTHS,
            "lat": LATS,
            "lon": LONS,
        },
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--step", type=int, default=5,
                    help="days between samples; the real pipeline uses 5")
    ap.add_argument("--out", default="data/processed")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    print(f"building {args.days} time steps every {args.step} days ...")
    surface, glorys = build(args.days, args.step)
    clim = build_climatology(surface, glorys)

    for name, ds in [("surface", surface), ("glorys", glorys), ("clim", clim)]:
        path = os.path.join(args.out, f"{name}.zarr")
        ds.to_zarr(path, mode="w")
        print(f"  wrote {path}")

    print("\nshapes")
    print(f"  surface  {dict(surface.sizes)}  vars={len(surface.data_vars)}")
    print(f"  glorys   {dict(glorys.sizes)}")
    print(f"  clim     {dict(clim.sizes)}")
    ocean = float(np.isfinite(glorys.thetao.isel(time=0, depth=0)).mean())
    print(f"  ocean fraction at surface: {ocean:.2f}")


if __name__ == "__main__":
    main()