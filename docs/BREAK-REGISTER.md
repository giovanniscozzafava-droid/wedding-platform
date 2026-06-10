# BREAK-REGISTER — registro rotture (audit adversariale, NOTTE 1 diagnosi)

> Branch `chore/adversarial-audit`. Ogni rottura è **riprodotta** con un test rosso in `tests/adversarial/` (un blocco `do $$ … raise exception 'BRK-…' … $$;` che scatta SOLO quando la rottura è presente, in `begin/rollback` autonomo). Eseguito contro il DB locale, definizioni **realmente deployate** (`pg_get_functiondef`), 0 errori di setup. Nessun file di prodotto modificato: questa è la notte della diagnosi, i fix sono un'altra notte.

## 3 righe per Giovanni
1. **La rottura 🔴 più pericolosa** — *gli atti legali firmati non sono protetti*. Un contratto FIRMATO + l'accettazione firmata si possono **distruggere in silenzio** (`delete_quote_cascade`/`delete_wedding_cascade`, **e** `DELETE` diretto via le policy RLS `*_delete_owner` che scavalcano le RPC), lasciando il registro firme **immutabile** (`signature_audit_trail`) **orfano e incancellabile** (BRK-C-01/02/05/10). Peggio: `contract_sign_full` permette di **ri-firmare un contratto già FIRMATO sovrascrivendo il firmatario**, e poiché lo stato resta FIRMATO il trigger d'audit non scatta → **il contratto diverge dal proprio registro legale** (BRK-A-07/07b). È perdita/falsificazione silenziosa di prove legali.
2. **Dove il modello "vasi comunicanti" perde più facilmente** — *l'asse markup → prezzo cliente*. Lo snapshot regge su **costo e nome del servizio** (il fornitore che alza il prezzo o rinomina dopo l'invio NON si propaga — BRK-E-SNAPSHOT-01 resiste), ma `line_client` — il numero che il cliente ha **accettato** — è ricalcolato **live** dai trigger di markup (`quotes_default_markup_after_update`, `quote_supplier_markup_after_change`) **senza guard di stato e senza bump di revision**: cambiare il markup dopo l'accettazione altera in silenzio l'importo concordato (234 → 324 / 450) — BRK-E-SNAPSHOT-02/03.
3. **Dove ha resistito meglio** — il **claim atomico** di `quote-accept-sign` in race reale a 2 sessioni (vince una sola, BRK-B-02 resiste); la **state machine** `quotes_validate_status_transition` (blocca ACCETTATO→RIFIUTATO, CONVERTITO→INVIATO, ecc.); lo **snapshot costo/nome** del servizio; la **parametrizzazione** (niente SQLi, testo salvato come dato).

## Tabella di conteggio
| Famiglia | 🔴 | 🟠 | 🟡 | ⚪ | tentati-ma-resistono |
|---|---|---|---|---|---|
| A · macchine a stati | 10 | 1 | 1 | 0 | A-01 ACCETTATO→RIFIUTATO bloccato; A-02 accept su RIFIUTATO no-op; A-03 CONVERTITO→INVIATO bloccato; A-04 promote su CONVERTITO no-op; A-05 INSERT contratto da BOZZA bloccato; A-13 doppia accept idempotente; A-16 addendum su contratto non firmato → no_signed_contract |
| B · concorrenza | 0 | 2 | 0 | 0 | **B-02 claim atomico TIENE** (race reale: 1 sola sessione vince) |
| C · orfani/cascate | 4 | 4 | 1 | 0 | cancellare un SERVIZIO in un preventivo inviato → snapshot regge (name/price/totale intatti); nessuna FK blocca cancellazioni legittime su quotes/contracts |
| D · confini/input | 1 | 9 | 2 | 1 | snapshot_price<0 e quantity<0 bloccati; totali negativi clampati a 0; name>200 char rifiutato; emoji ok; 29-feb bisestile ok / non-bisestile rifiutato; calendar_entries date_to<date_from bloccato; SQLi testo regge |
| E · contabilità | 2 | 5 | 1 | 1 | self-referral/doppia redenzione bloccati; auto-attribuzione recruiting bloccata; furto recruit bloccato; cap giornaliero NON superabile; gate 2027 rispettato; re-settle SETTLED bloccato; offset reciproci hardenizzati |
| **TOTALE** | **17** | **21** | **5** | **2** | + BRK-D-ICS ⚪ (JS, non-SQL) |

