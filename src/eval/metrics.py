"""
Metrics, computed per depth level.

Everything here takes masked arrays of shape (N, L) and reduces over N,
returning one number per depth. Basin-mean numbers hide the fact that the
thermocline is where all the skill is, so we never report them alone.

SKILL SCORE is the one that matters:

    SS = 1 - MSE_model / MSE_climatology

Because the dataset works in anomaly space, the climatology prediction is
exactly zero, so MSE_climatology is just the mean of y squared. A skill
score of 0 means the model added nothing over guessing the seasonal
average. Negative means it made things worse.
"""

import numpy as np


def _masked(a, b, mask):
    m = mask > 0
    return a[m], b[m]


def per_depth(pred, true, mask):
    """
    pred, true, mask  (N, L) arrays
    Returns a dict of (L,) arrays: rmse, bias, corr, skill, n
    """
    pred = np.asarray(pred, dtype="float64")
    true = np.asarray(true, dtype="float64")
    mask = np.asarray(mask, dtype="float64")
    L = pred.shape[1]

    rmse = np.full(L, np.nan)
    bias = np.full(L, np.nan)
    corr = np.full(L, np.nan)
    skill = np.full(L, np.nan)
    count = np.zeros(L, dtype=int)

    for k in range(L):
        p, t = _masked(pred[:, k], true[:, k], mask[:, k])
        count[k] = len(p)
        if len(p) < 30:
            continue
        err = p - t
        rmse[k] = np.sqrt(np.mean(err ** 2))
        bias[k] = np.mean(err)
        if p.std() > 1e-9 and t.std() > 1e-9:
            corr[k] = np.corrcoef(p, t)[0, 1]
        # climatology predicts zero anomaly, so its MSE is mean(t^2).
        # Where there is essentially no variability to explain (the deepest
        # levels), the ratio is meaningless and explodes, so report nothing
        # rather than a spurious number.
        mse_clim = np.mean(t ** 2)
        if mse_clim > 1e-3:
            skill[k] = 1.0 - np.mean(err ** 2) / mse_clim

    return {"rmse": rmse, "bias": bias, "corr": corr, "skill": skill, "n": count}


def table(results, depths, order=None):
    """
    results  dict of name -> per_depth() output
    Returns a printable comparison of RMSE and skill score by depth.
    """
    names = order or list(results)
    w = max(len(n) for n in names) + 2

    lines = []
    head = f"{'depth':>7}  " + "".join(f"{n:>{w}}" for n in names)
    lines.append("  RMSE (anomaly units, lower is better)")
    lines.append(head)
    for k, d in enumerate(depths):
        row = f"{int(d):7d}  "
        for n in names:
            v = results[n]["rmse"][k]
            row += f"{v:>{w}.3f}" if np.isfinite(v) else f"{'-':>{w}}"
        lines.append(row)

    lines.append("")
    lines.append("  Skill score vs climatology (higher is better, 0 = no better than the average)")
    lines.append(head)
    for k, d in enumerate(depths):
        row = f"{int(d):7d}  "
        for n in names:
            v = results[n]["skill"][k]
            row += f"{v:>{w}.3f}" if np.isfinite(v) else f"{'-':>{w}}"
        lines.append(row)

    return "\n".join(lines)


def summary(res, depths, lo=20.0, hi=200.0):
    """
    Mean skill over the thermocline band, where the signal actually is.
    One number for tracking progress; never the only number reported.
    """
    band = (np.asarray(depths) >= lo) & (np.asarray(depths) <= hi)
    s = res["skill"][band]
    s = s[np.isfinite(s)]
    return float(np.mean(s)) if len(s) else float("nan")