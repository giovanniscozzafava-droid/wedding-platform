#!/usr/bin/env python3
"""DECORI PER MODELLO dalle tavole del catalogo (300 dpi): per gli stampati/laserati/Swarovski
la copertina ha un disegno proprio. Dalla foto più frontale della tavola:
  1) raddrizzo la copertina con una trasformazione prospettica (4 angoli → rettangolo)
  2) separo il TRATTO stampato dalla grana del tessuto (più scuro del fondo locale)
     e i CRISTALLI dai punti luce (più chiari del fondo locale)
  3) salvo public/album-decor/<modello>-print.png (alpha del tratto, si tinge a runtime)
     e <modello>-stones.png (alpha dei cristalli), in coordinate della copertina raddrizzata.
uso: python3 extract-decor.py <cartella hires300> [modello ...] [--check]
"""
import os, sys, json
import numpy as np
import cv2
STONES = {}
from PIL import Image, ImageFilter, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FE = os.path.join(HERE, '..', '..', 'frontend')
OUT = os.path.join(FE, 'public', 'album-decor'); os.makedirs(OUT, exist_ok=True)
SRC = sys.argv[1]
CHECK = os.path.join(os.path.dirname(SRC), 'decor-check'); os.makedirs(CHECK, exist_ok=True)

# modello → pagina stampata, angoli della copertina nella TAVOLA a 300 dpi (x,y in px della tavola
# intera 8032×2894: TL, TR, BR, BL), misure della copertina raddrizzata, soglie.
SPEC = {
  'bouquet': dict(page=82, quad=[(385, 265), (1795, 240), (1840, 1125), (240, 1160)], size=(1200, 1000), print_k=2.6, stone_k=2.2, blur=31, thr=2.4, names=dict(x=0.58, y=0.88), keep=(0.62, 0.04, 0.995, 0.92), erase=[(0.5, 0.84, 0.92, 0.97)]),
  # Xante: il mandala dal DETTAGLIO frontale di p.81 (Alcantara grigio, senza onde), collocato dove sta in p.80 (centro, larghezza)
  'xante':   dict(page=81, detail=(4560, 1950, 5060, 2272), place=(0.564, 0.793, 0.205), size=(1100, 1000), print_k=2.0, stone_k=2.2, blur=25, thr=1.6, stone_thr=3.0, stone_min=30, min_area=12, names=dict(x=0.565, y=0.955)),
  # Ninfea (p.85, album Sequoia cielo ruotato): dorso = lato in basso a sinistra; angoli L,T,R,B della foto → TL,TR,BR,BL della copertina
  'ninfea':  dict(page=85, quad=[(6100, 1840), (6940, 1450), (7655, 1740), (6790, 2335)], size=(1000, 900), print_k=2.6, stone_k=2.2, blur=31, thr=2.2, stone_thr=4.2, stone_min=60, names=dict(x=0.66, y=0.5), keep=(0.05, 0.06, 0.34, 0.975), erase=[(0.25, 0.86, 0.6, 1.0)]),
  # stampe A COLORI (Amelie, Darling): si tiene il colore vero del disegno, alpha dalla distanza cromatica dal fondo
  'amelie':  dict(page=38, quad=[(1189, 513), (3022, 1065), (2787, 1684), (473, 1389)], size=(1200, 850), color=True, blur=41, thr=2.6, k=2.2, thr_c=3.0, k_c=1.6, names=dict(x=0.20, y=0.905, align='left'), keep=(0.03, 0.55, 0.40, 0.955), erase=[(0.19, 0.84, 0.40, 0.97), (0.0, 0.945, 0.5, 1.0)], min_area=10),
  # PIASTRE Cristalwhite INTAGLIATE (Betulla p.20 Velù rosa antico, Dream p.23 Safir tortora): i «fori» sono dove si vede il tessuto
  'betulla': dict(kind='plate', page=20, quad=[(2315, 300), (3345, 298), (3860, 980), (2400, 1020)], size=(1200, 850), white=205, k_w=22, min_area=12, names=dict(x=0.70, y=0.905), keep=(0.11, 0.04, 0.965, 0.95), erase=[(0.56, 0.84, 0.92, 0.96)]),
  'dream':   dict(kind='plate', page=23, quad=[(4560, 450), (5515, 380), (5515, 1250), (4560, 1350)], size=(1100, 1000), white=200, k_w=25, min_area=12, names=dict(x=0.38, y=0.48), keep=(0.03, 0.03, 0.97, 0.965), erase=[(0.2, 0.41, 0.56, 0.55), (0.55, 0.94, 1.0, 1.0)]),
  # FASCIA stampata (Sirene): il motivo dal dettaglio frontale di p.42 (schiacciato in verticale dalla prospettiva → stretch), ripetuto a tutta larghezza
  'sirene':  dict(kind='strip', page=42, detail=(30, 1185, 1990, 1335), size=(1200, 850), stretch_y=2.4, band=(0.0, 0.44, 1.0, 0.60), white=210, k_w=40, min_area=10, names=dict(x=0.5, y=0.37)),
  # Frejus: volute agli angoli, dal coperchio Wood Case mod. Frejus di p.44 (frontale, tono su tono)
  # Frejus: volute agli angoli dall'album Gold Acero glicine/grigio di p.44 (completo, volute lilla su grigio chiaro):
  # alpha da luminanza+cromia in assoluto (mono: a runtime si tinge nel colore scelto)
  'frejus':  dict(page=44, quad=[(2108, 256), (2761, 475), (2432, 766), (1686, 479)], size=(1200, 850), color=True, mono=True, white=190, k_w=25, thr_c=12, k_c=8, med=3, blur=41, min_area=40,
                  names=dict(x=0.33, y=0.77), keep=(0.035, 0.03, 0.985, 0.97), erase=[(0.18, 0.68, 0.55, 0.86)]),
  # Dhyana: volute bicolori (beige e grigio) su Cristalwhite, p.47
  'dhyana':  dict(page=47, quad=[(5813, 1059), (8020, 1248), (8014, 1923), (5861, 2166)], size=(1200, 850), color=True, dematte=False, white=232, k_w=30, thr_c=10, k_c=8, blur=41, med=5, min_area=60, names=dict(x=0.80, y=0.55), keep=(0.02, 0.02, 0.96, 0.92), erase=[(0.6, 0.47, 0.98, 0.62), (0.82, 0.0, 1.0, 0.22), (0.5, 0.9, 1.0, 1.0)]),
  # Azulejo: pannello Cristalplex (damasco chiaro) sul 45% sinistro, foto a destra (layout photo-side); il motivo è SEMPRE chiaro
  'azulejo': dict(kind='panel', page=57, quad=[(6265, 1004), (7028, 964), (7148, 2068), (6325, 2169)], panel=(0.0, 0.0, 0.45, 1.0), size=(1200, 850), bright=True, print_k=3.2, blur=101, thr=0.5, min_area=0, tint='white', names=dict(x=0.225, y=0.44), erase=[(0.18, 0.38, 0.82, 0.55)]),
  'darling': dict(page=41, quad=[(4782, 995), (6740, 470), (7643, 1312), (5395, 2293)], size=(1200, 850), color=True, blur=41, med=9, thr=2.4, k=1.6, chroma='red', thr_c=3.5, k_c=1.3, min_area=70, names=dict(split=[dict(x=0.45, y=0.925, align='right'), dict(x=0.505, y=0.915, align='left')]), keep=(0.34, 0.50, 0.64, 0.965), erase=[(0.30, 0.885, 0.455, 1.0), (0.50, 0.885, 0.66, 1.0), (0.3, 0.965, 0.7, 1.0)]),
}

