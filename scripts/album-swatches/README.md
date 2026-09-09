# Campionature dal catalogo DesignAlbum 2022

Ritagli di materiali/colori (pag. 116–127), loghi (pag. 34–37) e tonalità del logo (pag. 37)
usati dal configuratore copertina (`SwatchPicker`). Per rigenerarli:

1. render a 150 dpi delle tavole che servono (una tavola PDF = due pagine stampate: 2s−4 e 2s−3):
   `pdftoppm -r 150 -f <s> -l <s> -png designalbum-2022.pdf hires/s<s>` per s = 3, 19, 20, 29, 37, 60…65
2. `python3 crop-swatches.py` (numpy + Pillow) → `swatches-out/` + fogli di controllo in `swatches-check/`
   (controllare a vista: ordine di lettura = ordine dei colori in `albumCatalog.ts`)
3. `python3 gen-swatches-ts.py` → copia in `frontend/public/album-swatches/` e rigenera
   `frontend/src/components/album/catalog/swatches.generated.ts`

Gli script si aspettano di stare nella stessa cartella di `hires/` e del PDF (percorsi in testa ai file).