**45 rotture provate con test rosso** (SQL) + 1 documentata su Edge (D-ICS). Niente "credo/sembra": ogni voce ha un test che fallisce.

---

## Famiglia A — macchine a stati (`tests/adversarial/A_state_machine.sql`)
| ID | sev | flusso | Atteso → Successo | Prova |
|---|---|---|---|---|
| BRK-A-06 | 🔴 | contratto↔quote | rifiutare il relink → contratto ri-legato a quote **BOZZA** | `contracts_enforce_quote_accettato` è solo `BEFORE INSERT`; `UPDATE contracts SET quote_id` lo scavalca |
| BRK-A-07 | 🔴 | firma contratto | bloccare la ri-firma su FIRMATO → `signature_data.name='ATTACKER'` | `contract_sign_full WHERE status in (BOZZA,INVIATO,FIRMATO)` sovrascrive il firmatario |
| BRK-A-07b | 🔴 | audit firma | audit allineato → contratto=ATTACKER, `signature_audit_trail`=ORIGINALE | re-firma tiene `old.status=FIRMATO` → `sig_audit_from_contract_sign` (WHEN old≠FIRMATO) non scatta |
| BRK-A-08 | 🔴 | firma addendum | bloccare la ri-firma → `signer_data.name='ATTACKER'` | `addendum_sign_full` stesso WHERE include FIRMATO |
| BRK-A-09 | 🔴 | controfirma | esigere FIRMATO → controfirma su **BOZZA** con `signed_at` NULL | `countersign_contract` controlla solo `countersign_at is null`, non lo stato |
| BRK-A-10 | 🔴 | token revocato | rifiutare la firma → `contract_sign_full` ritorna true | manca il check `token_revoked_at` (presente nel legacy `contract_sign_by_token`) |
| BRK-A-11 | 🔴 | token scaduto | rifiutare la firma → ritorna true | manca il check `access_token_expires_at` |
| BRK-A-12 | 🔴 | decisione voce | bloccare il rifiuto di una voce a contratto → decision=RIFIUTATO con `contracted_at` valorizzato | `client_decide_quote_item` guarda solo `closed_at`, ignora `contracted_at` |
| BRK-A-14 | 🟡 | chiusura quote | esigere ACCETTATO → quote **INVIATO** congelato (`closed_at` settato) | `quote_conclude_by_client` setta `closed_at` senza check di stato |
| BRK-A-15 | 🟠 | riapertura quote | bloccare la riapertura → quote **CONVERTITO_IN_CONTRATTO** riaperto | `quote_reopen` senza status guard (combinato con A-12 → ridecidere voci di un contratto firmato) |
| BRK-E-SNAPSHOT-02 | 🔴 | snapshot prezzo | immutabile su ACCETTATO → `line_client 234→324`, revision invariata | `quotes_default_markup_after_update` senza status guard né bump revision |
| BRK-E-SNAPSHOT-03 | 🔴 | snapshot prezzo | immutabile su ACCETTATO → `line_client 234→450`, revision invariata | `quote_supplier_markup_after_change` (override) senza status guard |

## Famiglia B — concorrenza (`tests/adversarial/B_concurrency.sql`)
| ID | sev | flusso | Atteso → Successo | Prova |
|---|---|---|---|---|
| BRK-B-01 | 🟠 | calendario/opzioni | una data già opzionata non ri-opzionabile per altro cliente → 2 opzioni attive stessa data | `supplier_date_options` non ha unique su (supplier_id,date); `opziona_data` ritorna ok:true entrambe |
| BRK-B-03 | 🟠 | preventivo/2 tab | rilevare la modifica concorrente → secondo salvataggio sovrascrive il primo, nessun errore | `quotes` non ha colonna di optimistic-lock; race reale: ORIGINALE→EDIT_B→EDIT_A, EDIT_B perso |
| BRK-B-02 | ✅ resiste | firma/accettazione | una sola sessione vince il claim ACCETTATO | race reale 2 sessioni: A→UPDATE 1, B→UPDATE 0 |

