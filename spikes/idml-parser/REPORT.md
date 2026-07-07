# Spike — import layout album da IDML (`idml_import`)

**Data:** 2026-07-07 · **Tipo:** spike di fattibilità (NON feature di prodotto) · **Stato:** parser generico funzionante e collaudato su IDML sintetico. **Manca la verifica sul dialetto reale di un export SmartAlbums** (prerequisito bloccante: 1–3 IDML veri da un fotografo della rete).

## Cosa fa il parser

`parse-idml.mjs` (Node ESM, deps: `fflate` per lo ZIP, `fast-xml-parser` per l'XML). Input: un `.idml`. Output: JSON normalizzato — spread con dimensioni in mm e frame immagine con geometria in coordinate **0..1 relative allo spread** (indipendenti dal formato di stampa), rotazione, nome file linkato, crop.

```
node make-fixture.mjs          # genera fixture.idml (IDML Adobe sintetico, non SmartAlbums)
node parse-idml.mjs fixture.idml --pretty
```

## Cosa si estrae in modo AFFIDABILE (verificato sul sintetico)

| Dato | Come | Note |
|---|---|---|
| **N. spread + ordine** | `designmap.xml` → `idPkg:Spread[@src]`, fallback su enumerazione `Spreads/Spread_*.xml` | ok |
| **Dimensioni spread** | unione dei `GeometricBounds` delle `Page` (× `ItemTransform`), punti→mm (1pt = 25.4/72 mm) | esatto |
| **Posizione/dimensione frame** | `Rectangle/Polygon/Oval` con figlio `Image/PDF/EPS` → `PathGeometry` (anchor locali) × `ItemTransform`, bbox in spazio spread, normalizzato 0..1 | esatto per frame non ruotati |
| **Rotazione frame** | `atan2(b,a)` dalla `ItemTransform` | ok; vedi limite sotto |
| **File immagine** | `Image > Link[@LinkResourceURI]` → basename URI-decodificato | ok se il link è esterno |
| **Frame vuoti** | rettangoli senza `<Image>` → **saltati** (decorativi/placeholder) | corretto |
| **Group** | ricorsione con composizione della matrice del gruppo (fino a 4 livelli) | ok |

Esempio reale dell'output (dal fixture): spread 600×300pt → **211.7×105.8 mm**; frame `x0.05 y0.133 w0.40 h0.55` con `IMG_2041.jpg`, crop `scale 1.25 offset_x -0.05`; secondo frame ruotato 45° correttamente marcato.

## Cosa è APPROSSIMATO o DA VERIFICARE su file reali

1. **Crop esatto dell'immagine.** Ricavo `scale`/`offset` dalla `ItemTransform` del `<Image>` (normalizzando l'offset sul frame). È una **prima approssimazione**: il crop reale (quale porzione dei pixel sorgente è visibile) dipende anche da dimensione pixel e ppi dell'immagine, non solo dalla matrice. Tengo `_raw_image_matrix` nell'output per ricalibrare. **Serve un IDML vero + le foto originali** per tarare offset/scala e i segni.
2. **Frame ruotati.** Per ora restituisco l'**AABB** (bounding box allineato) + `rotation_deg`. Per ricostruire il riquadro ruotato in modo fedele nell'impaginatore va applicata la rotazione attorno al centro del frame (il nostro modello `tavolaFree`/`FreeEl` regge la rotazione: mappatura da fare). Non bloccante, ma da implementare nella feature.
3. **Forme non rettangolari / clipping path.** `Polygon`/`Oval` li tratto come bbox: perdo la maschera. Gli album SmartAlbums usano quasi solo rettangoli, ma va confermato sui sample.
4. **Link vs immagini incorporate.** Se SmartAlbums **incorpora** le immagini invece di linkarle (o usa path relativi/embed base64), `LinkResourceURI` potrebbe mancare o essere diverso → il match per nome file salta. **Da verificare sul reale.**
5. **Coordinate binding-centered.** Alcuni IDML mettono l'origine dello spread sulla rilegatura (pagina sinistra con x negativa). Il mio calcolo dei bounds via unione delle pagine gestisce il caso, ma va confermato su spread SmartAlbums a doppia pagina.
6. **Pagina singola (copertina) vs spread doppio.** Rilevo e segnalo `pagina_singola`; la copertina probabilmente ha geometria/quote diverse.
7. **Sfondi/pattern.** Fuori scope (come da brief). Attenzione: uno sfondo pieno potrebbe apparire come `Rectangle` con `Image` a piena pagina → da distinguere da una foto vera.

## Edge case già gestiti nel parser

Frame vuoti saltati · group con composizione matrice · `designmap` mancante (fallback) · link immagine mancante (warning) · spread degenere/senza pagine (warning) · dedup dei warning.

## Stima onesta effort → feature di prodotto

- **Parser core (questo spike):** ~fatto (mezza giornata). Va rifinito su 2–3 IDML reali: **~1–2 giorni** per crop esatto, frame ruotati fedeli, gestione link/embed reali, copertina.
- **Mapper IDML→modello album** (`spread`→tavola `tavolaFree`, `frame`→`FreeEl` con crop/rotazione, match `image_filename`→media della galleria Drive per nome): **~2–3 giorni**.
- **UI import + gestione foto mancanti** (foto non trovate in galleria, conferma, anteprima): **~2–3 giorni**.
- **Rispetto pattern snapshot** (un layout importato e approvato si congela, come `album_snapshot_on_approval`): **~0.5 giorno**.
- **Totale indicativo:** ~1–1.5 settimane-uomo, **dietro il gate** (fix/1–5 + Stripe + 5 capostipiti), con PRP dedicato.

## Guardrail (rispettati)

Si parsa **solo** l'export IDML ufficiale. Nessun accesso al file progetto `.sap`, nessuna decompilazione del software, nessun import/replica dei **template di libreria** (contenuto protetto Pixellu). Naming interno **`idml_import`** (non `smartalbums_import`); nessun marchio nel codice oltre a commenti descrittivi. Legalmente l'interoperabilità sul layout del **singolo album del fotografo** (dato suo) è la posizione solida; check legale IT/UE prima del lancio commerciale.

## Prossimo passo bloccante

**Procurare 1–3 IDML esportati da SmartAlbums** (layout diversi: pagine piene, griglie, copertina, foto ruotate). Con quelli: giro il parser, confronto l'output col PDF/JPG esportato dallo stesso album, aggiorno questo report con le sorprese del dialetto reale e taro il crop.
