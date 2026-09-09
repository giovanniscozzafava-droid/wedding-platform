#!/usr/bin/env python3
"""Ritaglia dal catalogo DesignAlbum 2022 (render 150 dpi, una tavola = due pagine)
le campionature di materiali/colori (pag. 116–127), i loghi (pag. 34–37) e le
tonalità del logo (pag. 37). Produce i file in OUT/<gruppo>/<chiave>.{jpg,png},
una mappa JSON e un foglio di controllo per pagina in CHECK/.

Regole di lettura del catalogo:
- tavola PDF s (1..66) contiene le pagine stampate 2s-4 e 2s-3 (sinistra, destra)
- pannello nero con griglia di campioni; ordine di lettura = ordine del listino
- loghi in riquadri bordati, ordine di lettura per pagina
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = os.path.dirname(os.path.abspath(__file__))
HIRES = os.path.join(S, 'hires')
OUT = next((x for x in sys.argv[1:] if not x.startswith('-')), None) or os.path.join(S, 'swatches-out')
CHECK = os.path.join(S, 'swatches-check')
CATALOG_TS = os.path.expanduser('~/Repository/wedding-platform/frontend/src/components/album/albumCatalog.ts')
os.makedirs(OUT, exist_ok=True); os.makedirs(CHECK, exist_ok=True)

def sheet_of(page): return (page + 4) // 2
def side_of(page): return 'L' if page % 2 == 0 else 'R'

def load_half(page):
    s = sheet_of(page)
    im = Image.open(os.path.join(HIRES, f's{s}-{s:02d}.png')).convert('RGB')
    W, H = im.size
    box = (0, 0, W // 2, H) if side_of(page) == 'L' else (W // 2, 0, W, H)
    return im.crop(box)

def runs(mask1d, min_len=1, gap=0):
    """Intervalli [a,b) di True in un vettore, tollerando buchi ≤ gap."""
    idx = np.flatnonzero(mask1d)
    if idx.size == 0: return []
    out, a, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap + 1:
            if prev - a + 1 >= min_len: out.append((a, prev + 1))
            a = i
        prev = i
    if prev - a + 1 >= min_len: out.append((a, prev + 1))
    return out

def slug(label): return re.sub(r'[^a-z0-9]+', '-', label.lower())

# ---------------------------------------------------------------- materiali
MATERIAL_PAGE = {'sequoia': 116, 'pelle': 117, 'velu-arte': 118, 'alcantara': 119, 'soft-touch': 120, 'suade': 121,
                 'safir': 122, 'acero': 123, 'crazy': 124, 'juta': 125, 'metal': 126, 'skill': 127}
# Griglia (righe, colonne) del pannello di ogni materiale, letta a vista sul catalogo.
GRID = {'sequoia': (5, 2), 'pelle': (5, 2), 'velu-arte': (4, 3), 'alcantara': (7, 3), 'soft-touch': (4, 2), 'suade': (4, 2),
        'safir': (6, 3), 'acero': (6, 3), 'crazy': (5, 2), 'juta': (5, 2), 'metal': (5, 2), 'skill': (5, 2)}
# Celle vuote della griglia (riga, colonna da sinistra, base 0): sempre sul lato interno delle ultime righe.
EMPTY = {'velu-arte': [(3, 1), (3, 2)], 'alcantara': [(6, 0), (6, 1)], 'safir': [(4, 2), (5, 2)], 'suade': [(3, 0)]}
# Campioni fuori dal pannello nero (coordinate nella mezza pagina a 150 dpi), inseriti alla posizione data.
MANUAL = {'acero': [(0, (3052 - 2008, 422, 3237 - 2008, 498))]}

def parse_colors():
    src = open(CATALOG_TS, encoding='utf8').read()
    cols = {}
    for m in re.finditer(r"C\('([a-z\-]+)','([^']+)','#", src):
        cols.setdefault(m.group(1), []).append(m.group(2))
    return cols

def find_panel(a):
    """a = array RGB della mezza pagina. Ritorna (x1,y1,x2,y2): y1 = inizio della striscia
    scura in alto (la prima riga scura ≥ 300 px, soglia 45 perché la cornice non è nero puro),
    y2 = y1 + 800 (il pannello più alto è ~720 px: le righe vere si filtrano dopo per altezza),
    x1/x2 = estensione del NERO PURO della striscia in alto (il bordo esterno è nero pieno,
    verso il centro pagina la cornice sfuma)."""
    # Le pagine materiali seguono un template: il pannello parte sempre a y = 371 (150 dpi) e sta
    # dentro la cornice della pagina (x 120–1920 della mezza pagina). Misurato su tutte le 12 pagine.
    H = a.shape[0]
    return 120, 371, 1920, min(H, 371 + 800)

def material_cells(a, panel, side, grid, empty=(), debug=False):
    """Il pannello è una sovrapposizione nera che SFUMA verso il centro pagina: solo il bordo
    esterno (sinistro sulle pagine pari, destro sulle dispari) è netto. Quindi: la colonna
    esterna di campioni si legge dai pixel chiari sulle prime due righe; le altre colonne
    stanno a passo costante (larghezza + spazio) verso l'interno; la prima riga e il passo
    delle righe si leggono dal profilo di LUMINOSITÀ MEDIA (max canale) sulle prime due
    colonne (le velature e le ombre restano sotto il 65% del massimo). Le celle vuote della
    griglia sono dichiarate per materiale (verificate a vista sul catalogo)."""
    x1, y1, x2, y2 = panel
    H, W = a.shape[:2]
    mx = a.max(axis=2)
    bright = mx >= 90
    colsum = bright[y1 + 45:y1 + 280].sum(axis=0)
    inner_limit = x1 + 1200 if side == 'L' else max(0, x2 - 1200)
    cb = runs(colsum >= 30, min_len=100, gap=2)
    cb = [c for c in cb if (c[0] >= x1 - 5 and c[1] <= inner_limit)] if side == 'L' else [c for c in cb if (c[1] <= x2 + 5 and c[0] >= inner_limit)]
    if debug: print(f'   colonne chiare: {[(int(c[0]), int(c[1])) for c in cb][:10]}')
    if not cb: return []
    c1 = cb[0] if side == 'L' else cb[-1]
    w = int(c1[1] - c1[0])
    nxt = [c for c in cb if c[0] > c1[1]] if side == 'L' else [c for c in cb if c[1] < c1[0]]
    gap = int(nxt[0][0] - c1[1]) if (side == 'L' and nxt and nxt[0][0] - c1[1] < 60) else int(c1[0] - nxt[-1][1]) if (side == 'R' and nxt and c1[0] - nxt[-1][1] < 60) else 24
    pitch = w + gap
    n_rows, n_cols = grid
    cols = sorted((int(c1[0] + k * pitch) if side == 'L' else int(c1[0] - k * pitch)) for k in range(n_cols))
    cols = [(xa, xa + w) for xa in cols]
    # profilo righe: per ogni riga, la MEDIA di luminosità più alta fra le prime due colonne (dal bordo esterno)
    two = cols[:2] if side == 'L' else cols[-2:]
    prof = np.max(np.stack([mx[y1:y2, xa + 8:xb - 8].mean(axis=1) for xa, xb in two]), axis=0)
    rb_all = runs(prof >= 0.65 * prof.max(), min_len=30, gap=1)
    # altezza della riga = mediana delle bande plausibili (una banda può uscire corta se l'etichetta
    # scura abbassa la media); prima riga = prima banda; passo = media (start_k − start_1)/k
    hs = sorted(int(b - a_) for a_, b in rb_all[:n_rows])
    h = hs[len(hs) // 2]
    r1 = rb_all[0]
    p0 = next((int(b[0] - r1[0]) for b in rb_all[1:] if 0.8 * h + 8 <= b[0] - r1[0] <= h + 70), h + gap)
    ks = [((b[0] - r1[0]) / p0, b) for b in rb_all[1:]]
    est = [(b[0] - r1[0]) / round(k) for k, b in ks if k >= 0.75 and abs(k - round(k)) <= 0.25 and round(k) < n_rows]
    pitch = float(np.mean(est)) if est else float(p0)
    rgap = int(round(pitch)) - h
    rb = []
    for k in range(n_rows):
        ya = int(round(r1[0] + k * pitch)); yb = ya + h
        # aggancio al profilo locale: solo una banda chiara che inizia entro 6 px dalla previsione
        # ed è alta quanto la riga (±15%); altrimenti resta la previsione a passo costante
        lo, hi = max(0, ya - 12), min(len(prof), yb + 12)
        loc = [(lo + a_, lo + b_) for a_, b_ in runs(prof[lo:hi] >= 0.65 * prof.max(), min_len=30, gap=1)]
        loc = [r for r in loc if abs((r[1] - r[0]) - h) <= 0.15 * h and abs(r[0] - ya) <= 6]
        if loc: ya, yb = int(loc[0][0]), int(loc[0][1])
        rb.append((ya, yb))
    if debug: print(f'   colonna esterna {tuple(int(v) for v in c1)} w{w} gap{gap} · righe h{h} gap{rgap}: {[(y1 + r[0], y1 + r[1]) for r in rb]}')
    cells = []
    for ri, (ra, rbnd) in enumerate(rb):
        for ci, (xa, xb) in enumerate(cols):
            if (ri, ci) in empty: continue
            cells.append((xa + 2, y1 + ra + 2, xb - 2, y1 + rbnd - 2))
    return cells

# ---------------------------------------------------------------- loghi
def long_runs_mask(dark, axis, min_len):
    """Pixel scuri che stanno in una sequenza scura ≥ min_len lungo l'asse."""
    out = np.zeros_like(dark)
    if axis == 1:
        for r in range(dark.shape[0]):
            for a, b in runs(dark[r], min_len=min_len): out[r, a:b] = True
    else:
        for c in range(dark.shape[1]):
            for a, b in runs(dark[:, c], min_len=min_len): out[a:b, c] = True
    return out

