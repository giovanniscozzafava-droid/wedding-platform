"""Dal ritaglio di un campione alla piastrella di texture: pulizia della scritta, luce piatta,
rigenerazione dallo spettro (periodica, senza giunte) e rilievo dalla grana. Usato da
gen-material-textures.py (tessuti) e gen-wood-textures.py (essenze del legno)."""
from PIL import Image, ImageFilter

SIDE = 512

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