def circle_mask(w, h, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx - cx * w) ** 2 + (yy - cy * h) ** 2) <= (r * w) ** 2

def drop_small(alpha01, min_area):
    """Via le componenti connesse piccole (grana, aloni): alpha in 0..1."""
    binm = (alpha01 > 0.12).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(binm, 8)
    keep = np.zeros(n, bool); keep[0] = False
    for i in range(1, n): keep[i] = stats[i][4] >= min_area
    return alpha01 * keep[lab]

def warp(im, quad, size):
    """Trasformazione prospettica: i 4 angoli (TL,TR,BR,BL) → rettangolo size (w,h)."""
    w, h = size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    # PIL vuole i coefficienti che mappano DESTINAZIONE → SORGENTE
    A = []
    for (x, y), (u, v) in zip(src, quad):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = np.array([c for p in quad for c in p], dtype=float)
    coeffs = np.linalg.solve(np.array(A, dtype=float), b)
    return im.transform((w, h), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)

def extract_color(model, s, cover):
    """Disegno a colori: alpha = distanza cromatica dal fondo locale (normalizzata sulla grana), RGB = pixel vero."""
    w, h = s['size']
    src = cover.filter(ImageFilter.MedianFilter(s.get('med', 5)))
    a = np.asarray(src).astype(float)
    bgim = src.filter(ImageFilter.GaussianBlur(s['blur'])); bg = np.asarray(bgim).astype(float)
    lab = cv2.cvtColor(np.asarray(src), cv2.COLOR_RGB2LAB).astype(float); labbg = cv2.cvtColor(np.asarray(bgim), cv2.COLOR_RGB2LAB).astype(float)
    dL = labbg[..., 0] - lab[..., 0]                                   # > 0 = più scuro del fondo
    dab = np.sqrt((lab[..., 1] - labbg[..., 1]) ** 2 + (lab[..., 2] - labbg[..., 2]) ** 2)   # cromia diversa
    sigL = max(2.0, float(np.median(np.abs(dL))) * 1.4826); sigab = max(1.0, float(np.median(dab)) * 1.4826)
    if s.get('white'):
        # piastra bianca uniforme: riferimento assoluto (bianco, cromia neutra) invece del fondo locale,
        # così anche le volute larghe restano piene
        dark = np.clip((s['white'] - lab[..., 0]) / s.get('k_w', 30), 0, 1)
        dab0 = np.sqrt((lab[..., 1] - 128) ** 2 + (lab[..., 2] - 128) ** 2)
        chroma = np.clip((dab0 - s.get('thr_c', 10)) / s.get('k_c', 8), 0, 1)
        alpha = np.maximum(dark, chroma)
    else:
        dark = np.clip((dL / sigL - s.get('thr', 2.6)) / s.get('k', 2.0), 0, 1)
    if s.get('white'): pass
    elif s.get('chroma') == 'red':
        # solo ciò che è PIÙ ROSSO del fondo (cuori rossi e rosa su oro): i riflessi chiari dello stesso tono restano fuori
        da = lab[..., 1] - labbg[..., 1]; siga = max(1.0, float(np.median(np.abs(da))) * 1.4826)
        chroma = np.clip((da / siga - s.get('thr_c', 3.0)) / s.get('k_c', 1.5), 0, 1)
    else:
        chroma = np.clip((dab / sigab - s.get('thr_c', s.get('thr', 2.6))) / s.get('k_c', s.get('k', 2.0)), 0, 1)
    if not s.get('white'): alpha = np.maximum(dark, chroma)
    mask = np.zeros((h, w), bool)
    kx0, ky0, kx1, ky1 = s.get('keep', (0, 0, 1, 1)); mask[int(ky0 * h):int(ky1 * h), int(kx0 * w):int(kx1 * w)] = True
    for ex0, ey0, ex1, ey1 in s.get('erase', []): mask[int(ey0 * h):int(ey1 * h), int(ex0 * w):int(ex1 * w)] = False
    if s.get('keep_circle'): mask &= circle_mask(w, h, *s['keep_circle'])
    alpha = alpha * mask
    if s.get('min_area'): alpha = drop_small(alpha, s['min_area'])
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    # colore: tolgo il velo del tessuto (de-matte) e saturo un poco
    alf = np.maximum(np.asarray(al).astype(float) / 255, 1e-3)[..., None]
    rgb = np.clip(bg + (a - bg) / np.maximum(alf, 0.35), 0, 255) if s.get('dematte', True) else a
    from PIL import ImageEnhance
    col = ImageEnhance.Color(Image.fromarray(rgb.astype(np.uint8))).enhance(1.25)
    # RGB a zero dove alpha è zero: il PNG pesa un decimo e la texture non porta grana inutile
    col = Image.fromarray(np.asarray(col) * (np.asarray(al)[..., None] > 0).astype(np.uint8))
    r, g, b = col.split()
    print_png = Image.merge('RGBA', (r, g, b, al))
    if s.get('mono'): print_png = alpha_png(np.asarray(al).astype(float) / 255, w, h)   # solo il tratto: si tinge a runtime
    stones_png = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    print_png.save(os.path.join(OUT, f'{model}-print.png'), optimize=True)
    stones_png.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
    return cover, print_png, stones_png

