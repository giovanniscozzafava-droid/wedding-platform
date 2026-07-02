# PRP · Opzione Data dal Preventivo — v1 (Claude Code)

**Stato: CONGELATO dietro il gate** (sicurezza + società/Stripe + 5 capostipiti).
Questo PRP è un PROTOTIPO GIÀ DIMOSTRATO: le funzioni (in `PRP-Opzione-Data-funzioni-testate.sql`)
sono state eseguite e verificate end-to-end su Postgres reale. Non è pseudocodice. **Non costruire
finché il gate non è aperto.**

---

## 1 · Cosa fa

Il cliente che riceve un preventivo può **richiedere un'opzione** sulla data (tenerla bloccata).
Il professionista decide per quanti giorni; parte un **countdown** sul calendario condiviso;
alla scadenza la data si libera da sola. Vale per TUTTI i professionisti (usa `auth.uid()`,
non un ruolo specifico). Il cliente è tracciato e aggiornato.

## 2 · Principio: riusare, non duplicare (70% già nel repo)

VERIFICATO esistente e da RIUSARE:
- `opziona_data(p_date_from, p_date_to, p_days, ...)` — crea l'opzione con `expires_at`.
- `supplier_date_options` — stati OPTIONED/CONFIRMED/RELEASED/EXPIRED.
- **Vincolo anti-overlap** (fix cluster3, `sdo_no_overlap_active`): due opzioni attive sulla
  stessa data per lo stesso professionista sono IMPOSSIBILI a livello Postgres. TESTATO.
- `event_confirmed_on_quote_accepted` — porta l'evento a CONFERMATA all'accettazione del
  preventivo, partendo da IN_TRATTATIVA **o OPZIONATA**. Si incastra già col flusso opzione.
- `entry_status` enum: IN_TRATTATIVA | OPZIONATA | CONFERMATA | RIFIUTATA | CANCELLATA.
- `pg_cron` già presente nel repo (riusare `cron.schedule`).

## 3 · Il 30% da aggiungere

Migrazione unica (funzioni testate: vedi `PRP-Opzione-Data-funzioni-testate.sql`). In sintesi:
- colonne `calendar_entries.option_expires_at` + `option_requested_by` (countdown);
- tabella `quote_option_requests` (cliente CHIEDE, pro CONCEDE) — 3 FK vere, RLS owner + RPC token;
- `richiedi_opzione_da_preventivo(p_token)` — CLIENTE via access_token, no auth; rifiuta doppioni;
- `concedi_opzione(p_request_id, p_days)` — PRO (owner): chiama `opziona_data`, mette l'evento a
  OPZIONATA + `option_expires_at`; se la data è già opzionata da altri, si propaga l'errore;
- `scadi_opzioni()` — CRON: OPTIONED scadute→EXPIRED; eventi OPZIONATA scaduti→IN_TRATTATIVA +
  countdown azzerato; richieste CONCESSA→SCADUTA. Schedulare `*/15 * * * *`.

## 4 · Test rosso→verde (già eseguito — replicare in `tests/`)

1. Cliente `richiedi_opzione_da_preventivo(token)` → `{ok:true}`; seconda → `gia_richiesta`.
2. Pro `concedi_opzione(req, 7)` → evento OPZIONATA, `option_expires_at`=+7gg, disponibilità pro OPTIONED.
3. Concorrenza: secondo `opziona_data` stessa data → FALLISCE (exclusion constraint). ✅
4. Scadenza: forzo `expires_at` nel passato → `scadi_opzioni()` = 1 → evento IN_TRATTATIVA,
   countdown null, opzione EXPIRED, richiesta SCADUTA, data di nuovo opzionabile. ✅

## 5 · Frontend (v1 minima)

- Pagina pubblica preventivo (/p/… con accept/reject): bottone "Richiedi opzione sulla data" → RPC.
- Lato pro: scheda evento/notifica, "Concedi opzione" con selettore giorni (7/14/30) + countdown.
- Calendario: rendering OPZIONATA con giorni residui (da `option_expires_at`).
- Notifiche: al concedere → email al cliente; allo scadere (cron) → email a entrambi.
  Riusare user_notifications + Resend DOPO che le GUC notifiche sono a posto.

## 6 · [DECISIONE] — da sciogliere prima del build

1. **Cosa succede allo scadere?** Proposta: OPZIONATA→IN_TRATTATIVA (meno distruttivo) + notifica al pro.
2. **Cliente ACCETTA durante l'opzione:** `event_confirmed_on_quote_accepted` porta già a CONFERMATA;
   aggiungere SOLO: `supplier_date_options`→CONFIRMED + richiesta a stato finale (ramo felice da completare).
3. **Rinnovo/proroga:** `proroga_opzione(request, giorni)` (v1.1).
4. **Chi può richiederla:** dal preventivo (token) e/o il pro a mano — confermare entrambe le vie.

## 7 · Guardrail

- Ogni id è FK (quote_option_requests ha 3 FK vere). Countdown = snapshot (`option_expires_at`
  congelato alla concessione). Vincolo anti-overlap intoccabile. Endpoint cliente solo via
  access_token, nessun grant anon. Coordinarsi con `event_confirmed_on_quote_accepted` (niente
  secondo trigger che compete su `calendar_entries.status`).

## 8 · Stima

Migrazione (già scritta e testata): ~0,5 gg. Frontend: ~1,5 gg. Notifiche: ~0,5. Test: ~0,5.
**Totale ~3 giornate.** Il grosso della logica è già dimostrato. **Non ora.**
