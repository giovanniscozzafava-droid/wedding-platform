# idml-parser (spike)

Spike **standalone** di fattibilità: legge un file **IDML** (export ufficiale Adobe, ZIP di XML) ed estrae la geometria per ricostruire un album (spread, frame immagine, crop). **NON è codice di prodotto**, non tocca l'app, il DB o le route. Naming interno: `idml_import`. Vedi [REPORT.md](./REPORT.md).

## Uso

```bash
npm install                 # fflate + fast-xml-parser (isolati qui)
node make-fixture.mjs       # crea fixture.idml (IDML Adobe sintetico di prova)
node parse-idml.mjs fixture.idml --pretty

# su un IDML vero:
node parse-idml.mjs /percorso/album.idml --pretty
```

## Output (schema)

```json
{
  "source": "idml_import",
  "spreads": [
    { "index": 1, "width_mm": 600, "height_mm": 300,
      "frames": [
        { "x": 0.05, "y": 0.10, "w": 0.40, "h": 0.55, "rotation_deg": 0,
          "image_filename": "IMG_2041.jpg",
          "image_crop": { "offset_x": 0.1, "offset_y": 0.0, "scale": 1.25 } }
      ] }
  ],
  "warnings": []
}
```

Coordinate frame **0..1** relative allo spread. Dimensioni in **mm** (da punti tipografici).

## Limiti noti

Crop = prima approssimazione (serve un IDML reale + foto per tararlo); frame ruotati resi come AABB + `rotation_deg`; forme non rettangolari trattate come bbox; testo/sfondi fuori scope. Dettagli e stima effort in [REPORT.md](./REPORT.md).

## Guardrail

Solo export IDML ufficiale. Niente `.sap`, niente decompilazione, niente import dei template di libreria Pixellu. Vedi REPORT.md § Guardrail.