def place_detail(model, s, pr, st, stones, dw, dh):
    """Il decoro estratto dal dettaglio va nel canvas della copertina: bbox del tratto → larghezza `place[2]`, centro `place[:2]`."""
    w, h = s['size']; cx, cy, pw = s['place']
    a = np.asarray(pr)[..., 3]; ys, xs = np.where(a > 40)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    sc = (pw * w) / max(1, x1 - x0)
    nw, nh = int(dw * sc), int(dh * sc)
    prs = pr.resize((nw, nh), Image.LANCZOS); sts = st.resize((nw, nh), Image.LANCZOS)
    ox = int(cx * w - ((x0 + x1) / 2) * sc); oy = int(cy * h - ((y0 + y1) / 2) * sc)
    P = Image.new('RGBA', (w, h), (0, 0, 0, 0)); P.paste(prs, (ox, oy), prs)
    S = Image.new('RGBA', (w, h), (255, 255, 255, 0)); S.paste(sts, (ox, oy), sts)
    STONES[model] = [(round((sx * sc + ox) / w, 4), round((sy * sc + oy) / h, 4), round(r * sc / w, 4)) for sx, sy, r in stones]
    return P, S

def alpha_png(alpha01, w, h, white=False):
    a = Image.fromarray((np.clip(alpha01, 0, 1) * 255).astype(np.uint8))
    v = 255 if white else 0
    return Image.merge('RGBA', (Image.new('L', (w, h), v), Image.new('L', (w, h), v), Image.new('L', (w, h), v), a))

