# Musica della presentazione galleria — provenienza e licenze

Tutte registrazioni **di pubblico dominio o CC0** prese da Wikimedia Commons.
Nessun brano sotto copyright, nessun obbligo di attribuzione — l'attribuzione qui
sotto è per nostra tracciabilità, non un requisito di licenza.

Trattamento uguale per tutte: normalizzate a −18 LUFS (media risultante ≈ −20/−22 dB,
picchi sotto −2 dB), dissolvenza in entrata 1,5 s e in uscita 3 s (così il ritorno
del loop non è uno stacco), tagliate a massimo 4 minuti, mp3 128 kbps 44,1 kHz stereo.

| File | Brano | Licenza | Fonte |
|---|---|---|---|
| `romantica.mp3` | Chopin — Notturno n. 2 in mi bemolle magg., op. 9 n. 2 (Frank Levy) | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Chopin_-_Nocturne_No._2_in_E-flat_major,_Op._9_No._2_(Frank_Levy).flac) |
| `culla.mp3` | Brahms — Ninna nanna, op. 49 n. 4 | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Johannes_Brahms_ninna_nanna_op_49_n_4.ogg) |
| `solenne.mp3` | Bach — BWV 147, «Jesus bleibet meine Freude» (Orchestra Gli Armonici) | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Bach,_BWV_147,_10._Jesus_bleibet_meine_Freude.ogg) |
| `festa.mp3` | Mozart — Serenata K. 525 «Eine kleine Nachtmusik», I. Allegro | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Mozart_K525_Serenade_in_G_Major_1_-_Allegro.ogg) |
| `sobria.mp3` | Satie — Gnossienne n. 1 | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Satie_-_Gnossienne_1.ogg) |

## A quale evento va quale brano

Definito in `frontend/src/lib/showcaseMusic.ts` (`STYLE_BY_KIND`):

- **romantica** → matrimonio, anniversario
- **culla** → battesimo
- **solenne** → comunione, cresima
- **festa** → compleanno, laurea
- **sobria** → corporate, altro

## Sostituire un brano

Metti il nuovo file qui con lo stesso nome e aggiorna la riga qui sopra. Il codice
non va toccato: `TRACK_FILE` punta a `/music/<stile>.mp3`. Applica lo stesso
trattamento, altrimenti quel brano suonerà più forte o più piano degli altri:

```bash
ffmpeg -y -i sorgente -t 240 \
  -af "loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=1.5,afade=t=out:st=237:d=3" \
  -c:a libmp3lame -b:a 128k -ar 44100 -ac 2 <stile>.mp3
```
