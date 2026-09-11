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
from swatchtile import SIDE  # noqa: E402


from swatchtile import maschera_scritta, zona_pulita, mediana, senza_luce, illuminazione_piatta, ripetibile, rilievo  # noqa: E402

# solo i materiali del catalogo: le cartelle «logo» e «models» sono altri ritagli
MATERIALI = ('wood', 'alcantara', 'sequoia', 'acero', 'pelle', 'velu-arte', 'soft-touch',
             'suade', 'safir', 'crazy', 'juta', 'metal', 'skill', 'cristalwhite', 'cristalplex')
voci = {}
rilievi = {}
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
        # il rilievo si ricava UNA VOLTA per materiale (la trama è la stessa, cambia solo la tinta):
        # si sceglie il campione di luminosità media, dove la grana si legge meglio
        lum = sum(col) / 3
        if mat not in rilievi or abs(lum - 128) < abs(rilievi[mat][0] - 128):
            rilievi[mat] = (lum, tex)
        print(f'{mat}:{nome:22s} {voci[f"{mat}:{nome}"]["hex"]}')

for mat, (_, tex) in rilievi.items():
    nor, rou = rilievo(tex)
    nor.save(os.path.join(OUT, mat, '_normal.jpg'), quality=88, optimize=True)
    rou.save(os.path.join(OUT, mat, '_rough.jpg'), quality=85, optimize=True)
    print(f'rilievo {mat}')

with open(TS, 'w') as fh:
    fh.write('// GENERATO da scripts/album-swatches/gen-material-textures.py — NON modificare a mano.\n')
    fh.write('// Colore e grana VERI di ogni tinta, presi dal campione fotografato sul catalogo\n')
    fh.write('// (tavole 115–127): il colore è la mediana della zona pulita del ritaglio, la texture è\n')
    fh.write('// la stessa zona senza l\'illuminazione della foto, specchiata 2×2 per ripetersi senza giunte.\n')
    fh.write('export type MaterialSwatch = { hex: string; tex: string }\n')
    fh.write('export const MATERIAL_SWATCH: Record<string, MaterialSwatch> = ')
    fh.write(json.dumps(voci, indent=1, ensure_ascii=False))
    fh.write(' as const\n\n')
    fh.write('// Il RILIEVO vero della grana, ricavato dal campione: uno per materiale (la trama non\n')
    fh.write('// cambia con la tinta). Sostituisce le mappe generiche di libreria.\n')
    fh.write('export const MATERIAL_RELIEF: Record<string, { normal: string; rough: string }> = ')
    fh.write(json.dumps({m: {'normal': f'/textures/album-swatch/{m}/_normal.jpg', 'rough': f'/textures/album-swatch/{m}/_rough.jpg'} for m in rilievi}, indent=1, ensure_ascii=False))
    fh.write(' as const\n')
print(f'\n{len(voci)} tinte → {TS}')