def apply_mask(alpha, s, w, h):
    mask = np.zeros((h, w), bool)
    kx0, ky0, kx1, ky1 = s.get('keep', (0, 0, 1, 1)); mask[int(ky0 * h):int(ky1 * h), int(kx0 * w):int(kx1 * w)] = True
    for ex0, ey0, ex1, ey1 in s.get('erase', []): mask[int(ey0 * h):int(ey1 * h), int(ex0 * w):int(ex1 * w)] = False
    alpha = alpha * mask
    if s.get('min_area'): alpha = drop_small(alpha, s['min_area'])
    return alpha

def extract_plate(model, s, cover):
    """Piastra bianca intagliata: foro = più scuro del bianco (soglia assoluta), alpha morbida."""
    w, h = s['size']
    g = np.asarray(cover.filter(ImageFilter.MedianFilter(5)).convert('L')).astype(float)
    alpha = np.clip((s.get('white', 205) - g) / s.get('k_w', 22), 0, 1)
    alpha = apply_mask(alpha, s, w, h)
    pr = alpha_png(alpha, w, h).filter(ImageFilter.GaussianBlur(0.6))
    st = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    pr.save(os.path.join(OUT, f'{model}-print.png'), optimize=True); st.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
    STONES[model] = []
    return cover, pr, st

def extract_bright(model, s, src, w, h):
    """Motivo CHIARO sul fondo (damasco Cristalplex): alpha = più chiaro del fondo locale."""
    g = np.asarray(src.convert('L')).astype(float)
    bg = np.asarray(src.convert('L').filter(ImageFilter.GaussianBlur(s['blur']))).astype(float)
    dev = np.abs(g - bg); sigma = max(3.0, float(np.median(dev)) * 1.4826)
    alpha = np.clip(((g - bg) / sigma - s.get('thr', 1.8)) / s.get('print_k', 2.2), 0, 1)
    return alpha

