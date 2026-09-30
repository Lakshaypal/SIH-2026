"""
Training losses.

Three pieces:

1. CRPS — the Continuous Ranked Probability Score. A strictly proper
   scoring rule, meaning it is minimised only when the predicted
   distribution matches the true one. It rewards being accurate AND being
   honest about how confident you are. Claiming +/- 0.1 and being wrong by
   2 is punished far harder than admitting +/- 2.

   For a Gaussian prediction it has a closed form, so it costs one forward
   pass and no sampling. That is why we use a Gaussian head rather than an
   ensemble of point predictions: same calibration benefit, a fraction of
   the compute, and it fits on one GPU.

       CRPS(N(mu, sigma), y) = sigma * [ w(2*Phi(w) - 1) + 2*phi(w) - 1/sqrt(pi) ]
       where w = (y - mu) / sigma

2. SMOOTHNESS — penalise the second derivative of the profile with respect
   to depth. Removes the sawtooth that independent depth outputs produce,
   while leaving genuine structure alone.

   NEVER a monotonicity penalty. Winter inversions in the northern Bay of
   Bengal are real ocean structure and must stay representable. A real
   inversion is a gentle bend; noise is a spike. Curvature separates them.
   Direction does not.

3. MASKING — every term is multiplied by the validity mask, so levels below
   the sea floor never contribute a gradient.

WHAT IS DELIBERATELY NOT HERE: per-depth rescaling by natural variability.
The dataset already divides each level by its climatological standard
deviation, so the target arrives pre-scaled. Doing it again here would
double-count. Keep the normalisation where the data is built, so it is
visible in one place.
"""

import math

import torch
import torch.nn as nn

SQRT_PI = math.sqrt(math.pi)
SQRT_2 = math.sqrt(2.0)


def gaussian_crps(mu, sigma, y):
    """
    Closed-form CRPS for a Gaussian prediction. Elementwise.

    mu, sigma, y  broadcastable tensors; sigma must be positive.
    Returns a tensor of the same shape, in the same units as y.
    """
    sigma = sigma.clamp_min(1e-6)
    w = (y - mu) / sigma
    # standard normal CDF and PDF
    cdf = 0.5 * (1.0 + torch.erf(w / SQRT_2))
    pdf = torch.exp(-0.5 * w * w) / math.sqrt(2.0 * math.pi)
    return sigma * (w * (2.0 * cdf - 1.0) + 2.0 * pdf - 1.0 / SQRT_PI)


def masked_mean(values, mask):
    """Mean over valid entries only. Returns 0 if nothing is valid."""
    total = (values * mask).sum()
    n = mask.sum().clamp_min(1.0)
    return total / n


class HaloclineLoss(nn.Module):
    """
    Combined training objective.

    w_smooth controls the curvature penalty. Start small (0.05) and check
    that it does not flatten the thermocline: if the predicted profile loses
    its bend, the penalty is too strong.
    """

    def __init__(self, w_smooth=0.05, smooth_scale=1000.0):
        super().__init__()
        self.w_smooth = w_smooth
        # d2T/dz2 is tiny in metre units (order 1e-4), so rescale it into a
        # range where the penalty is numerically comparable to CRPS.
        self.smooth_scale = smooth_scale

    def forward(self, pred, batch, curvature=None):
        """
        pred       dict from the model, with t_mean and t_std, shape (B, L)
        batch      the dataloader batch, needs y (B, L) and mask (B, L)
        curvature  optional (B, L) second derivative from model.curvature()

        Returns (total_loss, parts_dict) where parts_dict holds detached
        scalars for logging.
        """
        y = batch["y"]
        mask = batch["mask"]

        crps = gaussian_crps(pred["t_mean"], pred["t_std"], y)
        crps = masked_mean(crps, mask)

        parts = {"crps": crps.detach()}
        total = crps

        if curvature is not None and self.w_smooth > 0:
            pen = (curvature * self.smooth_scale) ** 2
            pen = masked_mean(pen, mask)
            total = total + self.w_smooth * pen
            parts["smooth"] = pen.detach()

        # diagnostics only — never optimised directly, but useful to watch
        with torch.no_grad():
            err = (pred["t_mean"] - y)
            parts["rmse_anom"] = torch.sqrt(masked_mean(err ** 2, mask))
            parts["bias_anom"] = masked_mean(err, mask)
            parts["mean_std"] = masked_mean(pred["t_std"], mask)

        parts["total"] = total.detach()
        return total, parts


