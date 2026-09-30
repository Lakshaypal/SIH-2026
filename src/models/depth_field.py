"""
The depth decoder — a continuous neural field over depth.

Given the latent ocean state from the encoder and a queried depth, returns
the temperature anomaly at that depth together with its uncertainty. Depth
is a continuous input, not 15 separate output heads.

Three reasons this matters, all of which are worth saying out loud in the
deck:

1. Fifteen independent outputs can disagree with each other and produce a
   physically impossible jagged profile. One continuous curve cannot.
2. Because the curve is differentiable in depth, we can penalise sharp kinks
   directly with autograd. Fifteen separate heads give you no derivative to
   work with.
3. The problem statement asks for 15 levels. This can output any depth,
   including ones never seen in training.

Two implementation details that decide whether it works:

STRETCHED DEPTH AXIS. Variability is concentrated near the surface, so we
feed log(1 + z/20) rather than raw metres. Otherwise the network spends as
much capacity on the 700-1000 m range, where almost nothing happens, as on
the thermocline, where everything does.

FOURIER FEATURES. Plain MLPs are biased toward smooth, low-frequency
functions, so a raw depth input gives an over-smoothed profile with the
thermocline smeared out. Fourier features let the network represent sharp
bends. The band count is kept moderate (8) — too many invites fitting
high-frequency noise in GLORYS that is not real ocean structure.

NOTE ON MONOTONICITY: there is deliberately no mechanism here that forces
temperature to decrease with depth. Winter inversions in the northern Bay
of Bengal are real, and a monotonic construction would make them
unrepresentable. Smoothness is enforced in the loss; direction never is.
"""

import torch
import torch.nn as nn

DEPTH_SCALE = 20.0     # metres, in log(1 + z / DEPTH_SCALE)
DEPTH_NORM = 4.0       # log(1 + 1000/20) = 3.93, so this maps to roughly [0, 1]


def stretch(z):
    """Physical depth in metres -> stretched, roughly unit-range coordinate."""
    return torch.log1p(z / DEPTH_SCALE) / DEPTH_NORM


class FourierDepth(nn.Module):
    """Encode a scalar depth as a bank of sines and cosines."""

    def __init__(self, bands=8):
        super().__init__()
        self.register_buffer("freqs", 2.0 ** torch.arange(bands) * torch.pi)
        self.out_dim = 1 + 2 * bands

    def forward(self, zt):
        # zt (B, L) stretched depth
        ang = zt[..., None] * self.freqs           # (B, L, bands)
        return torch.cat([zt[..., None], ang.sin(), ang.cos()], dim=-1)


class FiLMLinear(nn.Module):
    """A linear layer whose output is modulated by the latent ocean state.

    FiLM rather than concatenation. If the latent were simply concatenated
    alongside the depth features, the network could partially ignore it and
    fall back on a generic average profile — the exact failure mode we need
    to avoid. Modulating every layer forces the ocean state to shape the
    whole curve.
    """

    def __init__(self, dim, embed_dim):
        super().__init__()
        self.lin = nn.Linear(dim, dim)
        self.norm = nn.LayerNorm(dim)
        self.film = nn.Linear(embed_dim, 2 * dim)
        self.act = nn.GELU()
        nn.init.zeros_(self.film.weight)
        nn.init.zeros_(self.film.bias)

    def forward(self, h, emb):
        gamma, beta = self.film(emb).chunk(2, dim=-1)
        gamma = gamma[:, None, :]
        beta = beta[:, None, :]
        h = self.norm(self.lin(h))
        return self.act(h * (1.0 + gamma) + beta)


class DepthField(nn.Module):
    def __init__(
        self,
        embed_dim=192,
        width=192,
        layers=3,
        bands=8,
        predict_salinity=False,
    ):
        super().__init__()
        self.fourier = FourierDepth(bands)
        self.inp = nn.Linear(self.fourier.out_dim, width)
        self.trunk = nn.ModuleList(
            [FiLMLinear(width, embed_dim) for _ in range(layers)]
        )
        self.predict_salinity = predict_salinity
        n_out = 4 if predict_salinity else 2
        self.head = nn.Linear(width, n_out)
        # start with small outputs and a sensible initial spread
        nn.init.zeros_(self.head.weight)
        nn.init.zeros_(self.head.bias)

    def forward(self, emb, z):
        """
        emb  (B, embed_dim)  latent ocean state from the encoder
        z    (B, L)          query depths in METRES

        returns dict with (B, L) tensors:
            t_mean, t_std  and, if enabled, s_mean, s_std
        All in anomaly space. The caller adds climatology back.
        """
        h = self.inp(self.fourier(stretch(z)))
        for layer in self.trunk:
            h = layer(h, emb)
        out = self.head(h)

        res = {
            "t_mean": out[..., 0],
            # softplus keeps the standard deviation positive; the +1.0 offset
            # means an untrained model starts near unit spread in anomaly
            # space rather than at zero, which would make CRPS explode.
            "t_std": torch.nn.functional.softplus(out[..., 1] + 1.0) + 1e-3,
        }
        if self.predict_salinity:
            res["s_mean"] = out[..., 2]
            res["s_std"] = torch.nn.functional.softplus(out[..., 3] + 1.0) + 1e-3
        return res


class Halocline(nn.Module):
    """Encoder plus depth field, as one model."""

    def __init__(self, encoder, depth_field):
        super().__init__()
        self.encoder = encoder
        self.depth_field = depth_field

    def forward(self, x, cond, z):
        return self.depth_field(self.encoder(x, cond), z)

    def curvature(self, x, cond, z):
        """
        Second derivative of predicted temperature with respect to PHYSICAL
        depth, for the smoothness penalty.

        Taken with respect to metres, not the stretched coordinate: in
        stretched coordinates a fixed amount of curvature corresponds to
        different physical wavelengths at different depths, which would
        over-smooth the deep ocean and under-smooth the surface layer.
        """
        z = z.clone().requires_grad_(True)
        emb = self.encoder(x, cond)
        t = self.depth_field(emb, z)["t_mean"]

        g = torch.autograd.grad(t.sum(), z, create_graph=True)[0]
        gg = torch.autograd.grad(g.sum(), z, create_graph=True)[0]
        return gg


if __name__ == "__main__":
    from src.common.grid import DEPTHS, NCHAN
    from src.models.encoder import SurfaceEncoder, build_cond, count_params

    B = 4
    enc = SurfaceEncoder()
    dec = DepthField(embed_dim=enc.embed_dim)
    model = Halocline(enc, dec)

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
    z = torch.as_tensor(DEPTHS)[None].repeat(B, 1)

    out = model(x, cond, z)
    for k, v in out.items():
        print(f"  {k:8s} {tuple(v.shape)}")

    print(f"\n  encoder params  {count_params(enc):,}")
    print(f"  decoder params  {count_params(dec):,}")
    print(f"  total           {count_params(model):,}")

    assert out["t_mean"].shape == (B, len(DEPTHS))
    assert (out["t_std"] > 0).all(), "std must be positive"

    # the field is continuous: ask for a depth that is not in the level list
    odd = torch.full((B, 1), 137.0)
    assert model(x, cond, odd)["t_mean"].shape == (B, 1)

    curv = model.curvature(x, cond, z)
    assert curv.shape == (B, len(DEPTHS))
    assert torch.isfinite(curv).all()
    print(f"  curvature       {tuple(curv.shape)}  (autograd works)")
    print("depth field OK")