def extract(model, s):
    sheet = (s['page'] + 4) // 2
    im = Image.open(os.path.join(SRC, f's{sheet}-{sheet}.png')).convert('RGB')
    kind = s.get('kind', 'print')
    if kind == 'plate':
        return extract_plate(model, s, warp(im, s['quad'], s['size']))
    if kind == 'strip':
        x0, y0, x1, y1 = s['detail']; det = im.crop((x0, y0, x1, y1)); dw, dh = det.size
        if s.get('white'):
            g = np.asarray(det.filter(ImageFilter.MedianFilter(3)).convert('L')).astype(float)
            pr = alpha_png(np.clip((s['white'] - g) / s.get('k_w', 30), 0, 1), dw, dh)
        else:
            sub = dict(s, size=(dw, dh)); sub.pop('keep', None); sub.pop('erase', None); sub.pop('min_area', None)
            _, pr, _ = extract_masks(model, sub, det, save=False)
        w, h = s['size']; bx0, by0, bx1, by1 = s['band']
        bh = int((by1 - by0) * h); sw = max(1, int(dw * bh / (dh * s.get('stretch_y', 1.0))))
        tile = pr.resize((sw, bh), Image.LANCZOS)
        P = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        x = int(bx0 * w)
        while x < int(bx1 * w): P.paste(tile, (x, int(by0 * h)), tile); x += sw
        a = np.asarray(P)[..., 3].astype(float) / 255; a = apply_mask(a, s, w, h)
        P = alpha_png(a, w, h)
        P.save(os.path.join(OUT, f'{model}-print.png'), optimize=True)
        S = Image.new('RGBA', (w, h), (255, 255, 255, 0)); S.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
        STONES[model] = []
        cover = Image.new('RGB', (w, h), (225, 225, 225)); cover.paste(det.resize((w, int(dh * w / dw))), (0, 0))
        return cover, P, S
    if kind == 'pieces':
        w, h = s['size']; lw, lh = s['lid']
        lid = warp(im, s['quad'], (lw, lh))
        g = np.asarray(lid.filter(ImageFilter.MedianFilter(5)).convert('L')).astype(float)
        thr, k = s['abs_dark']; refL = float(np.median(g))
        alpha = np.clip(((refL - g) - thr) / k, 0, 1)
        for ex0, ey0, ex1, ey1 in s.get('erase_lid', []): alpha[int(ey0 * lh):int(ey1 * lh), int(ex0 * lw):int(ex1 * lw)] = 0
        if s.get('min_area'): alpha = drop_small(alpha, s['min_area'])
        A = Image.fromarray((alpha * 255).astype(np.uint8))
        P = Image.new('L', (w, h), 0)
        for (fx0, fy0, fx1, fy1), anchor, k2 in s['pieces']:
            piece = A.crop((int(fx0 * lw), int(fy0 * lh), int(fx1 * lw), int(fy1 * lh)))
            ph = int((fy1 - fy0) * h * k2); pw = int(piece.size[0] * ph / piece.size[1])
            piece = piece.resize((pw, ph), Image.LANCZOS)
            m = 0.02
            x = int(m * w) if anchor in ('tl', 'bl') else w - pw - int(m * w)
            y = int(m * h) if anchor in ('tl', 'tr') else h - ph - int(m * h)
            P.paste(piece, (x, y), piece)
        a = np.asarray(P).astype(float) / 255
        Pr = alpha_png(a, w, h).filter(ImageFilter.GaussianBlur(0.5))
        Pr.save(os.path.join(OUT, f'{model}-print.png'), optimize=True)
        S = Image.new('RGBA', (w, h), (255, 255, 255, 0)); S.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
        STONES[model] = []
        cover = lid.resize((int(lw * h / lh), h)); bg = Image.new('RGB', (w, h), (200, 200, 200)); bg.paste(cover, (0, 0))
        return bg, Pr, S
    if kind == 'panel':
        w, h = s['size']; px0, py0, px1, py1 = s['panel']
        pw, ph = int((px1 - px0) * w), int((py1 - py0) * h)
        pan = warp(im, s['quad'], (pw, ph))
        alpha = extract_bright(model, s, pan.filter(ImageFilter.MedianFilter(3)), pw, ph)
        A = np.zeros((h, w)); A[int(py0 * h):int(py0 * h) + ph, int(px0 * w):int(px0 * w) + pw] = alpha
        A = apply_mask(A, s, w, h)
        P = alpha_png(A, w, h, white=True).filter(ImageFilter.GaussianBlur(0.5))
        P.save(os.path.join(OUT, f'{model}-print.png'), optimize=True)
        S = Image.new('RGBA', (w, h), (255, 255, 255, 0)); S.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
        STONES[model] = []
        cover = Image.new('RGB', (w, h), (120, 130, 100)); cover.paste(pan, (int(px0 * w), int(py0 * h)))
        return cover, P, S
    if s.get('detail'):
        x0, y0, x1, y1 = s['detail']; det = im.crop((x0, y0, x1, y1)); dw, dh = det.size
        sub = dict(s, size=(dw, dh)); sub.pop('keep', None); sub.pop('erase', None)
        _, pr, st = extract_masks(model, sub, det, save=False)
        pr, st = place_detail(model, s, pr, st, STONES.get(model, []), dw, dh)
        pr.save(os.path.join(OUT, f'{model}-print.png'), optimize=True); st.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
        cover = Image.new('RGB', s['size'], (200, 200, 200)); cover.paste(det.resize((int(dw * (pw := s['place'][2]) * s['size'][0] / max(1, dw)), int(dh * pw * s['size'][0] / max(1, dw)))), (0, 0))
        return cover, pr, st
    cover = warp(im, s['quad'], s['size'])
    if s.get('color'): return extract_color(model, s, cover)
    return extract_masks(model, s, cover, save=True)

