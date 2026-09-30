"""
Patch-to-profile dataset.

One sample is:
    x     (7, 32, 32)   surface channels on a patch centred on the target cell,
                        as anomaly from day-of-year climatology, standardised
    doy   (2,)          sin/cos of day of year
    z     (15,)         the problem statement's depth levels, in metres
    y     (15,)         temperature at the centre cell, same anomaly space
    mask  (15,)         1 where a valid GLORYS value exists (ocean, above sea floor)
    meta  (3,)          time index, lat index, lon index — for traceability

The model is trained in anomaly space. Use `denormalise()` to get back to
degrees Celsius before computing any reported metric.

Why a patch and not a point: thermocline depth at a cell depends on the
eddy field around it, and that spatial structure is most of the signal in SLA.
32 x 32 at 0.25 deg is 8 deg, roughly 900 km, which comfortably contains
mesoscale eddies.
"""

import numpy as np
import torch
import xarray as xr
from torch.utils.data import Dataset

from src.common.grid import DEPTHS, NCHAN, NDEPTH, NLAT, NLON, SURFACE_VARS

PATCH = 32
HALF = PATCH // 2


class PatchProfileDataset(Dataset):
    def __init__(
        self,
        processed_dir="data/processed",
        time_slice=None,
        patch=PATCH,
        samples_per_epoch=20000,
        lat_range=None,
        lon_range=None,
        seed=0,
        deterministic=False,
    ):
        """
        time_slice   e.g. slice("2010-01-01", "2018-12-31") — split by TIME, never randomly
        lat_range    e.g. (5.0, 30.0) — used to hold out a geographic box
        deterministic  fixed sample list, for validation and test sets
        """
        self.patch = patch
        self.half = patch // 2
        self.rng = np.random.default_rng(seed)
        self.deterministic = deterministic
        self.samples_per_epoch = samples_per_epoch

        surface = xr.open_zarr(f"{processed_dir}/surface.zarr")
        glorys = xr.open_zarr(f"{processed_dir}/glorys.zarr")
        clim = xr.open_zarr(f"{processed_dir}/clim.zarr")

        if time_slice is not None:
            surface = surface.sel(time=time_slice)
            glorys = glorys.sel(time=time_slice)
        assert surface.sizes["time"] == glorys.sizes["time"], "time axes disagree"
        assert surface.sizes["time"] > 0, "empty time slice"

        self.doy = surface["time"].dt.dayofyear.values.astype("int64")   # (T,)
        self.ntime = len(self.doy)

        # Load into memory. Random access into zarr per sample is far too slow.
        # 120 days of fake data is ~90 MB; ten years of real data at every
        # 5th day is ~2 GB, which still fits. If it stops fitting, chunk by year.
        self.surf = np.stack(
            [surface[v].values for v in SURFACE_VARS], axis=1
        ).astype("float32")                                   # (T, C, LAT, LON)
        self.temp = glorys["thetao"].values.astype("float32")  # (T, D, LAT, LON)

        self.s_mean = np.stack(
            [clim[f"{v}_mean"].values for v in SURFACE_VARS], axis=1
        ).astype("float32")                                   # (n_doy, C, LAT, LON)
        self.s_std = np.stack(
            [clim[f"{v}_std"].values for v in SURFACE_VARS], axis=0
        ).astype("float32")                                   # (C, LAT, LON)
        self.t_mean = clim["thetao_mean"].values.astype("float32")   # (n_doy, D, LAT, LON)
        self.t_std = clim["thetao_std"].values.astype("float32")     # (D, LAT, LON)

        self.clim_doy = clim["dayofyear"].values.astype("int64")
        self._doy_index = {d: i for i, d in enumerate(self.clim_doy)}

        # Valid centres: ocean at the surface, and inside any requested box.
        ocean = np.isfinite(self.temp[:, 0]).all(axis=0)       # (LAT, LON)
        if lat_range is not None or lon_range is not None:
            from src.common.grid import LATS, LONS

            box = np.ones_like(ocean)
            if lat_range is not None:
                box &= ((LATS >= lat_range[0]) & (LATS <= lat_range[1]))[:, None]
            if lon_range is not None:
                box &= ((LONS >= lon_range[0]) & (LONS <= lon_range[1]))[None, :]
            ocean &= box
        self.centres = np.argwhere(ocean)                      # (N, 2)
        assert len(self.centres) > 0, "no valid centre cells — check the box"

        # Pad once so every ocean cell can be a centre, including near the
        # domain edge. Edge padding repeats the boundary row/column; the
        # alternative is to refuse to predict within 4 degrees of the edge.
        self.surf = np.pad(
            self.surf,
            ((0, 0), (0, 0), (self.half, self.half), (self.half, self.half)),
            mode="edge",
        )
        self.s_mean = np.pad(
            self.s_mean,
            ((0, 0), (0, 0), (self.half, self.half), (self.half, self.half)),
            mode="edge",
        )
        self.s_std = np.pad(
            self.s_std,
            ((0, 0), (self.half, self.half), (self.half, self.half)),
            mode="edge",
        )

        if deterministic:
            n = min(samples_per_epoch, self.ntime * len(self.centres))
            t_idx = self.rng.integers(0, self.ntime, size=n)
            c_idx = self.rng.integers(0, len(self.centres), size=n)
            self._fixed = np.stack([t_idx, c_idx], axis=1)
        else:
            self._fixed = None

        self.z = torch.from_numpy(DEPTHS.copy())

    def __len__(self):
        return len(self._fixed) if self._fixed is not None else self.samples_per_epoch

    def _pick(self, idx):
        if self._fixed is not None:
            t, c = self._fixed[idx]
            return int(t), int(c)
        return (
            int(self.rng.integers(0, self.ntime)),
            int(self.rng.integers(0, len(self.centres))),
        )

    def __getitem__(self, idx):
        for _ in range(20):
            t, c = self._pick(idx)
            i, j = self.centres[c]
            y_raw = self.temp[t, :, i, j]
            mask = np.isfinite(y_raw)
            if mask[0]:          # need at least a valid surface value
                break
        else:
            t, c = self._pick(idx)
            i, j = self.centres[c]
            y_raw = self.temp[t, :, i, j]
            mask = np.isfinite(y_raw)

        d = self._doy_index[int(self.doy[t])]
        pi, pj = i + self.half, j + self.half   # index into the padded arrays

        sl_i = slice(pi - self.half, pi + self.half)
        sl_j = slice(pj - self.half, pj + self.half)

        x = self.surf[t, :, sl_i, sl_j]
        mu = self.s_mean[d, :, sl_i, sl_j]
        sd = self.s_std[:, sl_i, sl_j]
        x = (x - mu) / sd
        # Land is NaN. After standardising, 0 means "climatological normal",
        # which is the least misleading fill value available.
        x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)

        y = (y_raw - self.t_mean[d, :, i, j]) / self.t_std[:, i, j]
        y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)

        ang = 2 * np.pi * self.doy[t] / 365.25
        doy = np.array([np.sin(ang), np.cos(ang)], dtype="float32")

        return {
            "x": torch.from_numpy(np.ascontiguousarray(x, dtype="float32")),
            "doy": torch.from_numpy(doy),
            "z": self.z,
            "y": torch.from_numpy(y.astype("float32")),
            "mask": torch.from_numpy(mask.astype("float32")),
            "meta": torch.tensor([t, i, j], dtype=torch.long),
        }

    # ------------------------------------------------------------------
    def denormalise(self, y_anom, meta, doy_vals):
        """
        Convert model output in anomaly space back to degrees Celsius.
        Every reported metric must be computed after this call.

        y_anom   (B, 15) tensor or array
        meta     (B, 3)  the meta field from the batch
        doy_vals (B,)    day of year for each sample
        """
        y_anom = np.asarray(y_anom)
        out = np.empty_like(y_anom)
        for b in range(len(y_anom)):
            d = self._doy_index[int(doy_vals[b])]
            _, i, j = [int(v) for v in meta[b]]
            out[b] = y_anom[b] * self.t_std[:, i, j] + self.t_mean[d, :, i, j]
        return out


if __name__ == "__main__":
    ds = PatchProfileDataset(samples_per_epoch=64)
    s = ds[0]
    for k, v in s.items():
        print(f"  {k:6s} {tuple(v.shape)}  {v.dtype}")
    assert s["x"].shape == (NCHAN, PATCH, PATCH)
    assert s["y"].shape == (NDEPTH,)
    assert torch.isfinite(s["x"]).all(), "non-finite value in x"
    assert torch.isfinite(s["y"]).all(), "non-finite value in y"
    print(f"\n  valid depth levels at this cell: {int(s['mask'].sum())}/{NDEPTH}")
    print(f"  x range  {s['x'].min():.2f} .. {s['x'].max():.2f}")
    print("dataset OK")