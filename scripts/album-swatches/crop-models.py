#!/usr/bin/env python3
"""Tessere dei MODELLI dal catalogo DesignAlbum 2022: su ogni pagina le foto degli album sono
pannelli rettangolari separati da bordi/canali bianchi. Taglio XY ricorsivo sul bianco →
pannelli; un foglio di controllo per pagina con gli indici; MODEL_SPEC dice, per famiglia,
(pagina, indice del pannello) → models/<famiglia>.jpg.

uso: python3 crop-models.py survey [pagine...]   → fogli di controllo in models-check/
     python3 crop-models.py                       → ritaglia secondo MODEL_SPEC in swatches-out/models/
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

S = os.path.dirname(os.path.abspath(__file__))
HIRES = os.path.join(S, 'hires')
OUT = os.path.join(S, 'swatches-out', 'models')
CHECK = os.path.join(S, 'models-check')
os.makedirs(OUT, exist_ok=True); os.makedirs(CHECK, exist_ok=True)

def sheet_of(page): return (page + 4) // 2
def load_half(page):
    s = sheet_of(page)
    im = Image.open(os.path.join(HIRES, f's{s}-{s:02d}.png')).convert('RGB')
    W, H = im.size
    return im.crop((0, 0, W // 2, H) if page % 2 == 0 else (W // 2, 0, W, H))

def runs(mask1d, min_len=1):
    idx = np.flatnonzero(mask1d)
    if idx.size == 0: return []
    out, a, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i != prev + 1:
            if prev - a + 1 >= min_len: out.append((a, prev + 1))
            a = i
        prev = i
    if prev - a + 1 >= min_len: out.append((a, prev + 1))
    return out

def xy_cut(nonwhite, x1, y1, x2, y2, depth=0, min_gap=6):
    """Divide la regione lungo righe/colonne interamente bianche (spesse ≥ min_gap)."""
    sub = nonwhite[y1:y2, x1:x2]
    if sub.size == 0: return []
    rows = sub.any(axis=1); cols = sub.any(axis=0)
    # rifilo il bianco ai bordi
    rr = runs(rows); cc = runs(cols)
    if not rr or not cc: return []
    ny1, ny2 = y1 + rr[0][0], y1 + rr[-1][1]; nx1, nx2 = x1 + cc[0][0], x1 + cc[-1][1]
    if (ny1, ny2, nx1, nx2) != (y1, y2, x1, x2): return xy_cut(nonwhite, nx1, ny1, nx2, ny2, depth)
    if depth > 6: return [(x1, y1, x2, y2)]
    # canali bianchi orizzontali
    gaps = runs(~rows, min_len=min_gap)
    if gaps:
        out, prev = [], 0
        for a, b in gaps:
            if a > prev: out += xy_cut(nonwhite, x1, y1 + prev, x2, y1 + a, depth + 1)
            prev = b
        if prev < y2 - y1: out += xy_cut(nonwhite, x1, y1 + prev, x2, y2, depth + 1)
        return out
    gaps = runs(~cols, min_len=min_gap)
    if gaps:
        out, prev = [], 0
        for a, b in gaps:
            if a > prev: out += xy_cut(nonwhite, x1 + prev, y1, x1 + a, y2, depth + 1)
            prev = b
        if prev < x2 - x1: out += xy_cut(nonwhite, x1 + prev, y1, x2, y2, depth + 1)
        return out
    return [(x1, y1, x2, y2)]

def panels(page, min_size=220):
    im = load_half(page); a = np.asarray(im)
    nonwhite = a.min(axis=2) < 238
    H, W = nonwhite.shape
    boxes = xy_cut(nonwhite, 0, 0, W, H)
    boxes = [b for b in boxes if b[2] - b[0] >= min_size and b[3] - b[1] >= min_size]
    boxes.sort(key=lambda b: (round(b[1] / 120), b[0]))     # ordine di lettura
    return im, boxes

def survey(pages):
    for p in pages:
        try: im, boxes = panels(p)
        except FileNotFoundError: print('manca la tavola per pag.', p); continue
        d = ImageDraw.Draw(im)
        for i, b in enumerate(boxes):
            d.rectangle(b, outline=(255, 0, 0), width=6)
            d.rectangle((b[0], b[1], b[0] + 70, b[1] + 44), fill=(255, 0, 0)); d.text((b[0] + 8, b[1] + 8), str(i), fill='white')
        im = im.resize((im.width // 2, im.height // 2))
        im.save(os.path.join(CHECK, f'p{p:03d}.png'))
        print(f'pag. {p}: {len(boxes)} pannelli')

# famiglia → (pagina stampata, riquadro nelle coordinate del foglio di controllo = metà della risoluzione)
MODEL_SPEC = {
  'brand': (4, (0, 60, 528, 700)), 'diez': (6, (0, 90, 590, 700)), 'trilogy': (6, (608, 45, 968, 340)),
  'vega': (6, (608, 375, 968, 690)), 'cassiopea': (7, (40, 45, 395, 355)), 'elsie': (7, (40, 362, 395, 670)),
  'andromeda': (7, (400, 0, 1000, 700)), 'almond': (8, (0, 0, 600, 700)), 'comete': (8, (610, 50, 970, 355)),
  'claire': (9, (0, 100, 1000, 700)), 'thea': (10, (0, 0, 600, 700)), 'adel': (11, (400, 0, 1000, 700)),
  'personalizzato': (13, (400, 0, 1000, 700)), 'betulla': (20, (0, 0, 530, 700)), 'dream': (22, (0, 60, 1000, 700)),
  'amelie': (38, (0, 60, 1000, 700)), 'darling': (40, (355, 45, 745, 360)), 'sirene': (42, (0, 100, 1000, 700)),
  'frejus': (44, (50, 350, 540, 680)), 'dhyana': (46, (0, 0, 665, 700)), 'chloe': (50, (0, 0, 665, 700)),
  'graphic': (52, (0, 0, 1000, 700)), 'charme': (54, (0, 60, 1000, 700)), 'ghost': (55, (40, 45, 520, 360)),
  'clouds': (55, (40, 370, 520, 680)), 'ikon': (55, (530, 45, 965, 680)), 'azulejo': (56, (0, 0, 760, 700)),
  'hera': (58, (0, 0, 675, 700)), 'julies': (60, (0, 0, 1000, 700)), 'canvas': (62, (50, 45, 680, 680)),
  'frame': (70, (50, 45, 650, 435)), 'xante': (80, (0, 0, 1000, 700)), 'bouquet': (82, (50, 45, 520, 355)),
  'ninfea': (84, (0, 0, 1000, 700)), 'plaza': (94, (0, 0, 1000, 700)),
}

def build():
    manifest = {}
    tiles = []
    for fam, (page, box) in MODEL_SPEC.items():
        im = load_half(page)
        b = tuple(min(v * 2, lim) for v, lim in zip(box, (im.width, im.height, im.width, im.height)))
        crop = im.crop(b)
        if crop.width > 640: crop = crop.resize((640, round(crop.height * 640 / crop.width)), Image.LANCZOS)
        fn = f'{fam}.jpg'; crop.save(os.path.join(OUT, fn), 'JPEG', quality=86, optimize=True)
        manifest[f'model:{fam}'] = f'models/{fn}'
        tiles.append((fam, page, crop))
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    # foglio di controllo di tutte le tessere
    cols, cw, ch = 6, 320, 260
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), 'white'); d = ImageDraw.Draw(sheet)
    for i, (fam, page, crop) in enumerate(tiles):
        t = crop.copy(); t.thumbnail((cw - 16, ch - 40))
        x, y = (i % cols) * cw + 8, (i // cols) * ch + 8
        sheet.paste(t, (x, y)); d.text((x, y + ch - 30), f'{fam} · pag. {page}', fill='black')
    sheet.save(os.path.join(CHECK, '_tessere-modelli.png'))
    print(len(manifest), 'tessere modello')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'survey':
        pages = [int(x) for x in sys.argv[2:]] or list(range(4, 96))
        survey(pages)
    else:
        build()