# ----------------------------------------------------------------------
# Verification
# ----------------------------------------------------------------------
def _mc_crps(mu, sigma, y, n=400_000, seed=0):
    """
    Monte-Carlo CRPS from the definition:
        CRPS = E|X - y| - 0.5 * E|X - X'|
    Used only to check the closed form. Slow on purpose; it is a test.
    """
    g = torch.Generator().manual_seed(seed)
    x1 = mu + sigma * torch.randn(n, generator=g)
    x2 = mu + sigma * torch.randn(n, generator=g)
    return (x1 - y).abs().mean() - 0.5 * (x1 - x2).abs().mean()


if __name__ == "__main__":
    print("verifying the closed form against Monte Carlo\n")
    print(f"  {'mu':>6} {'sigma':>6} {'y':>6} {'closed':>9} {'monte-carlo':>12} {'diff':>9}")
    worst = 0.0
    for mu, sigma, y in [
        (0.0, 1.0, 0.0),
        (0.0, 1.0, 1.5),
        (2.0, 0.5, -1.0),
        (-1.0, 2.0, 0.3),
        (0.5, 0.1, 0.55),
    ]:
        closed = gaussian_crps(
            torch.tensor(mu), torch.tensor(sigma), torch.tensor(y)
        ).item()
        mc = _mc_crps(mu, sigma, y).item()
        worst = max(worst, abs(closed - mc))
        print(f"  {mu:6.2f} {sigma:6.2f} {y:6.2f} {closed:9.5f} {mc:12.5f} {closed-mc:9.5f}")
    assert worst < 5e-3, f"closed form disagrees with Monte Carlo by {worst}"
    print(f"\n  worst disagreement {worst:.5f}  — closed form is correct")

    # CRPS must be minimised at the true sigma, not at sigma -> 0.
    # This is what "strictly proper" means, and it is why the model cannot
    # win by claiming false confidence.
    print("\n  CRPS against predicted sigma, when the truth is N(0, 1):")
    g = torch.Generator().manual_seed(1)
    samples = torch.randn(20000, generator=g)
    best, best_s = 1e9, None
    for s in [0.2, 0.5, 0.8, 1.0, 1.3, 2.0, 4.0]:
        v = gaussian_crps(
            torch.zeros_like(samples), torch.full_like(samples, s), samples
        ).mean().item()
        flag = ""
        if v < best:
            best, best_s = v, s
        print(f"    sigma = {s:4.1f}   CRPS = {v:.5f}{flag}")
    print(f"    minimum at sigma = {best_s}  (true value is 1.0)")
    assert best_s == 1.0, "CRPS should be minimised at the true spread"

    # full loss on a real model output
    from src.common.grid import DEPTHS, NCHAN
    from src.models.depth_field import DepthField, Halocline
    from src.models.encoder import SurfaceEncoder, build_cond

    B, L = 8, len(DEPTHS)
    model = Halocline(SurfaceEncoder(), DepthField())
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

    mask = torch.ones(B, L)
    mask[:, -2:] = 0.0            # pretend the two deepest levels are sea floor
    batch = {"y": torch.randn(B, L), "mask": mask}

    pred = model(x, cond, z)
    curv = model.curvature(x, cond, z)
    loss_fn = HaloclineLoss(w_smooth=0.05)
    loss, parts = loss_fn(pred, batch, curv)

    print("\n  loss on an untrained model:")
    for k, v in parts.items():
        print(f"    {k:10s} {v.item():.5f}")

    loss.backward()
    grads = [p.grad for p in model.parameters() if p.grad is not None]
    assert grads, "no gradients reached the model"
    assert all(torch.isfinite(g).all() for g in grads), "non-finite gradient"
    assert torch.isfinite(loss), "loss is not finite"
    print(f"\n  gradients reached {len(grads)} tensors, all finite")
    print("loss OK")