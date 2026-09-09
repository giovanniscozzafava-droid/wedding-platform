#!/usr/bin/env python3
"""Estrae gli ORNAMENTI dei loghi del catalogo (pag. 34–37) dai ritagli a 300 dpi:
cancella le zone del testo campione (logoZones.json) e la sigla «cod.NN», poi
- ornamenti monocromi: luminanza → alpha (il colore lo dà l'inchiostro a runtime)
- ornamenti a colori (ghirlande 37–48): colori originali, alpha dalla non-bianchezza
→ frontend/public/album-logos/<code>.png (+ un foglio di controllo con i nomi di prova).

uso: python3 extract-logo-ornaments.py <cartella logos300> [--check]
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FE = os.path.join(HERE, '..', '..', 'frontend')
ZONES = json.load(open(os.path.join(FE, 'src', 'components', 'album', 'glb', 'logoZones.json')))
SRC = sys.argv[1]
OUT = os.path.join(FE, 'public', 'album-logos'); os.makedirs(OUT, exist_ok=True)
CHECK = os.path.join(os.path.dirname(SRC), 'logos-ornaments-check'); os.makedirs(CHECK, exist_ok=True)

def extract(code, t):
    im = Image.open(os.path.join(SRC, f'{code}.png')).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(np.int16)
    keep = np.ones((H, W), bool)
    # via la sigla cod.NN (in alto a destra) e le zone del testo (con un po' di margine)
    keep[0:int(H * 0.17), int(W * 0.68):] = False
    for z in t['zones']:
        pad = 0.012
        x0, y0 = int((z['x'] - pad) * W), int((z['y'] - pad) * H)
        x1, y1 = int((z['x'] + z['w'] + pad) * W), int((z['y'] + z['h'] + pad) * H)
        keep[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = False
    rgb = a[:, :, :3]
    if t.get('ornamentKeepsColor'):
        # alpha dalla distanza dal bianco (watermark chiarissimo escluso)
        dist = 255 - rgb.min(axis=2)
        alpha = np.clip((dist - 22) * 3, 0, 255).astype(np.uint8)
        out = np.dstack([rgb.astype(np.uint8), alpha * keep])
    else:
        lum = (rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114)
        alpha = np.clip((222 - lum) * 255 / 222, 0, 255).astype(np.uint8)   # grigio del watermark (≥ 222) → 0
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        # gli elementi COLORATI (cuore rosso, rombo rosso, & dorata) restano col loro colore; il nero → bianco (si tinge a runtime)
        colored = sat > 60
        base = np.where(colored[:, :, None], rgb, 255).astype(np.uint8)
        alpha = np.where(colored, np.clip(sat * 2, 0, 255), alpha).astype(np.uint8)
        out = np.dstack([base, alpha * keep])
    png = Image.fromarray(out, 'RGBA')
    # rifilo trasparente per ridurre il file, ma conservo le proporzioni del riquadro: NON rifilo (le zone sono relative al riquadro)
    png.save(os.path.join(OUT, f'{code}.png'), optimize=True)
    return png

def check_sheet(items):
    cols, cw, ch = 4, 420, 380
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (235, 228, 214)); d = ImageDraw.Draw(sheet)
    for i, (code, png, t) in enumerate(items):
        x, y = (i % cols) * cw + 10, (i // cols) * ch + 26
        th = png.copy(); th.thumbnail((cw - 20, ch - 40))
        sheet.paste(th, (x, y), th)
        d.text((x, y - 18), f"{code} · {t.get('note', '')} · {t['fidelity']}", fill=(40, 30, 20))
        # zone del testo
        for z in t['zones']:
            d.rectangle((x + z['x'] * th.width, y + z['y'] * th.height, x + (z['x'] + z['w']) * th.width, y + (z['y'] + z['h']) * th.height), outline=(220, 40, 90))
    sheet.save(os.path.join(CHECK, '_ornamenti.png'))

items = []
for code, t in ZONES.items():
    if code == '_' or not isinstance(t, dict): continue
    if not t.get('ornament'):
        continue
    if not os.path.exists(os.path.join(SRC, f'{code}.png')): print('manca', code); continue
    png = extract(code, t); items.append((code, png, t))
    print(code, png.size)
if '--check' in sys.argv: check_sheet(items)
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(len(items), 'ornamenti ·', round(tot / 1024), 'KB')
