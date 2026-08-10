#!/usr/bin/env python3
"""
prepare_painting.py — reproduce the corrected 'Jesus in Prayer' web assets
from the original photo (IMG_1178.jpeg: print on wood floor).

Usage:  python3 prepare_painting.py IMG_1178.jpeg [outdir]
Needs:  pip install pillow numpy

Pipeline (identical to the one run in chat on 2026-08-09; verified
pixel-identical against the chat outputs):
  1. Detect painting edges inside the paper border (per-row/col walk-in)
  2. Robust line fits -> four corners -> perspective warp to rectangle
  3. White-balance against sampled paper margins (neutralize room cast)
  4. Levels stretch (0.6..99.85 pct) + 1.06 saturation
  5. Measure & trim residual border slivers (+10px safety)
  6. Export: full-res JPEG q93, 2400px & 1200px web JPEGs q90
"""
import sys, os
import numpy as np
from PIL import Image

def paper_mask(a):
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
    return (lum > 150) & (sat < 55)

def first_painting(scan, need=12):
    run = 0
    for i, p in enumerate(scan):
        if p: run += 1
        else:
            if run >= need: return i
            run = 0
    return None

def fit(d):
    ks = np.array(list(d.keys())); vs = np.array(list(d.values()))
    m = np.abs(vs - np.median(vs)) < 25
    A = np.vstack([ks[m], np.ones(m.sum())]).T
    slope, icept = np.linalg.lstsq(A, vs[m], rcond=None)[0]
    return slope, icept

def corner(vf, hf):
    y = (hf[0]*vf[1] + hf[1]) / (1 - hf[0]*vf[0])
    return vf[0]*y + vf[1], y

def main(src, outdir="."):
    im = Image.open(src).convert("RGB")
    W, H = im.size
    S = 1200
    small = im.resize((S, int(H/W*S)))
    sw, sh = small.size
    a = np.asarray(small).astype(float)
    paper = paper_mask(a)

    L, R, T, B = {}, {}, {}, {}
    for r in range(int(sh*0.22), int(sh*0.86)):
        i = first_painting(paper[r, :]);      L[r] = i if i else None
        j = first_painting(paper[r, ::-1]);   R[r] = sw-1-j if j else None
    for c in range(int(sw*0.20), int(sw*0.90)):
        i = first_painting(paper[:, c]);      T[c] = i if i else None
        j = first_painting(paper[::-1, c]);   B[c] = sh-1-j if j else None
    for d in (L, R, T, B):
        for k in [k for k, v in d.items() if v is None]: del d[k]

    lf, rf, tf, bf = fit(L), fit(R), fit(T), fit(B)
    tl, tr = corner(lf, tf), corner(rf, tf)
    br, bl = corner(rf, bf), corner(lf, bf)
    sc = W / S
    tl, tr, br, bl = [np.array(p)*sc for p in (tl, tr, br, bl)]

    out_w = int(round((np.linalg.norm(tr-tl)+np.linalg.norm(br-bl))/2))
    out_h = int(round((np.linalg.norm(bl-tl)+np.linalg.norm(br-tr))/2))
    quad = (tl[0],tl[1], bl[0],bl[1], br[0],br[1], tr[0],tr[1])
    warped = im.transform((out_w, out_h), Image.QUAD, quad, resample=Image.BICUBIC)

    lm = np.asarray(im.crop((int(tl[0])-320, int(tl[1])+100, int(tl[0])-90,  int(bl[1])-100))).reshape(-1,3).astype(float)
    tm = np.asarray(im.crop((int(tl[0])+100, int(tl[1])-340, int(tr[0])-100, int(tl[1])-110))).reshape(-1,3).astype(float)
    paper_rgb = np.vstack([lm, tm]).mean(axis=0)
    aw = np.asarray(warped).astype(float) * (paper_rgb.mean() / paper_rgb)

    lum = aw.mean(axis=2)
    lo, hi = np.percentile(lum, 0.6), np.percentile(lum, 99.85)
    aw = np.clip((aw - lo) * (250.0/(hi-lo)), 0, 255)
    m = aw.mean(axis=2, keepdims=True)
    aw = np.clip(m + (aw-m)*1.06, 0, 255)
    cor = aw.astype(np.uint8)

    lum = cor.mean(axis=2); sat = cor.max(axis=2).astype(int) - cor.min(axis=2).astype(int)
    bright = (lum > 120) & (sat < 70)
    hh, ww = lum.shape
    def depth(fr):
        arr = np.array(fr[:80]); idx = np.where(arr > 0.04)[0]
        return (idx.max()+1) if len(idx) else 0
    dt = depth([bright[r,:].mean() for r in range(80)])
    db = depth([bright[hh-1-r,:].mean() for r in range(80)])
    dl = depth([bright[:,c].mean() for c in range(80)])
    dr = depth([bright[:,ww-1-c].mean() for c in range(80)])
    M = 10
    final = Image.fromarray(cor).crop((dl+M, dt+M, ww-(dr+M), hh-(db+M)))

    os.makedirs(outdir, exist_ok=True)
    final.save(os.path.join(outdir, "jesus-in-prayer-corrected.jpg"), quality=93)
    fw, fh = final.size
    for w_ in (2400, 1200):
        final.resize((w_, int(fh*w_/fw)), Image.LANCZOS).save(
            os.path.join(outdir, f"jesus-in-prayer-web-{w_}.jpg"), quality=90)
    print(f"done: {final.size[0]}x{final.size[1]} + web 2400/1200 -> {outdir}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ".")