def lines_from_mask(mask, axis):
    """Segmenti (pos, a, b): righe orizzontali (axis=1) → (y, x1, x2); verticali → (x, y1, y2)."""
    segs = []
    n = mask.shape[0] if axis == 1 else mask.shape[1]
    for i in range(n):
        vec = mask[i] if axis == 1 else mask[:, i]
        for a, b in runs(vec, min_len=100, gap=3):
            segs.append([i, a, b])
    # unisci righe adiacenti (spessore della linea)
    merged = []
    for s in sorted(segs):
        for m in merged:
            if abs(m[0][-1] - s[0]) <= 2 and min(m[2], s[2]) - max(m[1], s[1]) > 0.8 * min(m[2] - m[1], s[2] - s[1]):
                m[0].append(s[0]); m[1] = min(m[1], s[1]); m[2] = max(m[2], s[2]); break
        else:
            merged.append([[s[0]], s[1], s[2]])
    return [(float(np.mean(m[0])), m[1], m[2]) for m in merged]

def find_boxes(a, min_size=150, max_size=1000):
    dark = a.mean(axis=2) < 200          # i riquadri piccoli (P1/P2) hanno il bordo grigio chiaro
    h = lines_from_mask(long_runs_mask(dark, 1, 100), 1)
    v = lines_from_mask(long_runs_mask(dark, 0, 100), 0)
    boxes = []
    for (ty, tx1, tx2) in h:
        for (by, bx1, bx2) in h:
            hh = by - ty
            if not (min_size <= hh <= max_size): continue
            if abs(tx1 - bx1) > 12 or abs(tx2 - bx2) > 12: continue
            x1, x2 = max(tx1, bx1), min(tx2, bx2)
            if not (min_size <= x2 - x1 <= max_size): continue
            def has_v(x):
                return any(abs(vx - x) <= 8 and vy1 <= ty + 12 and vy2 >= by - 12 for (vx, vy1, vy2) in v)
            if has_v(x1) and has_v(x2 - 1):
                boxes.append((int(x1), int(round(ty)), int(x2), int(round(by))))
    # dedup e togli i contenitori
    uniq = []
    for b in boxes:
        if not any(all(abs(b[i] - u[i]) <= 10 for i in range(4)) for u in uniq): uniq.append(b)
    inner = [b for b in uniq if not any(o != b and o[0] >= b[0] - 4 and o[1] >= b[1] - 4 and o[2] <= b[2] + 4 and o[3] <= b[3] + 4 for o in uniq)]
    return inner