## Famiglia C — orfani e cascate (`tests/adversarial/C_cascades.sql`)
| ID | sev | flusso | Atteso → Successo | Prova |
|---|---|---|---|---|
| BRK-C-01 | 🔴 | firma/contratto | atto firmato non cancellabile → quote/contract/acceptance distrutti, **2 audit immutabili orfane** | `delete_quote_cascade` senza check FIRMATO; `signature_audit_trail` polimorfico non cascada |
| BRK-C-02 | 🔴 | calendario/firma | idem via evento → audit orfane=2 | `delete_wedding_cascade` |
| BRK-C-03 | 🟡 | utente | cancellare un utente con un `event_documents` caricato deve riuscire → `foreign_key_violation` | `event_documents_uploaded_by_fkey` = **NO ACTION** (unica FK bloccante su profiles) |
| BRK-C-04 | 🟠 | firma/contratto | cancellare il fornitore non deve sfigurare l'atto → `contracts.supplier_id=NULL` su FIRMATO | FK `contracts_supplier_id_fkey` SET NULL (firmatario irrintracciabile) |
| BRK-C-05 | 🔴 | utente | cancellare il WP non distrugge gli atti → quote/acceptance/contratto FIRMATO distrutti, audit orfane=2 | `owner_id` CASCADE (raggiungibile da `admin-delete-user`) |
| BRK-C-06 | 🟠 | preventivo | rimuovere il supplier mantiene la riga coerente → `quote_items.supplier_id=NULL`, markup sparito ma incorporato nel prezzo | `quote_supplier_markups` CASCADE, `quote_items` SET NULL |
| BRK-C-08 | 🟠 | lead | lead vinto coerente → `supplier_leads.status='WON'` con `converted_quote_id=NULL` | FK SET NULL, nessun ricalcolo dello stato lead |
| BRK-C-09 | 🟠 | calendario/firma | `DELETE` calendario coerente o bloccato → contratto FIRMATO con `entry_id=NULL` | policy `calentry_delete_owner` scavalca la RPC; FK SET NULL |
| BRK-C-10 | 🔴 | preventivo/firma | `DELETE` quote coerente o bloccato → acceptance persa, contratto FIRMATO con `quote_id=NULL`, audit orfana | policy `quotes_delete_owner` scavalca la RPC |

