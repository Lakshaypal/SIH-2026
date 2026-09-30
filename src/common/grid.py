"""
Canonical domain definition for Halocline (SIH26066).

Every module imports the grid from here. Nothing else defines it.
If these numbers are wrong, everything downstream is wrong, so they
live in exactly one place.

Domain and resolution are fixed by the problem statement:
    5 N - 30 N, 45 E - 105 E, 0.25 deg, daily.
"""

import numpy as np

# ----------------------------------------------------------------------
# Horizontal grid
# ----------------------------------------------------------------------
# Cell centres on the standard 0.25 deg grid (offset 0.125 from integers),
# which matches OISST and the CMEMS L4 products, and matches GLORYS 1/12
# coarsened by a factor of 3.
LAT_MIN, LAT_MAX = 5.125, 29.875
LON_MIN, LON_MAX = 45.125, 104.875
RES = 0.25

LATS = np.arange(LAT_MIN, LAT_MAX + RES / 2, RES, dtype="float32")   # 100
LONS = np.arange(LON_MIN, LON_MAX + RES / 2, RES, dtype="float32")   # 240

NLAT = len(LATS)   # 100
NLON = len(LONS)   # 240

# ----------------------------------------------------------------------
# Depth levels — fixed by the problem statement, do not edit
# ----------------------------------------------------------------------
DEPTHS = np.array(
    [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    dtype="float32",
)
NDEPTH = len(DEPTHS)   # 15

# ----------------------------------------------------------------------
# Surface input variables — fixed by the problem statement
# ----------------------------------------------------------------------
# SST, SSS, SLA, surface currents (U,V), surface winds (U,V)
SURFACE_VARS = [
    "sst",      # sea surface temperature        degC
    "sss",      # sea surface salinity           psu
    "sla",      # sea level anomaly              m
    "u_cur",    # surface current, eastward      m/s
    "v_cur",    # surface current, northward     m/s
    "u_wind",   # surface wind, eastward         m/s
    "v_wind",   # surface wind, northward        m/s
]
NCHAN = len(SURFACE_VARS)   # 7

# ----------------------------------------------------------------------
# Sub-basin split — metrics are reported separately for each
# ----------------------------------------------------------------------
BOB_LON_MIN = 78.0     # Bay of Bengal: east of ~78 E
AS_LON_MAX = 78.0      # Arabian Sea:   west of ~78 E


def basin_mask():
    """Return (bob, arabian) boolean masks of shape (NLAT, NLON)."""
    lon2d = np.broadcast_to(LONS[None, :], (NLAT, NLON))
    bob = lon2d >= BOB_LON_MIN
    arabian = lon2d < AS_LON_MAX
    return bob, arabian


def nearest_cell(lat, lon):
    """Map a (lat, lon) in degrees to the nearest grid index pair (i, j)."""
    i = int(np.clip(np.round((lat - LAT_MIN) / RES), 0, NLAT - 1))
    j = int(np.clip(np.round((lon - LON_MIN) / RES), 0, NLON - 1))
    return i, j


def in_domain(lat, lon):
    """True if a point falls inside the problem-statement domain."""
    return (LAT_MIN - RES / 2 <= lat <= LAT_MAX + RES / 2) and (
        LON_MIN - RES / 2 <= lon <= LON_MAX + RES / 2
    )


if __name__ == "__main__":
    print(f"lat  {LATS[0]} .. {LATS[-1]}   n={NLAT}")
    print(f"lon  {LONS[0]} .. {LONS[-1]}   n={NLON}")
    print(f"depths  {DEPTHS.tolist()}   n={NDEPTH}")
    print(f"channels  {SURFACE_VARS}   n={NCHAN}")
    assert NLAT == 100 and NLON == 240 and NDEPTH == 15 and NCHAN == 7
    print("grid OK")