def reading_order(boxes, tol=60):
    rows = []
    for b in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        cy = (b[1] + b[3]) / 2
        for r in rows:
            if abs(r['cy'] - cy) <= tol: r['items'].append(b); break
        else: rows.append({'cy': cy, 'items': [b]})
    out = []
    for r in rows: out += sorted(r['items'], key=lambda b: b[0])
    return out

def tone_chips(a, y_from, y_to):
    """23 chip attaccati: 21 pieni (grigio 15% … nero) si trovano da soli; «Bianco» (riquadro
    bianco bordato) e «Tono su tono» (testo) si ricavano dal passo della fila."""
    sub = a[y_from:y_to]
    nonwhite = sub.min(axis=2) < 235
    rb = runs(nonwhite.sum(axis=1) >= 300, min_len=40, gap=2)
    ya, yb = max(rb, key=lambda r: r[1] - r[0])
    band = nonwhite[ya:yb]
    solid = [r for r in runs(band.sum(axis=0) >= (yb - ya) * 0.8, min_len=30, gap=1)]
    solid = solid[-21:]
    w = int(np.median([b - a_ for a_, b in solid]))
    pitch = (solid[-1][0] - solid[0][0]) / 20
    x_g15 = solid[0][0]
    chips = [(int(round(x_g15 - 2 * pitch)), y_from + ya, int(round(x_g15 - 2 * pitch)) + w, y_from + yb),
             (int(round(x_g15 - pitch)), y_from + ya, int(round(x_g15 - pitch)) + w, y_from + yb)]
    chips += [(ca, y_from + ya, cbnd, y_from + yb) for (ca, cbnd) in solid]
    return chips