## Famiglia D — confini e input (`tests/adversarial/D_boundaries.sql`)
| ID | sev | flusso | Atteso → Successo | Prova |
|---|---|---|---|---|
| BRK-D-06 | 🔴 | INSERT markup | CHECK coerente col tipo → CHECK ammette ≤1000 ma colonna `numeric(5,2)` (max 999.99) | markup=1000 → `numeric_value_out_of_range` su `quote_items` e `quote_supplier_markups` |
| BRK-D-01 | 🟠 | recalc voce | sconto voce ≥0 → ammesso fino a -1000 | `item_discount_percent=-1000`: line_client = 11× il costo |
| BRK-D-02 | 🟠 | recalc voce | markup ≥ costo per terzi → -100 ammesso | line_client=0, margine=-1000 (WP regala il servizio terzi) |
| BRK-D-03 | 🟠 | recalc voce | warning sotto-costo → nessuno | terzi markup 0 + sconto 90% → client 100 < costo 1000, margine -900 |
| BRK-D-04 | 🟠 | recalc totali | sconto totale ≥0 → -1000 ammesso | `total_discount_percent=-1000`: total_client = 11× subtotale |
| BRK-D-14 | 🟠 | recalc totali | avviso su costo terzi assorbito → nessuno | sconto 100% su terzi: total_client=0, margine=-1000 |
| BRK-D-17 | 🟠 | recalc totali | upper-bound sullo sconto fisso → solo ≥0 | `total_discount_amount=999999`: total_client clamp 0, margine -1000 |
| BRK-D-18 | 🟠 | recalc totali | lo sconto non azzera il costo proprio reale → `v_factor` applicato al costo | sconto 100% su servizio proprio: total_cost=0 (costo reale 1000 sparito dai conti) |
| BRK-D-07 | 🟠 | opziona_data | range invertito rifiutato → salvato, 0 date marcate, ok:true | nessun check `date_to≥date_from` |
| BRK-D-09 | 🟠 | opziona_data | cap sull'ampiezza → nessun limite | 2026→2036: 3653 righe availability in 1 chiamata |
| BRK-D-08 | 🟡 | opziona_data | data passata rifiutata → accettata | `2020-01-01` ok:true |
| BRK-D-11 | 🟡 | supplier_clients | validazione email/CF → 0 CHECK | email malformata + fiscal_code 3 char accettati |
| BRK-D-16 | ⚪ | round per-riga | somma per-riga = aggregato → diverge di 1 cent | 3×(33.33% su 0.10): Σ 0.39 vs 0.40 |
| BRK-D-ICS | ⚪ | calendar-export-ics | escape RFC5545 di `;`/`,`/`\` in SUMMARY → solo `\n` sostituito | titolo con `;`/`,` rompe il parsing del client calendario (test JS, non SQL) |

## Famiglia E — contabilità senza incasso (`tests/adversarial/E_accounting.sql`)
| ID | sev | flusso | Atteso → Successo | Prova |
|---|---|---|---|---|
| BRK-E-01 | 🔴 | referral/crediti | bloccare il credito se `accept_referrals=false` → credito **ACCEPTED 39€** creato | `autocredit_on_referred_contract` salta il consenso del debitore |
| BRK-E-02 | 🔴 | crediti | rifiutare un CANCELLED → `settle_supplier_credit(_,'CASH')` lo porta a SETTLED; la commissione entra in `admin_finance_overview` | guard solo su `status='SETTLED'` |
| BRK-E-03 | 🟠 | success fee | WP iscritta da 3 anni paga 7.00 → fatturata 3.50 | `lead_transition`: sconto primo-anno 50% senza check anzianità |
| BRK-E-04 | 🟠 | MRR/referral | 1 credito MRR per periodo → 4 crediti FORNITORE_MRR | `on_supplier_subscription_change` senza dedup per periodo |
| BRK-E-05 | 🟠 | success fee | 1 credito WP_LEAD per lead → 2 (ciclo CLOSED_WON→QUOTED→CLOSED_WON) | `on_lead_closed_won` senza idempotenza su lead_id |
| BRK-E-06 | 🟠 | crediti | consenso del creditore per il saldo → il **debitore** salda da solo come SETTLED/CASH | `settle_supplier_credit` accetta entrambe le parti |
| BRK-E-07 | 🟠 | admin finance | escludere CANCELLED/DISPUTED → `commissioni_da_incassare` li include | `admin_finance_overview` somma senza filtro stato |
| BRK-E-08 | 🟡 | recruiting | oltre cap 100€/g il reward rimatura → diventa EARNED amount=0 earned_at=oggi, 20€/cad persi | `recruiting_activate_reward`/`recruiting_settle_due` |
| BRK-E-09 | ⚪ | metriche | send_rate ≤100% → 300% | `professional_funnel_metrics`: leads e quotes_sent contati su basi diverse |

---

## Pattern trasversali (per la notte dei fix)
- **Atti legali senza protezione** (A-07/07b/08/09/10/11, C-01/02/05/10): manca un guard "FIRMATO è terminale" (no re-sign, no delete, no relink, no countersign-prima-della-firma) e `signature_audit_trail` non ha FK né è raggiunto dalle cascate.
- **Trigger di ricalcolo senza status guard** (E-SNAPSHOT-02/03, A-15+A-12): `line_client`/stato cambiano dopo l'accettazione senza revision.
- **RPC scavalcabili dalle policy RLS** (C-09/C-10): la logica "sicura" sta solo nelle `*_cascade`, ma `*_delete_owner` permette il DELETE diretto.
- **CHECK economici troppo larghi / incoerenti col tipo** (D-01/02/03/04/06/14/17/18): -1000% ammesso, markup 1000 in overflow, costi propri azzerati dallo sconto.
- **Contabilità non finanziata e non idempotente** (E-01/04/05/02/06/07): crediti maturano/si saldano senza copertura né dedup.
