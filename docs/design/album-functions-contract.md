# Album Designer — Contratto funzioni (censimento pre-restyle)

> Regola zero: a fine restyle TUTTE le voci qui sotto devono esistere ancora, con lo stesso comportamento.
> File: `frontend/src/pages/AlbumDesignerPage.tsx` (5151 righe, componente `AlbumDesignerInner`).
> La pagina ha DUE viste: **A) vista coppia (`isCouple`/`lite`)** — reader sfogliabile + post-it/richieste; **B) vista pro fotografo** — impaginatore completo. Sotto è mappata soprattutto la B (target del redesign a 4 zone); la A va preservata identica.
> Scorciatoie stato: `step` = `select` | `design`; `lite` = versione cliente; `isCouple` = coppia.

## 0 · Stato/step di primo livello
- [ ] Toggle step: **1 · Selezione** / **2 · Impagina** (`setStep`).
- [ ] Vista **Selezione** = `<SelectStep>` (griglia scelta foto, vedi §7).
- [ ] Vista **Impagina** = funnel + toolbar + workspace 3 colonne + filmstrip (vedi §2–§6).

## 1 · Top bar (header, righe 2644–2713)
- [ ] Back a `/couple` o `/weddings/:entryId`.
- [ ] Titolo `Impaginatore — {title}` + sottotitolo stato (`statusLabel`).
- [ ] **Select formato** album (Standard + Personalizzati) → `setFormat`.
- [ ] Bottone **Formato personalizzato** (pannello popover): largh×alt cm + nome → `saveCustom`; lista custom con **usa**/**elimina** (`deleteCustomFormat`).
- [ ] Bottone **Prezzo** (`openPrice`) con totale live `euroA(priceBreakdown.total)`.
- [ ] Segmented **1 · Selezione / 2 · Impagina**.

## 2 · Funnel fotografo (`<FunnelSteps>`, righe 2848–2858)
- [ ] Il mio stile (`setStyleOpen`) · done=`hasStyle`
- [ ] AI seleziona (`aiCurate`)
- [ ] Impagina con AI (`setAiPick`) · done=`pages.length>0`
- [ ] Valuta qualità (`rankQuality`) · done=`qualityScores`
- [ ] Esporta (`setExportOpen`)

## 3 · Toolbar impaginatore (righe 2860–2909)
- [ ] Badge "Versione cliente" (solo `lite`).
- [ ] **Impagina con AI** (`setAiPick`) — primario.
- [ ] **AI seleziona** (`aiCurate`).
- [ ] **Auto rapida** (`setPages(autoLayout(...))`).
- [ ] **Valuta qualità** (`rankQuality`).
- [ ] **Report** qualità (`setQualityOpen`, se ci sono score).
- [ ] **Il mio stile** (`setStyleOpen`).
- [ ] **Sostituisci foto** (input file `replaceFileRef` → `replacePhotosByName`).
- [ ] **Salva** (`save()`) + indicatore "salvato".
- [ ] **Annulla** (`undo`, ⌘Z) / **Ripeti** (`redo`, ⌘⇧Z / ⌘Y).
- [ ] Toggle: **Griglia** (`gridOn`), **Margini** (`marginsOn`), **Numeri** (`pageNums`), **Righello** (`rulerOn`), **Abbondanza** (`bleed`), **Volti** (`showFaces`, se faceMap).
- [ ] Badge **N a bassa risoluzione** (`lowResFlags`).
- [ ] Toggle **Libera** (`convertTavolaToFree` / `frozen`) e **Piena tavola** (`fillElToTavola`).
- [ ] **Zoom −/%/+** (`setZoom`, range 0.5–2.5 qui).
- [ ] **Piena pagina / Esci pieno** (`toggleFullscreen`).
- [ ] **Anteprima** (`setPreviewOpen`).
- [ ] **Esporta…** (`setExportOpen`).
- [ ] **Azione stato** `action.label` → `save(action.next)` o dialog **FINAL** (`setFinalDialog`).
- [ ] **Modifiche** (`setRevOpen`) con badge `openRevs`.
- [ ] Contatore `N pag · formato · stato`.

## 4 · Zona libreria foto (colonna sx, `<aside>`, righe 2914–2977)
- [ ] Contatore **Usate X/Y**.
- [ ] **Aggiungi foto** (input `trayFileRef` → `importPhotos`).
- [ ] **Filtro per momento** (`setMomentFilter`).
- [ ] Thumbnail: **drag** su tavola (`dataTransfer text/media`) + **click** = inserisci in slot/free (`freeAdd`/`placeInto`).
- [ ] Foto inserite: opacità ridotta; non inserite: bordo dorato.
- [ ] Pallino **volto AI** (se `showFaces`).
- [ ] Badge **usata ×N / ✓** (`usageCount`).
- [ ] **Togli dalla selezione** (hover, `removeFromSelection`).
- [ ] Badge **voto qualità 0–100** (`qualityScores`).
- [ ] Maniglia ridimensiona libreria (`DragSize` → `setLibW`, 120–440px).

## 5 · Canvas centrale (la doppia, `<main>`, righe 2982–3122)
- [ ] Righello (`SpreadRuler`) + **guide** trascinabili (add/move/remove: `addGuide`/`startGuideDrag`/`removeGuide`, doppio-clic/Canc).
- [ ] Render tavola: `FreeStage` (libera) o `PageStage` (template).
- [ ] Attivazione tavola su pointerdown (`setCurrentPageId`), ring oro sull'attiva.
- [ ] **Foto a piena tavola / doppia pagina**: move + resize 4 angoli (`updateSpreadFrame`), zoom −/+ (`updateSpreadCell`), **Ritaglia** (`setCropSpread`), **Piena tavola** (`updateSpreadFrame 0,0,1,1`), **Rimuovi** (`clearSpreadImg`), drop foto = `setSpreadImg`.
- [ ] Badge **bassa risoluzione (dpi)** sulla foto piena tavola.
- [ ] Filigrana dorso (non stampata).
- [ ] **Post-it cliente** (`PostitLayer`): apri, applica sostituzione (`applyReplacePostit`), applica rimozione (`applyRemovePostit`), **Fatto** (`resolveRev`), **Riapri** (`reopenRev`), **Elimina** (`deleteRev`).
- [ ] Empty state "Nessuna tavola" + **Tavola vuota** (`addSpread`).
- [ ] **Navigatore** (righe 3125–3134): Tav. prec/succ, `Tav. n/tot`, zoom −/Adatta/+ (`setZoom` 0.3–3).

## 6 · Filmstrip tavole (righe 3138–3156)
- [ ] Miniature tavole (`SpreadThumb`): seleziona, drop foto (`placeInto`), sposta foto (`movePhotosToTavola`), sposta tavola (`moveSpread`), elimina (`delSpread`), **riordina** drag (`moveSpreadInsert`), **menu contestuale** (`setNavMenu`).
- [ ] **GapDrop** tra tavole: drop foto (`setGapInsert`), sposta nuova tavola (`moveNewTavola`), inserisci vuota (`insertEmptyTavola`).
- [ ] **+ Tavola** in coda (`addSpread`).
- [ ] Maniglia altezza filmstrip (`DragSize` → `setStripH`, 48–240px).

## 7 · Ispettore (pannello proprietà, colonna dx, righe 3161–3211)
Delegato a `<PropsPanel>` (template) o `<FreePanel>` (libera):
- [ ] **Template** doppia (`onTemplate`) + **cicla layout** (`onCycle`).
- [ ] **Cella/crop** slot (`onCell`, `onCrop`), **svuota slot** (`onClearSlot`).
- [ ] **Passa a libera** (`onFree`).
- [ ] **Aggiungi/Elimina/Duplica** pagina (`onAddPage`/`onDelPage`/`onDuplicate`).
- [ ] **Salva/Applica/Elimina layout** salvato (`saveCurLayout`/`applyLayoutCur`/`removeLayout`).
- [ ] FreePanel extra: sfondo pagina (`onBg`), allinea/distribuisci/spaziatura uniforme (`alignSel`/`distributeSel`/`uniformGapsSel`), gutter (`setGutterMm`), livelli (reorder/select), crop+rotate90 elemento.

## 8 · Menu contestuale foto (tasto destro, righe 3248–3280)
Copia ⌘C · Taglia ⌘X · Incolla ⌘V · Duplica ⌘D · Apri in Photoshop · Carica versione modificata · Cancella oggetto (AI) · Ritaglia · Sostituisci foto · Sostituisci con… (scambia) · Bilanciamento bianco tavola · Organizza nella pagina · Riempi la cornice · Centra il contenuto · Porta in primo piano/in fondo · Elimina ⌫.

## 9 · Menu contestuale navigatore (righe 3283–3300)
Aggiungi tavola dopo/prima · Sposta a sx/dx · Elimina tavola.

## 10 · Modali (blocchi `fixed inset-0`)
- [ ] **Prezzo album** (2728) — modalità/pacchetto/modello/base/pagine/box/famiglia + riepilogo live + import da preventivo + toggle "mostra alla coppia".
- [ ] **Scelta inserimento tavola** (3303) — singola/piena/doppia.
- [ ] **Sostituisci con… (swap)** (3319) — griglia scelta, ← → per scorrere, Esc.
- [ ] **Impagina con AI** (3383).
- [ ] **Il mio stile** (3455).
- [ ] **Qualità di stampa** report (3472).
- [ ] **Segna come finale** (3521) — nota + conferma.
- [ ] **Anteprima foto** (3542) — Space/frecce/Esc.
- [ ] **Ritaglio** slot (`CropModal`, 3221) + **Ritaglio piena tavola** (3233).
- [ ] **AI seleziona / cura** (3612) — lista drop + recupera.
- [ ] **Bilanciamento bianco** tavola (3682).
- [ ] **Esporta**, **Modifiche** (`revOpen`), **Anteprima sfoglio** (`previewOpen`) — pannelli laterali/dialoghi.

## 11 · Scorciatoie tastiera (righe 681–712)
⌘Z undo · ⌘⇧Z / ⌘Y redo · ⌘A seleziona tutto (free) · ⌘D duplica · ⌘C/⌘X/⌘V clipboard (free) · Canc/Backspace elimina (o guida) · Esc deseleziona/elimina · frecce = sposta selezione (Shift = passo grande).

## 12 · Vista coppia (`isCouple`, righe 2478–2640) — DA PRESERVARE IDENTICA
Reader sfogliabile (tavola sx+dx) · numeri pagina nel margine · zoom fullscreen tavola con post-it · pannello **prezzo album** (se il fotografo lo mostra) · **richiedi modifica** · **le mie richieste**.

---
### Note di mappatura per il redesign a 4 zone
- La toolbar ha ~20 comandi: nel target vanno distribuiti tra top bar (formato/zoom/anteprima/azioni) e un menu **"Altro ⌄"** per gli strumenti secondari (griglia/margini/righello/abbondanza/volti/auto rapida). NESSUN comando va eliminato.
- Il canvas attuale è **height-driven** (`spreadHpx`) con figli assoluti che funzionano: il pattern width-driven del concept va introdotto SOLO con verifica visiva (rischio collasso a 0), non alla cieca.
