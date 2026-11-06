"""Procedural, seamless textures for the demo ballroom (no downloads, no third-party art).

carpet(): a damask-style hotel carpet (beige florals on a violet-grey ground), mirrored left/right
like a real damask and seamless in both directions. fabric(): the woven acoustic wall panel.
Both return float32 RGB arrays in sRGB 0..1.
"""
import numpy as np


def _periodic_noise(n, cells, rng):
    """Smooth value noise on an n x n grid that wraps at the edges (cells per side)."""
    g = rng.random((cells, cells)).astype(np.float32)
    t = np.arange(n, dtype=np.float32) * cells / n
    i0 = np.floor(t).astype(int) % cells
    i1 = (i0 + 1) % cells
    f = t - np.floor(t)
    f = f * f * (3 - 2 * f)
    rows = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
    rows2 = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
    return rows * (1 - f)[:, None] + rows2 * f[:, None]


def _fbm(n, base, octaves, rng):
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * _periodic_noise(n, base * 2 ** o, rng)
        tot += amp
        amp *= 0.5
    return out / tot


def _smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def carpet(n=1024, seed=7):
    rng = np.random.default_rng(seed)
    big = _fbm(n, 3, 3, rng)       # where the floral clusters gather
    mid = _fbm(n, 10, 4, rng)      # flower and leaf shapes
    fine = _fbm(n, 28, 3, rng)     # petal and lace detail
    x = np.arange(n)
    mirror = np.minimum(x, n - 1 - x) * 2   # left half mirrored onto the right: damask symmetry, seamless
    big, mid, fine = (a[:, np.clip(mirror, 0, n - 1)] for a in (big, mid, fine))
    cluster = _smooth(0.42, 0.62, big)
    shapes = _smooth(0.545, 0.575, mid + (cluster - 0.5) * 0.25)
    lace = _smooth(0.86, 0.97, np.abs(np.sin(mid * 55.0 + fine * 9.0))) * (0.35 + 0.65 * cluster)
    speck = _smooth(0.60, 0.66, fine) * (1 - shapes) * cluster
    beige = np.clip(shapes * (0.55 + 0.45 * fine) + lace * 0.6 + speck * 0.45, 0, 1)
    ground = np.array([0.30, 0.29, 0.42], np.float32)   # violet-grey
    ground2 = np.array([0.40, 0.40, 0.50], np.float32)  # lighter grey-blue mottling
    sand = np.array([0.80, 0.68, 0.56], np.float32)
    blush = np.array([0.70, 0.58, 0.54], np.float32)
    mott = _smooth(0.45, 0.70, fine)[..., None] * 0.45
    g = ground * (1 - mott) + ground2 * mott
    tone = _smooth(0.3, 0.8, mid)[..., None]
    fl = sand * tone + blush * (1 - tone)
    c = g * (1 - beige[..., None]) + fl * beige[..., None]
    fibre = rng.normal(1.0, 0.05, (n, n)).astype(np.float32)
    return np.clip(c * fibre[..., None], 0, 1)


def fabric(n=512, seed=3):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    weave = 0.5 + 0.25 * np.sin(x * np.pi * 2 * 96 / n) * np.sin(y * np.pi * 2 * 96 / n)
    slub = _fbm(n, 8, 3, rng)
    v = 0.92 + 0.05 * (weave - 0.5) + 0.06 * (slub - 0.5) + rng.normal(0, 0.02, (n, n))
    base = np.array([0.80, 0.75, 0.67], np.float32)
    return np.clip(base[None, None] * v[..., None], 0, 1).astype(np.float32)


def save_png(arr, path):
    from PIL import Image
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    save_png(carpet(), f'{out}/carpet.png')
    save_png(fabric(), f'{out}/fabric.png')