def extract_masks(model, s, cover, save=True):
    g = np.asarray(cover.convert('L')).astype(float)
    bg = np.asarray(cover.convert('L').filter(ImageFilter.GaussianBlur(s['blur']))).astype(float)
    # deviazione locale della grana: normalizzo così tessuti diversi danno soglie simili
    dev = np.abs(g - bg); sigma = max(4.0, float(np.median(dev)) * 1.4826)
    thr = s.get('thr', 2.0)
    if s.get('white'):   # fondo bianco uniforme (Cristalwhite): soglia assoluta, niente fondo locale
        dark = np.clip((s['white'] - g) / s.get('k_w', 30), 0, 1) * 255
    else:
        dark = np.clip((bg - g) / sigma - thr, 0, None) * (255 / s['print_k']) ; dark = np.clip(dark, 0, 255)
    bright = np.clip((g - bg) / sigma - s.get('stone_thr', thr + 0.6), 0, None) * (255 / s['stone_k']); bright = np.clip(bright, 0, 255)
    w, h = s['size']
    # area da tenere (il disegno) e zone da cancellare (nomi di esempio, bordi)
    mask = np.zeros((h, w), bool)
    kx0, ky0, kx1, ky1 = s.get('keep', (0, 0, 1, 1)); mask[int(ky0 * h):int(ky1 * h), int(kx0 * w):int(kx1 * w)] = True
    for ex0, ey0, ex1, ey1 in s.get('erase', []): mask[int(ey0 * h):int(ey1 * h), int(ex0 * w):int(ex1 * w)] = False
    if s.get('keep_circle'): mask &= circle_mask(w, h, *s['keep_circle'])
    dark = dark * mask; bright = bright * mask
    if s.get('min_area'): dark = drop_small(dark / 255, s['min_area']) * 255
    pr = Image.fromarray(dark.astype(np.uint8)); st = Image.fromarray(bright.astype(np.uint8))
    # pulizia: mediana 5 (toglie la grana, tiene tratti ≥ 3 px), poi un velo di morbidezza
    pr = pr.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.6))
    # i cristalli: componenti connesse compatte della maschera «chiaro» (né aloni né bordi) → centri + raggio
    st_bin = (np.asarray(st.filter(ImageFilter.MedianFilter(3))) > 90).astype(np.uint8)
    n, lab, stats, cents = cv2.connectedComponentsWithStats(st_bin, 8)
    stones = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < s.get('stone_min', 25) or area > 2500: continue
        if max(bw, bh) / max(1, min(bw, bh)) > 2.2: continue
        r = float(np.sqrt(area / np.pi)) * 1.15
        stones.append((float(cents[i][0]), float(cents[i][1]), r))
    stones_png = Image.new('RGBA', (w, h), (255, 255, 255, 0)); sd = ImageDraw.Draw(stones_png)
    for cx, cy, r in stones:
        sd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 235))
        sd.ellipse((cx - r * 0.45, cy - r * 0.55, cx + r * 0.15, cy + r * 0.05), fill=(255, 255, 255, 255))
    stones_png = stones_png.filter(ImageFilter.GaussianBlur(0.7))
    print_png = Image.merge('RGBA', (Image.new('L', (w, h), 0), Image.new('L', (w, h), 0), Image.new('L', (w, h), 0), pr))
    if save:
        print_png.save(os.path.join(OUT, f'{model}-print.png'), optimize=True)
        stones_png.save(os.path.join(OUT, f'{model}-stones.png'), optimize=True)
        STONES[model] = [(round(cx / w, 4), round(cy / h, 4), round(r / w, 4)) for cx, cy, r in stones]
    else:
        STONES[model] = [(cx, cy, r) for cx, cy, r in stones]      # in px del dettaglio: li colloca place_detail
    return cover, print_png, stones_png

