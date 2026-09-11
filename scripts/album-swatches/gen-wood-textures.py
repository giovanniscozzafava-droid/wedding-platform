#!/usr/bin/env python3
"""LE ESSENZE DEL LEGNO dalle tavole del catalogo (linea Pelle di legno, tavola 4 = pag. 4–5).

Prima il 3D usava sei texture generiche: noce, rovere, okumè e ulivo erano la STESSA immagine, la
moka era una foto col bordo bianco. Cliccando un modello in legno la nuance non era mai quella
del catalogo. Qui ogni essenza viene ritagliata dalla copertina fotografata sulla tavola, la
venatura viene raddrizzata, si toglie la luce del set e si rigenera dallo spettro (piastrella
periodica, senza giunte). La Moka non ha una foto sulle tavole 4–5: si ricava dal Noce
scurito fino alla tinta del listino.

Uso:  python3 scripts/album-swatches/gen-wood-textures.py   (serve legno/s4-04.png a 300 dpi)
"""
import os
import numpy as np
from PIL import Image
from swatchtile import senza_luce, mediana, ripetibile, illuminazione_piatta, rilievo

S = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(S))
OUT = os.path.join(ROOT, 'frontend', 'public', 'textures', 'wood')
os.makedirs(OUT, exist_ok=True)
im = Image.open(os.path.join(S, 'legno', 's4-04.png')).convert('RGB')
k = im.size[0] / 2000  # le coordinate sotto sono lette sulla vista a 2000 px

# (regione sulla vista, sotto-regione pulita in frazioni, rotazione per raddrizzare la venatura)
SPEC = {
    'noce':     ((60, 380, 420, 520),   (0.00, 0.00, 0.62, 0.45), 17),
    'ciliegio': ((610, 235, 900, 330),  (0.04, 0.04, 0.36, 0.42), -35),
    'okume':    ((770, 480, 880, 610),  (0.02, 0.05, 0.84, 0.98), -20),
    'rovere':   ((1090, 520, 1250, 640), (0.14, 0.00, 0.50, 0.45), -25),
    'ulivo':    ((1560, 420, 1800, 600), (0.55, 0.04, 0.96, 0.50), 42),
}
tiles = {}
for n, ((x0, y0, x1, y1), (fx0, fy0, fx1, fy1), ang) in SPEC.items():
    c = im.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
    w, h = c.size
    c = c.crop((int(w * fx0), int(h * fy0), int(w * fx1), int(h * fy1)))
    r = c.rotate(ang, resample=Image.BICUBIC, expand=False)
    W, H = r.size; s = int(min(W, H) * 0.62)
    q = r.crop(((W - s) // 2, (H - s) // 2, (W - s) // 2 + s, (H - s) // 2 + s))
    col = mediana(q)
    tile = illuminazione_piatta(ripetibile(senza_luce(q, col)))
    tiles[n] = tile
    tile.save(os.path.join(OUT, f'{n}.jpg'), quality=90, optimize=True)
    print(f'{n:9s} #{col[0]:02x}{col[1]:02x}{col[2]:02x}  da {q.size[0]} px')

# MOKA: il noce portato alla tinta del listino (#4a3526), stessa venatura
target = np.array([0x4a, 0x35, 0x26], dtype=np.float32)
a = np.asarray(tiles['noce'], dtype=np.float32)
media = a.mean(axis=(0, 1))
moka = np.clip(a * (target / np.maximum(media, 1))[None, None, :], 0, 255).astype('uint8')
Image.fromarray(moka).save(os.path.join(OUT, 'moka.jpg'), quality=90, optimize=True)
print('moka      dal noce, tinta del listino')

# il rilievo del legno: uno solo, dal noce (la venatura più leggibile)
nor, rou = rilievo(tiles['noce'])
nor.save(os.path.join(OUT, '_normal.jpg'), quality=88); rou.save(os.path.join(OUT, '_rough.jpg'), quality=85)
print('rilievo dal noce →', OUT)
