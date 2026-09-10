#!/usr/bin/env python3
"""DAI CAMPIONI DEL CATALOGO ALLE SUPERFICI DEL 3D.

Ogni tinta del catalogo è fotografata sulle tavole 115–127 e già ritagliata in
`public/album-swatches/<materiale>/<colore>.jpg` (crop-swatches.py). Finora il 3D
usava un elenco di colori scritto a mano — sfalsato rispetto ai ritagli: la Moka
del Safir usciva bianca, il Rosa del Metal blu notte. E la superficie era una
texture generica di libreria, tinta: da qui l'aria «da videogioco».

Questo script prende il ritaglio VERO e ne ricava due cose:
  1. il COLORE (mediana della zona pulita, senza la scritta stampata sopra),
  2. una TEXTURE RIPETIBILE con la grana vera del tessuto:
     - si isola la zona pulita del ritaglio,
     - si toglie l'illuminazione della fotografia (si divide per una sfocatura
       larga: resta solo la trama, non l'ombra del faretto della foto),
     - si riporta la media al colore vero,
     - si specchia in un 2×2 così i bordi combaciano e la ripetizione non si vede.

Uscita:
  public/textures/album-swatch/<materiale>/<colore>.jpg   (512×512, ripetibile)
  frontend/src/components/album/glb/materialSwatch.generated.ts

Uso:  python3 scripts/album-swatches/gen-material-textures.py
"""
import json
import os
import re

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'frontend', 'public', 'album-swatches')
OUT = os.path.join(ROOT, 'frontend', 'public', 'textures', 'album-swatch')
TS = os.path.join(ROOT, 'frontend', 'src', 'components', 'album', 'glb', 'materialSwatch.generated.ts')
TILE = 256          # mezzo lato: il file finale è 512×512 (2×2 specchiato)


def zona_pulita(im: Image.Image) -> Image.Image:
    """La parte del ritaglio senza la scritta del catalogo (di solito in basso a destra)."""
    w, h = im.size
    return im.crop((int(w * 0.04), int(h * 0.06), int(w * 0.58), int(h * 0.82)))


def mediana(im: Image.Image) -> tuple:
    px = list(im.resize((32, 32)).getdata())
    return tuple(sorted(p[i] for p in px)[len(px) // 2] for i in range(3))


def senza_luce(im: Image.Image, colore: tuple) -> Image.Image:
    """Toglie il gradiente di luce della fotografia: resta la trama, non l'ombra."""
    base = im.filter(ImageFilter.GaussianBlur(radius=max(im.size) * 0.22))
    out = Image.new('RGB', im.size)
    p_im, p_bs, p_out = im.load(), base.load(), out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = p_im[x, y]
            br, bg, bb = p_bs[x, y]
            p_out[x, y] = (
                max(0, min(255, int(r * colore[0] / max(br, 1)))),
                max(0, min(255, int(g * colore[1] / max(bg, 1)))),
                max(0, min(255, int(b * colore[2] / max(bb, 1)))),
            )
    return out


def ripetibile(im: Image.Image) -> Image.Image:
    """2×2 specchiato: i bordi combaciano sempre, la ripetizione non si legge."""
    q = im.resize((TILE, TILE), Image.LANCZOS)
    out = Image.new('RGB', (TILE * 2, TILE * 2))
    out.paste(q, (0, 0))
    out.paste(q.transpose(Image.FLIP_LEFT_RIGHT), (TILE, 0))
    out.paste(q.transpose(Image.FLIP_TOP_BOTTOM), (0, TILE))
    out.paste(q.transpose(Image.ROTATE_180), (TILE, TILE))
    return out


# solo i materiali del catalogo: le cartelle «logo» e «models» sono altri ritagli
MATERIALI = ('wood', 'alcantara', 'sequoia', 'acero', 'pelle', 'velu-arte', 'soft-touch',
             'suade', 'safir', 'crazy', 'juta', 'metal', 'skill', 'cristalwhite', 'cristalplex')
voci = {}
for mat in sorted(os.listdir(SRC)):
    d = os.path.join(SRC, mat)
    if not os.path.isdir(d) or mat not in MATERIALI:
        continue
    os.makedirs(os.path.join(OUT, mat), exist_ok=True)
    for f in sorted(os.listdir(d)):
        if not re.search(r'\.(jpg|jpeg|png)$', f, re.I):
            continue
        nome = os.path.splitext(f)[0]
        im = Image.open(os.path.join(d, f)).convert('RGB')
        pulita = zona_pulita(im)
        col = mediana(pulita)
        tex = ripetibile(senza_luce(pulita, col))
        rel = f'/textures/album-swatch/{mat}/{nome}.jpg'
        tex.save(os.path.join(OUT, mat, f'{nome}.jpg'), quality=88, optimize=True)
        voci[f'{mat}:{nome}'] = {'hex': '#%02x%02x%02x' % col, 'tex': rel}
        print(f'{mat}:{nome:22s} {voci[f"{mat}:{nome}"]["hex"]}')

with open(TS, 'w') as fh:
    fh.write('// GENERATO da scripts/album-swatches/gen-material-textures.py — NON modificare a mano.\n')
    fh.write('// Colore e grana VERI di ogni tinta, presi dal campione fotografato sul catalogo\n')
    fh.write('// (tavole 115–127): il colore è la mediana della zona pulita del ritaglio, la texture è\n')
    fh.write('// la stessa zona senza l\'illuminazione della foto, specchiata 2×2 per ripetersi senza giunte.\n')
    fh.write('export type MaterialSwatch = { hex: string; tex: string }\n')
    fh.write('export const MATERIAL_SWATCH: Record<string, MaterialSwatch> = ')
    fh.write(json.dumps(voci, indent=1, ensure_ascii=False))
    fh.write(' as const\n')
print(f'\n{len(voci)} tinte → {TS}')
