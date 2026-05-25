# Night-A WP Audit — 2026-05-25T20:33:11.720Z

**Base**: https://planfully.it  ·  **User**: wp-mini@planfully-demo.it

**Pass**: 33  ·  **Bug**: 8

Severità → CRITICAL: 0 · HIGH: 0 · MEDIUM: 2 · LOW: 6

## Pages summary

| Page | Pass | Bug |
|---|---:|---:|
| LOGIN | 1 | 0 |
| HOME | 3 | 0 |
| CATALOG | 1 | 1 |
| WEDDINGS_LIST | 1 | 1 |
| WEDDING_DETAIL | 13 | 4 |
| SUPPLIERS | 2 | 0 |
| SUPPLIER_DETAIL | 1 | 1 |
| CALENDAR | 1 | 0 |
| QUOTES_LIST | 1 | 0 |
| QUOTE_EDITOR | 2 | 0 |
| CONTRACTS | 1 | 0 |
| FINANCE | 1 | 0 |
| INSURANCE | 1 | 0 |
| BRAND | 2 | 0 |
| PROFILE | 2 | 1 |

## Bugs (sorted by severity)

- **[MEDIUM] CATALOG** — Bottone "Nuovo servizio" non trovato in Catalog
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **CATALOG** → osserva.
- **[MEDIUM] WEDDINGS_LIST** — Bottone crea matrimonio non trovato
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **WEDDINGS_LIST** → osserva.
- **[LOW] WEDDING_DETAIL** — Tab "Programma" non trovato (UI usa label "Scaletta")
  _Detail_: incongruenza vocabolario: spec/docs riferisce a "Programma", UI mostra "Scaletta".
  _Repro_: login con wp-mini@planfully-demo.it → apri qualsiasi wedding → osserva header tab.
- **[LOW] WEDDING_DETAIL** — Tab mood senza upload
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **WEDDING_DETAIL** → osserva.
- **[LOW] WEDDING_DETAIL** — Tab "Sito" non trovato (UI usa label "Wedding site")
  _Detail_: spec parla di "Sito ospiti", UI mostra "Wedding site" (anglismo).
  _Repro_: login con wp-mini@planfully-demo.it → apri qualsiasi wedding → osserva header tab.
- **[LOW] WEDDING_DETAIL** — Tab contratto senza pulsante scarica
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **WEDDING_DETAIL** → osserva.
- **[LOW] SUPPLIER_DETAIL** — Bottone Invita a wedding mancante in dettaglio fornitore
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **SUPPLIER_DETAIL** → osserva.
- **[LOW] PROFILE** — Profile senza textarea bio
  _Repro_: login con wp-mini@planfully-demo.it → vai a sezione **PROFILE** → osserva.

## Passed checks

- [LOGIN] Login WP OK url=https://planfully.it/
- [HOME] Home renderizzata
- [HOME] KPI numerici visibili: 7
- [HOME] Verifica shortcut home eseguita
- [CATALOG] Catalog caricato
- [WEDDINGS_LIST] Matrimoni in lista: 4
- [WEDDING_DETAIL] Wedding detail aperto: https://planfully.it/weddings/1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf
- [WEDDING_DETAIL] Tab Overview aperto
- [WEDDING_DETAIL] Tab Documenti aperto
- [WEDDING_DETAIL] Tab Invitati aperto
- [WEDDING_DETAIL] Tab Tavoli aperto
- [WEDDING_DETAIL] Tab Mood aperto
- [WEDDING_DETAIL] Tab Playlist aperto
- [WEDDING_DETAIL] Tab Contratto aperto
- [WEDDING_DETAIL] Tab Trasporti aperto
- [WEDDING_DETAIL] Tab Alloggi aperto
- [WEDDING_DETAIL] Tab Budget aperto
- [WEDDING_DETAIL] Tab Checklist aperto
- [WEDDING_DETAIL] Tab Analytics aperto
- [SUPPLIERS] Fornitori rete: 8
- [SUPPLIERS] Filtri categoria supplier: 0
- [SUPPLIER_DETAIL] Dettaglio fornitore caricato
- [CALENDAR] Calendar caricato
- [QUOTES_LIST] Preventivi: 6
- [QUOTE_EDITOR] Quote editor aperto
- [QUOTE_EDITOR] Quote editor: bottone "Invia" presente
- [CONTRACTS] Contracts page
- [FINANCE] Finanziamento mostra COMING SOON
- [INSURANCE] Assicurazione mostra COMING SOON
- [BRAND] Brand settings caricato
- [BRAND] Color picker: 2
- [PROFILE] Profile caricato
- [PROFILE] Logout presente