def check(model, cover, pr, st):
    w, h = cover.size
    sheet = Image.new('RGB', (w * 3 + 40, h + 60), (235, 228, 214)); d = ImageDraw.Draw(sheet)
    sheet.paste(cover, (10, 50))
    color = pr.getextrema()[0] != (0, 0) and pr.getextrema()[0] != (255, 255)   # stampa a colori: incollo l'RGB vero
    if pr.getextrema()[0] == (255, 255): pr = Image.merge('RGBA', (Image.new('L', pr.size, 60), Image.new('L', pr.size, 60), Image.new('L', pr.size, 60), pr.split()[3]))   # motivo chiaro: lo mostro scuro sul chiaro
    base = Image.new('RGB', (w, h), (230, 224, 210)); base.paste(pr.convert('RGB') if color else Image.new('RGB', (w, h), (40, 30, 20)), (0, 0), pr); base.paste(Image.new('RGB', (w, h), (255, 255, 255)), (0, 0), st)
    sheet.paste(base, (w + 20, 50))
    cov = Image.new('RGB', (w, h), (30, 60, 90)); cov.paste(pr.convert('RGB') if color else Image.new('RGB', (w, h), (230, 230, 230)), (0, 0), pr); cov.paste(Image.new('RGB', (w, h), (255, 255, 255)), (0, 0), st)
    sheet.paste(cov, (2 * w + 30, 50))
    d.text((10, 14), f'{model}: raddrizzata · tratto+cristalli su chiaro · su scuro', fill=(40, 30, 20))
    sheet.save(os.path.join(CHECK, f'{model}.png'))

args = [a for a in sys.argv[2:] if not a.startswith('--')]
manifest = {}
for model, s in SPEC.items():
    if args and model not in args: continue
    cover, pr, st = extract(model, s)
    manifest[model] = dict(kind=s.get('kind', 'print'), tint=s.get('tint', 'ink'), size=s['size'], names=s['names'], color=bool(s.get('color')) and not s.get('mono'), print=f'/album-decor/{model}-print.png', stones=(f'/album-decor/{model}-stones.png' if STONES.get(model) else None), stonesXY=STONES.get(model, []))
    if '--check' in sys.argv: check(model, cover, pr, st)
    print(model, s['size'])
mp = os.path.join(OUT, 'manifest.json')
old = json.load(open(mp)) if os.path.exists(mp) else {}
old.update(manifest); json.dump(old, open(mp, 'w'), indent=1)
print(len(old), 'decori in manifest')
ts = os.path.join(FE, 'src', 'components', 'album', 'glb', 'decor.generated.ts')
lines = ['// GENERATO da scripts/album-swatches/extract-decor.py — decori per famiglia di modello, dalle tavole del catalogo.',
         '// print: PNG (alpha del tratto, si tinge a runtime se !color; RGBA vero se color); stones: PNG dei cristalli; stonesXY: centri (frazioni).',
         "export type DecorNames = { x: number; y: number; align?: 'left' | 'right' | 'center' }",
         "/** kind: 'print' = stampa/laser sul tessuto · 'plate' = piastra Cristalwhite intagliata (alpha = fori) · 'strip' = fascia stampata · 'panel' = pannello Cristalplex; tint 'white' = motivo sempre chiaro */",
         "export type Decor = { kind: 'print' | 'plate' | 'strip' | 'panel'; tint: 'ink' | 'white'; size: [number, number]; names: DecorNames | { split: [DecorNames, DecorNames] }; color: boolean; print: string; stones: string | null; stonesXY: [number, number, number][] }",
         'export const DECOR: Record<string, Decor> = ' + json.dumps({k: dict(kind=v.get('kind', 'print'), tint=v.get('tint', 'ink'), size=v['size'], names=v['names'], color=v['color'], print=v['print'], stones=v['stones'], stonesXY=v.get('stonesXY', [])) for k, v in sorted(old.items())}, separators=(',', ':')).replace('"', "'") + '',
         'export const decorOf = (family?: string | null): Decor | undefined => (family ? DECOR[family] : undefined)', '']
open(ts, 'w').write('\n'.join(lines)); print('→', ts)
