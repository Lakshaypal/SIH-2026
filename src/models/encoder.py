"""
The satellite embedding engine.

Takes a 32x32 patch of surface channels plus position and season, and
compresses it into a compact latent vector describing the ocean state.
This is deliverable 2 of the problem statement: "a satellite embedding
engine capable of learning latent ocean representations from surface
observations".

Two design decisions that matter more than anything else here:

1. GLOBAL POOLING ALONE IS WRONG for this task. The target is the profile
   at the CENTRE cell. Pure global average pooling is translation invariant,
   so an eddy at the patch edge would contribute exactly as much as one
   sitting directly over the target. We concatenate the centre features with
   the pooled features, so the model keeps both "what is directly below"
   and "what is the surrounding field doing".

2. CONDITIONING IS CONTINUOUS, NOT CATEGORICAL. A categorical basin label
   (Bay of Bengal vs Arabian Sea) would put a visible seam in the output map
   at the basin boundary, and would hand the model a shortcut that corrupts
   the region-holdout test. Smooth normalised lat/lon plus day-of-year lets
   the model learn the regional difference itself.

Conditioning enters through FiLM (feature-wise linear modulation): a small
MLP produces a per-channel scale and shift applied inside each stage. This
modulates the whole encoding rather than acting as an extra image channel.
"""

import numpy as np
import torch
import torch.nn as nn

from src.common.grid import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, NCHAN

COND_DIM = 8   # 6 positional + 2 day-of-year


# ----------------------------------------------------------------------
# Conditioning vector
# ----------------------------------------------------------------------
def build_cond(meta, doy, lats=None, lons=None):
    """
    Build the (B, 8) conditioning vector from a batch's meta and doy fields.

    meta  (B, 3) long tensor — time index, lat index, lon index
    doy   (B, 2) float tensor — sin/cos of day of year, straight from the batch

    Returns (B, 8): normalised lat, normalised lon, two Fourier terms for
    each, then the two day-of-year terms.

    Deliberately continuous. No basin id anywhere.
    """
    from src.common.grid import LATS, LONS

    if lats is None:
        lats = torch.as_tensor(np.asarray(LATS), dtype=torch.float32, device=meta.device)
    if lons is None:
        lons = torch.as_tensor(np.asarray(LONS), dtype=torch.float32, device=meta.device)

    lat = lats[meta[:, 1]]
    lon = lons[meta[:, 2]]

    # map to [-1, 1] across the domain
    latn = 2.0 * (lat - LAT_MIN) / (LAT_MAX - LAT_MIN) - 1.0
    lonn = 2.0 * (lon - LON_MIN) / (LON_MAX - LON_MIN) - 1.0

    two_pi = 2.0 * float(np.pi)
    return torch.stack(
        [
            latn,
            lonn,
            torch.sin(two_pi * latn),
            torch.cos(two_pi * latn),
            torch.sin(two_pi * lonn),
            torch.cos(two_pi * lonn),
            doy[:, 0],
            doy[:, 1],
        ],
        dim=1,
    )


# ----------------------------------------------------------------------
# Building blocks
# ----------------------------------------------------------------------
class FiLM(nn.Module):
    """Produce a per-channel scale and shift from the conditioning vector."""

    def __init__(self, cond_dim, channels, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(cond_dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, 2 * channels),
        )
        # start as identity: scale 1, shift 0
        nn.init.zeros_(self.net[-1].weight)
        nn.init.zeros_(self.net[-1].bias)
        self.channels = channels

    def forward(self, h, cond):
        gamma, beta = self.net(cond).chunk(2, dim=1)
        gamma = gamma[:, :, None, None]
        beta = beta[:, :, None, None]
        return h * (1.0 + gamma) + beta


def _gn(channels):
    """GroupNorm, not BatchNorm.

    Batches here are patches drawn from a handful of correlated days, so
    batch statistics are not a reliable estimate of the population.
    GroupNorm is independent of batch composition.
    """
    return nn.GroupNorm(num_groups=min(8, channels), num_channels=channels)


