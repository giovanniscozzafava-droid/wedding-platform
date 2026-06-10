# tests/adversarial — repro EXPECTED-FAIL (audit NOTTE 1)

Questi file **non** dimostrano che il sistema funziona: dimostrano **dove si rompe**.
Ogni blocco `do $$ … raise exception 'BRK-…' … $$;` fa **rosso** (solleva un'eccezione)
**quando la rottura è presente**. Sono quindi *expected-fail*: NON vanno nel runner
della build verde (`tests/sql/`), vivono qui a parte e si lanciano a mano.

Sono la **to-do list della notte dei fix**: quando una rottura sarà chiusa, il suo
blocco smetterà di sollevare l'eccezione (diventerà verde) → quello sarà il segnale
che il fix tiene.

## Come girarli
```bash
DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
for f in A_state_machine B_concurrency C_cascades D_boundaries E_accounting; do
  echo "### $f ###"
  docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=0 -f - < tests/adversarial/$f.sql 2>&1 | grep "ERROR:  BRK-"
done
```
Atteso oggi: **46 righe `ERROR: BRK-…`** (45 rotture + B-02 che invece RESISTE, documentata nel file). Ogni blocco è `begin; … rollback;` autonomo: niente residui nel DB.

## Mappa
| File | Famiglia | Rotture |
|---|---|---|
| `A_state_machine.sql` | A · transizioni illegali + 2 snapshot | 12 |
| `B_concurrency.sql` | B · concorrenza | 2 (+ B-02 resiste) |
| `C_cascades.sql` | C · orfani/cascate | 9 |
| `D_boundaries.sql` | D · confini/input | 14 |
| `E_accounting.sql` | E · contabilità | 9 |

Dettaglio, severità ed esiti: `docs/BREAK-REGISTER.md`. Copertura: `docs/AUDIT-INVENTORY.md`.

## Nota: BRK-D-ICS (non-SQL)
`calendar-export-ics` non escapa `;`/`,`/`\` nel campo `SUMMARY` (RFC5545): un titolo
con `;` o `,` rompe il parsing del client calendario. È un difetto JS (Edge Function),
non riproducibile in SQL → documentato nel registro, non ha un blocco in questi file.