# ---------------------------------------------------------------- output
def contact_sheet(name, im, items, note=''):
    """items = [(box, label)] → foglio con i ritagli numerati + la pagina con i riquadri."""
    draw_im = im.copy(); d = ImageDraw.Draw(draw_im)
    for i, (b, lab) in enumerate(items):
        d.rectangle(b, outline=(255, 0, 0), width=4); d.text((b[0] + 6, b[1] + 6), str(i + 1), fill=(255, 0, 0))
    thumb = draw_im.resize((draw_im.width // 2, draw_im.height // 2))
    cols = 6; cw, ch = 300, 150
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, thumb.height + 40 + rows * (ch + 30)), 'white')
    sheet.paste(thumb, (0, 0)); dd = ImageDraw.Draw(sheet)
    dd.text((10, thumb.height + 10), f'{name}  {note}', fill='black')
    for i, (b, lab) in enumerate(items):
        crop = im.crop(b); crop.thumbnail((cw - 20, ch - 10))
        x, y = (i % cols) * cw, thumb.height + 40 + (i // cols) * (ch + 30)
        sheet.paste(crop, (x + 10, y)); dd.text((x + 10, y + ch - 6), f'{i + 1}. {lab}', fill='black')
    sheet.save(os.path.join(CHECK, f'{name}.png'))

def save_crop(im, box, path, fmt):
    crop = im.crop(box)
    if fmt == 'jpg':
        if crop.width > 420: crop = crop.resize((420, round(crop.height * 420 / crop.width)), Image.LANCZOS)
        crop.save(path, 'JPEG', quality=88, optimize=True)
    else:
        if crop.width > 360: crop = crop.resize((360, round(crop.height * 360 / crop.width)), Image.LANCZOS)
        crop.convert('P', palette=Image.ADAPTIVE, colors=128).save(path, 'PNG', optimize=True)

manifest = {'materials': {}, 'logos': {}, 'tones': {}}
problems = []
colors = parse_colors()

for mat, page in MATERIAL_PAGE.items():
    im = load_half(page); a = np.asarray(im)
    panel = find_panel(a)
    names = colors.get(mat, [])
    if '-v' in sys.argv: print(f'## {mat} pag.{page} {side_of(page)} pannello {tuple(int(v) for v in panel)} griglia {GRID[mat]} attesi {len(names)}')
    cells = reading_order(material_cells(a, panel, side_of(page), GRID[mat], EMPTY.get(mat, ()), debug='-v' in sys.argv), tol=30)
    for pos, box in MANUAL.get(mat, []): cells.insert(pos, box)
    note = f'pag. {page} · attesi {len(names)} · trovati {len(cells)}'
    if len(cells) != len(names): problems.append(f'{mat}: {note}')
    items = [(c, names[i] if i < len(names) else '??') for i, c in enumerate(cells)]
    contact_sheet(f'mat-{mat}', im, items, note)
    os.makedirs(os.path.join(OUT, mat), exist_ok=True)
    for i, (c, lab) in enumerate(items):
        if i >= len(names): break
        fn = f'{slug(lab)}.jpg'; save_crop(im, c, os.path.join(OUT, mat, fn), 'jpg')
        manifest['materials'][f'{mat}:{slug(lab)}'] = f'{mat}/{fn}'

# Campionatura del MATERIALE = un pezzo della foto di stoffa/pelle della sua pagina (sopra il pannello).
MAT_TILE = (120, 110, 1405, 351)
for mat, page in MATERIAL_PAGE.items():
    im = load_half(page)
    save_crop(im, MAT_TILE, os.path.join(OUT, mat, '_materiale.jpg'), 'jpg')
    manifest['materials'][f'mat:{mat}'] = f'{mat}/_materiale.jpg'
# Pelle di legno (pag. 3, striscia di foto), Cristalwhite (pag. 54), Cristalplex (pag. 70): foto dei modelli.
for mat, page, box in [('wood', 3, (3560 - 2008, 540, 3800 - 2008, 780)), ('cristalwhite', 54, (260, 260, 1300, 800)), ('cristalplex', 70, (120, 100, 1280, 760))]:
    os.makedirs(os.path.join(OUT, mat), exist_ok=True)
    im = load_half(page); save_crop(im, box, os.path.join(OUT, mat, '_materiale.jpg'), 'jpg')
    manifest['materials'][f'mat:{mat}'] = f'{mat}/_materiale.jpg'
    contact_sheet(f'mat-{mat}', im, [(box, 'materiale')], f'pag. {page}')

LOGO_PAGES = {34: ['cod.P1', 'cod.P2', 'cod.00'] + [f'cod.{n:02d}' for n in range(1, 9)],
              35: [f'cod.{n:02d}' for n in range(9, 21)],
              36: [f'cod.{n:02d}' for n in range(21, 33)],
              37: [f'cod.{n:02d}' for n in range(33, 49)]}
os.makedirs(os.path.join(OUT, 'logo'), exist_ok=True)
chips_boxes = []
for page, codes in LOGO_PAGES.items():
    im = load_half(page); a = np.asarray(im)
    boxes = reading_order(find_boxes(a, min_size=120), tol=80)
    note = f'pag. {page} · attesi {len(codes)} · trovati {len(boxes)}'
    if len(boxes) != len(codes): problems.append(f'loghi p.{page}: {note}')
    items = [(b, codes[i] if i < len(codes) else '??') for i, b in enumerate(boxes)]
    if page == 37 and len(boxes) >= 5:
        row1_bottom = max(b[3] for b in boxes[:4]); row3_top = min(b[1] for b in boxes[4:])
        chips = tone_chips(a, row1_bottom + 5, row3_top - 5)
        chips_boxes = [(im, c) for c in chips]
        note += f' · tonalità trovate {len(chips)}'
        if len(chips) != 23: problems.append(f'tonalità: trovate {len(chips)}')
        items += [(c, f'tono {i + 1}') for i, c in enumerate(chips)]
    contact_sheet(f'logo-p{page}', im, items, note)
    for i, (b, code) in enumerate(items[:len(codes)]):
        if i >= len(boxes): break
        # dentro il bordo: 4 px di margine
        inner = (b[0] + 4, b[1] + 4, b[2] - 4, b[3] - 4)
        fn = f'{code}.png'; save_crop(im, inner, os.path.join(OUT, 'logo', fn), 'png')
        manifest['logos'][code] = f'logo/{fn}'

TONES = ['tono-su-tono', 'bianco', 'grigio-15', 'grigio-30', 'grigio-50', 'grigio-75', 'beige', 'sabbia', 'marrone', 'marrone-scuro',
         'giallo', 'giallo-ocra', 'rosso', 'bordeaux', 'aloe', 'verde', 'rosa', 'glicine', 'viola', 'celeste', 'azzurro', 'blu', 'nero']
os.makedirs(os.path.join(OUT, 'tono'), exist_ok=True)
for i, (im, c) in enumerate(chips_boxes[:len(TONES)]):
    fn = f'{TONES[i]}.png'; save_crop(im, c, os.path.join(OUT, 'tono', fn), 'png')
    manifest['tones'][TONES[i]] = f'tono/{fn}'

json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, ensure_ascii=False)
print('materiali:', len(manifest['materials']), '· loghi:', len(manifest['logos']), '· tonalità:', len(manifest['tones']))
print('PROBLEMI:' if problems else 'nessun problema di conteggio'); [print(' -', p) for p in problems]