class ResBlock(nn.Module):
    def __init__(self, channels, cond_dim):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.norm1 = _gn(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.norm2 = _gn(channels)
        self.film = FiLM(cond_dim, channels)
        self.act = nn.GELU()

    def forward(self, h, cond):
        r = h
        h = self.act(self.norm1(self.conv1(h)))
        h = self.norm2(self.conv2(h))
        h = self.film(h, cond)
        return self.act(h + r)


class Down(nn.Module):
    def __init__(self, cin, cout):
        super().__init__()
        self.conv = nn.Conv2d(cin, cout, 3, stride=2, padding=1)
        self.norm = _gn(cout)
        self.act = nn.GELU()

    def forward(self, h):
        return self.act(self.norm(self.conv(h)))


# ----------------------------------------------------------------------
# Encoder
# ----------------------------------------------------------------------
class SurfaceEncoder(nn.Module):
    """
    32x32 patch  ->  latent vector of size `embed_dim`.

    Capacity is deliberately modest. With roughly ten effectively independent
    years of training data, every extra parameter is a chance to memorise
    GLORYS's own artefacts rather than learn ocean physics.
    """

    def __init__(
        self,
        in_ch=NCHAN,
        embed_dim=192,
        widths=(32, 64, 128, 160),
        blocks=(2, 1, 1),
        cond_dim=COND_DIM,
    ):
        super().__init__()
        w0, w1, w2, w3 = widths

        self.stem = nn.Sequential(nn.Conv2d(in_ch, w0, 3, padding=1), _gn(w0), nn.GELU())

        self.down1 = Down(w0, w1)
        self.blocks1 = nn.ModuleList([ResBlock(w1, cond_dim) for _ in range(blocks[0])])

        self.down2 = Down(w1, w2)
        self.blocks2 = nn.ModuleList([ResBlock(w2, cond_dim) for _ in range(blocks[1])])

        self.down3 = Down(w2, w3)
        self.blocks3 = nn.ModuleList([ResBlock(w3, cond_dim) for _ in range(blocks[2])])

        # pooled context + centre features -> latent
        self.head = nn.Sequential(
            nn.Linear(2 * w3, embed_dim),
            nn.GELU(),
            nn.Linear(embed_dim, embed_dim),
        )
        self.embed_dim = embed_dim

    def forward(self, x, cond):
        """
        x     (B, C, 32, 32)
        cond  (B, 8) from build_cond
        returns (B, embed_dim)
        """
        h = self.stem(x)

        h = self.down1(h)
        for b in self.blocks1:
            h = b(h, cond)

        h = self.down2(h)
        for b in self.blocks2:
            h = b(h, cond)

        h = self.down3(h)
        for b in self.blocks3:
            h = b(h, cond)

        # h is (B, w3, 4, 4) for a 32x32 input
        pooled = h.mean(dim=(2, 3))                 # surrounding field
        centre = h[:, :, 1:3, 1:3].mean(dim=(2, 3))  # directly below the target
        return self.head(torch.cat([pooled, centre], dim=1))


def count_params(module):
    return sum(p.numel() for p in module.parameters() if p.requires_grad)


if __name__ == "__main__":
    B = 4
    enc = SurfaceEncoder()
    x = torch.randn(B, NCHAN, 32, 32)
    meta = torch.stack(
        [
            torch.zeros(B, dtype=torch.long),
            torch.randint(0, 100, (B,)),
            torch.randint(0, 240, (B,)),
        ],
        dim=1,
    )
    doy = torch.randn(B, 2)

    cond = build_cond(meta, doy)
    z = enc(x, cond)

    print(f"  cond   {tuple(cond.shape)}")
    print(f"  latent {tuple(z.shape)}")
    print(f"  params {count_params(enc):,}")
    assert cond.shape == (B, COND_DIM)
    assert z.shape == (B, enc.embed_dim)
    assert torch.isfinite(z).all()
    print("encoder OK")