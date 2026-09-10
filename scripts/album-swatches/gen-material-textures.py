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
SIDE = 512          # lato della piastrella finale


def maschera_scritta(im: Image.Image):
    """Dove sta la scritta stampata sul campione (TRIFOGLIO, CREMA…): i caratteri sono pixel che si
    scostano molto dalla mediana del loro intorno, la trama no."""
    import numpy as np
    med = im.filter(ImageFilter.MedianFilter(15))
    a = np.asarray(im, dtype=np.float32)
    m = np.asarray(med, dtype=np.float32)
    d = np.abs(a - m).mean(axis=2)
    mad = float(np.median(np.abs(d - np.median(d)))) or 1.0
    soglia = max(10.0, float(np.median(d)) + 4.0 * mad)
    masc = Image.fromarray(((d > soglia) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))
    return np.asarray(masc, dtype=np.float32) / 255, m


def zona_pulita(im: Image.Image) -> Image.Image:
    """Il quadrato di tessuto PULITO più grande che si trova nel ritaglio: si cerca la finestra con
    meno scritta dentro (integrale della maschera), poi si ricuce quel poco che resta."""
    import numpy as np
    w, h = im.size
    im = im.crop((int(w * 0.03), int(h * 0.05), int(w * 0.97), int(h * 0.9)))
    w, h = im.size
    masc, med = maschera_scritta(im)
    lato = max(24, int(min(h, w) * 0.98))
    ii = np.pad(masc, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    best, bx, by = 1e9, 0, 0
    for y in range(0, h - lato + 1, 4):
        for x in range(0, w - lato + 1, 4):
            tot = ii[y + lato, x + lato] - ii[y, x + lato] - ii[y + lato, x] + ii[y, x]
            if tot < best:
                best, bx, by = tot, x, y
    a = np.asarray(im, dtype=np.float32)
    k = masc[..., None]
    ricucita = Image.fromarray(np.clip(a * (1 - k) + med * k, 0, 255).astype('uint8'))
    return ricucita.crop((bx, by, bx + lato, by + lato))


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


def illuminazione_piatta(tile: Image.Image) -> Image.Image:
    """Toglie ogni dislivello di luce RESIDUO dalla piastrella, senza rompere la ciclicità: la
    sfocatura si calcola su un 3×3 della piastrella (così è periodica anch'essa) e si divide. Senza
    questo passaggio restano scalini di luminosità che, ripetuti, si leggono come riquadri."""
    import numpy as np
    S = tile.size[0]
    grande = Image.new('RGB', (S * 3, S * 3))
    for i in range(3):
        for j in range(3):
            grande.paste(tile, (S * i, S * j))
    sfoc = grande.filter(ImageFilter.GaussianBlur(S / 5)).crop((S, S, S * 2, S * 2))
    a = np.asarray(tile, dtype=np.float32)
    b = np.asarray(sfoc, dtype=np.float32)
    media = a.mean(axis=(0, 1))
    out = a / np.maximum(b, 1) * media[None, None, :]
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))


def ripetibile(im: Image.Image) -> Image.Image:
    """Piastrella SENZA GIUNTE, SENZA LINEE E SENZA BLOCCHI.

    Unire quadrati (a specchio o cuciti) lascia sempre una riga, e la riga ripetuta disegna una
    croce; anche la dissolvenza incrociata lascia riquadri, perché mescola quattro copie. Qui la
    trama si RIGENERA: si tiene lo spettro del campione (cioè la sua grana: quanto è fitta, in che
    direzione corre, quanto è contrastata) e si randomizzano le fasi. Il risultato ha la stessa
    grana del tessuto vero, è periodico per costruzione — la trasformata di Fourier lavora su un
    piano che si ripete — e quindi si ripete all'infinito senza un solo bordo."""
    import numpy as np
    a = np.asarray(im.resize((SIDE, SIDE), Image.LANCZOS), dtype=np.float32)
    rng = np.random.default_rng(7)
    # una sola nube di fasi per tutti e tre i canali: colori e trama restano allineati
    fase = np.angle(np.fft.fft2(rng.standard_normal((SIDE, SIDE))))
    out = np.empty_like(a)
    for c in range(3):
        F = np.fft.fft2(a[..., c])
        media = F[0, 0]
        G = np.abs(F) * np.exp(1j * fase)
        G[0, 0] = media                      # la media (il colore) non si tocca
        out[..., c] = np.real(np.fft.ifft2(G))
    # contrasto riportato a quello vero (la randomizzazione tende ad ammorbidire le punte)
    for c in range(3):
        s0, s1 = a[..., c].std(), out[..., c].std() or 1.0
        out[..., c] = (out[..., c] - out[..., c].mean()) * (s0 / s1) + a[..., c].mean()
    tile = Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
    return tile.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))


# solo i materiali del catalogo: le cartelle «logo» e «models» sono altri ritagli
MATERIALI = ('wood', 'alcantara', 'sequoia', 'acero', 'pelle', 'velu-arte', 'soft-touch',
             'suade', 'safir', 'crazy', 'juta', 'metal', 'skill', 'cristalwhite', 'cristalplex')
def rilievo(im: Image.Image) -> tuple:
    """Dal campione ricava il RILIEVO vero della grana: la luminosità diventa altezza, la pendenza
    diventa normale (Sobel). Così cuciture, trama e velluto prendono luce come sul catalogo, invece
    del rilievo generico di libreria. Torna (normale, ruvidità)."""
    g = im.convert('L').filter(ImageFilter.GaussianBlur(0.6))
    w, h = g.size
    px = g.load()
    nor = Image.new('RGB', (w, h))
    rou = Image.new('L', (w, h))
    pn, pr = nor.load(), rou.load()
    # la scala del rilievo: la grana di un tessuto è micro, bastano pochi gradi di inclinazione
    K = 2.2
    for y in range(h):
        for x in range(w):
            x0, x1 = px[(x - 1) % w, y], px[(x + 1) % w, y]
            y0, y1 = px[x, (y - 1) % h], px[x, (y + 1) % h]
            dx = (x0 - x1) / 255 * K
            dy = (y0 - y1) / 255 * K
            n = (dx * dx + dy * dy + 1) ** 0.5
            pn[x, y] = (int((dx / n * 0.5 + 0.5) * 255), int((dy / n * 0.5 + 0.5) * 255), int((1 / n * 0.5 + 0.5) * 255))
            # le parti in ombra della trama sono le fibre: un filo più ruvide delle creste
            pr[x, y] = max(0, min(255, 255 - px[x, y] // 3))
    return nor, rou


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
