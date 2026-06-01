# Planfully — Gap analysis & backlog operativo

> Generato confrontando `docs/PLANFULLY-OPERATIONAL-SPEC.md` con il codice reale (8 analisi parallele + sintesi). 168 voci.

## 1) Sintesi esecutiva

Su **168 voci** confrontate col codice reale, **123 risultano già implementate (exists, ~73%)**, **30 parziali (partial, ~18%)** e **15 mancanti (missing, ~9%)**. La copertura funzionale del documento operativo è quindi ampia: i moduli lead (capostipite + fornitore), area cliente, pianificazione coppia, disponibilità fornitore, contratti/firma elettronica semplice, team, network/community e dashboard sono per la grande maggioranza presenti e funzionanti. I buchi più gravi sono concentrati nel **cluster Sicurezza e legalità (sezioni 19, 20, 43, 44)**: a priorità **P0** restano **6 voci missing** e **7 partial** che riguardano la gestione dei token di azione (hash, revoca, rotazione, monouso esplicito), l'**assenza di audit trail strutturato** su tutte le tabelle sensibili e la **mancanza di una `signature_audit_trail` immutabile** con hash di integrità e numero documento cifrato. Questi gap sono ad alto rischio legale (compliance firma/CAD, GDPR sui dati documento in chiaro) pur non bloccando l'operatività quotidiana. Le fondamenta difensive (constraint DB, gating contratto server-side, RLS, mascheramento margini al cliente, lockdown tabelle audit) sono invece già solide, il che rende gli interventi residui incrementali e a basso rischio di regressione.

## 2) Tabella riassuntiva per priorità

| Priorità | Totale | exists | partial | missing |
|----------|:------:|:------:|:-------:|:-------:|
| **P0** | 27 | 14 | 7 | 6 |
| **P1** | 47 | 36 | 9 | 2 |
| **P2** | 35 | 24 | 7 | 4 |
| **P3** | 34 | 28 | 4 | 2 |
| **P4** | 11 | 10 | 1 | 0 |
| **P5** | 14 | 11 | 2 | 1 |
| **Totale** | **168** | **123** | **30** | **15** |

---

## 3) Dettaglio per priorità

### P0 — Sicurezza, legalità e fondamenta

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| secure_action_tokens con scadenza | partial | 20260527020000_security_hardening.sql:36-41 | `access_token_expires_at` esiste su quotes/contracts ma manca tabella dedicata `secure_action_tokens`; token UUID in chiaro, nessun mapping `token_hash` | M | high |
| Token monouso (no rifirma) | partial | 20260528310000_fix_sign_race.sql:22-43; 20260529130000_couple_get_quote_autotoken.sql:48-54 | Idempotenza via gate atomico ma nessun flag `used` né tabella di audit del consumo token | M | medium |
| Token revocation mechanism | missing | 20260521150700_wedding_suite.sql:78-105 | Nessuna colonna `revoked_at`/`is_revoked`; RPC firma non controlla revoca | M | high |
| Token hash (no plaintext) | missing | 20260526120000_quote_get_by_token_v2.sql:17; 20260521150700_wedding_suite.sql:90 | Token UUID in chiaro usato direttamente nelle RPC; manca `token_hash` | L | high |
| Rotazione token già esposti | missing | nessuna migrazione/RPC | Nessun meccanismo per rigenerare un token compromesso | M | high |
| RLS audit su lead_requests | partial | 20260526280000_lead_requests.sql:61-74 | RLS presente ma nessun audit trail degli accessi ai lead | M | medium |
| RLS audit su supplier_leads/supplier_clients | partial | migrazioni supplier_clients (RLS) | RLS presente, nessun audit_event_log degli accessi | M | medium |
| RLS audit su quotes/quote_revisions | partial | RLS su quotes | Nessuna tabella che logghi chi legge quale quote e quando | M | medium |
| RLS audit su contracts | partial | 20260521150700_wedding_suite.sql:106-110 | RLS presente, nessun audit trail accessi contratti | M | medium |
| RLS audit su signature_audit_trail | missing | 20260524190000_quote_acceptance.sql | Nessuna tabella immutabile separata di firme con timestamp/hash | M | high |
| RLS audit su payment_schedules | missing | nessuna migrazione | Nessun tracking di chi modifica scadenza/stato pagamento | M | medium |
| RLS audit su documents | missing | nessuna migrazione | Nessun audit trail accessi ai documenti evento | M | medium |
| Constraint prezzi non negativi | exists | 20260521150000_schema.sql:87; 20260526030000_quote_check_non_negative.sql:9-11 | — | S | low |
| Constraint quantità positive | exists | 20260521150000_schema.sql:222 | — | S | low |
| Constraint date_from <= date_to | exists | 20260521150000_schema.sql:153 | — | S | low |
| Cifratura/mascheramento numeri documento | partial | 20260524190000_quote_acceptance.sql:15; quote-accept-sign/index.ts:102 | `doc_number` e fiscal_code salvati in plaintext; sez. 44 richiede cifratura/mascheramento | M | high |
| Riduzione colonne profili pubblici | exists | 20260526290000_wp_public_profile.sql | — | S | low |
| Gating contratti server-side (quote accettato) | exists | 20260529180000_contract_requires_quote_accettato.sql | — | S | low |
| Lockdown audit tables | exists | 20260601700000_audit_tables_lockdown.sql | — | S | low |
| RLS su lead_requests e supplier_clients | exists | RLS WP/supplier/admin | — | S | low |
| party_kind enum | exists | 20260528290000_supplier_contracts.sql:18-23 | — | S | low |
| Trigger enforce quote ACCETTATO (CLIENT_WP) | exists | 20260529180000_contract_requires_quote_accettato.sql:15-58 | — | S | low |
| CHECK contracts FIRMATO → signed_at NOT NULL | exists | 20260526010000_fix_contracts_signed_at_backfill.sql:54-70 | — | S | low |
| Fiscal data snapshot a firma | exists | 20260526140000_fiscal_data.sql:21-33 | — | S | low |
| Visibilità cliente: non vede margini/costi interni | exists | 20260529110000_quote_mask_global.sql:42-56 | — | S | low |
| Visibilità: contratti in GLOBAL non espongono supplier | exists | 20260601760500_client_portal.sql:200-211 | — | S | low |
| Nessun leak cross-tenant | exists | 20260601760500_client_portal.sql:214-218 | — | S | low |

### P1 — Funzionalità core lead, contratti, area cliente

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| Tabella lead_requests | exists | 20260526280000_lead_requests.sql:10-52 | — | S | low |
| RPC submit_lead_request | exists | 20260526280000_lead_requests.sql:77-134 | — | S | low |
| RPC lead_transition (auto-billing) | exists | 20260526280000_lead_requests.sql:137-186 | — | S | low |
| RPC create_event_from_lead | exists | 20260601620000_create_event_from_lead.sql:14-104 | — | S | low |
| Propagazione profile_answers | exists | 20260601640000_lead_profile_answers.sql:14-159 | — | S | low |
| Tabella supplier_clients | exists | 20260525120000_supplier_standalone_clients.sql:14-38 | Stati LEAD/TRATTATIVA/CLIENTE/ARCHIVIATO meno granulari della spec (NEW→…→WON/LOST) | M | medium |
| RPC submit_public_lead (form unificato) | exists | 20260601740000_submit_public_lead_unified.sql:24-104 | — | S | low |
| Form embeddabile (iframe) | exists | EmbedLeadPage.tsx:1-302 | — | S | low |
| Landing pubblica WP | exists | PublicWpPage.tsx:84-300 | — | S | low |
| Landing pubblica fornitore | exists | PublicSupplierPage.tsx:52-102 | — | S | low |
| Form event-aware | exists | EmbedLeadPage.tsx:29-53; PublicWpPage.tsx:58-82 | — | S | low |
| Source/UTM tracking | exists | lead_requests.source; EmbedLeadPage:130 | — | S | low |
| Direct client quote (quote_origin) | partial | 20260525120000_supplier_standalone_clients.sql:48 | `direct_client_id` presente ma manca colonna `quote_origin` strutturata | M | medium |
| Lead fornitore → preventivo diretto | partial | 20260525120000_supplier_standalone_clients.sql:80-103 | Nessuna RPC `create_quote_from_supplier_lead`; flusso manuale | L | high |
| Budget readiness gate (COMPLETO vs ristretto) | exists | 20260601610000_quote_budget_readiness.sql:23-96 | — | S | low |
| Notifica email lead | exists | lead-notify/index.ts:1-116 | — | S | low |
| quote_budget_readiness (FORNITORE_DIRETTO/COMPLETO/ristretto) | exists | 20260601610000_quote_budget_readiness.sql | — | S | low |
| Gate server-side contract creation | exists | 20260601610000_quote_budget_readiness.sql:93 | Da verificare che il frontend la chiami prima di creare contratto | S | medium |
| quote_status enum + transizioni | exists | 20260521150000_schema.sql:18 | Non documentato se CONVERTITO_IN_CONTRATTO è automatico o manuale | S | low |
| supplier_confirmed_at | exists | 20260530320000_fase3_quote_item_confirm.sql | — | S | low |
| access_token scadenza e monouso (quote acceptance) | partial | 20260521150000_schema.sql:185; 20260524190000_quote_acceptance.sql | Manca revoca su rifiuto, gate monouso esplicito, cleanup scaduti, audit token | M | high |
| party_kind coerenza con business_model | partial | 20260524210000_business_model.sql; 20260528290000_supplier_contracts.sql | Mapping logico presente ma nessun trigger/constraint che impedisca combinazioni illegali (solo validazione frontend) | M | high |
| standard_contract_clauses libreria | exists | 20260529210000_standard_contract_clauses.sql | — | S | low |
| signature_audit_trail tabella immutabile | missing | grep zero risultati | Firma in contracts.signature_data jsonb; nessun audit log immutabile con hash | L | high |
| Hash integrità documento (PDF/contract) | partial | quote-accept-sign/index.ts:147; contract-generate-pdf/index.ts | Quote hanno `quote_pdf_hash` SHA-256; contratti non calcolano/salvano hash | M | high |
| Doc number cifrato | missing | grep zero risultati | Nessun numero documento sequenziale protetto/cifrato | M | medium |
| Firma idempotente | exists | 20260526011000_fix_contract_sign_from_bozza.sql:15-35 | — | S | low |
| create_contract_from_clauses RPC | exists | 20260601800000_ambito_contract_gate_supervision.sql:16-97 | Nessun trigger che impedisca CLIENT_WP + SUPPLIER_WP per lo stesso evento | M | medium |
| supplier_contracts (create_supplier_contract) | exists | 20260528290000_supplier_contracts.sql:98-191 | Nessun controllo che blocchi SUPPLIER_WP se business_model=BROKER | M | medium |
| PDF contratto generato | exists | contract-generate-pdf/index.ts:1-200+ | Nessun hash SHA-256 calcolato/salvato post-generazione | M | medium |
| Area cliente aggregata per email verificata | exists | 20260601760500_client_portal.sql:144-227 | — | S | low |
| Area cliente separata per professionista | exists | 20260601760500_client_portal.sql:162-219 | — | S | low |
| Magic link/OTP accesso area cliente | exists | ClientAccessPage.tsx:20-38; 20260601760500:27-51 | — | S | low |
| Provisioning profilo CLIENT automatico | exists | 20260601760500_client_portal.sql:43-48 | — | S | low |
| Brief visualizzazione in area cliente | exists | 20260601760500:185-195; ClientPortalPage.tsx:170-208 | — | S | low |
| client_portal_overview RPC | exists | 20260601760500:145-227 | — | S | low |
| Constraint percentuali 0-100 | partial | 20260521150000_schema.sql:34-35 | Range -100..1000 anziché 0-100; manca constraint su item/supplier markup | S | medium |
| Constraint enum validi (coerenza business_model↔party_kind) | partial | 20260524210000; 20260528290000 | Enum enforced ma nessun trigger di coerenza cross-table | M | medium |
| Audit accessi anonimi | partial | quote-accept-sign/index.ts | IP/UA salvati solo su quote_acceptances; nessun audit_log separato accessi anon | M | medium |

### P2 — Preventivi avanzati, contratti, document center, dashboard

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| quote_origin | missing | — | Colonna/enum origine preventivo assente | M | medium |
| quote_context (jsonb) | missing | — | Nessuna colonna jsonb di contesto su quotes | M | medium |
| quote_revisions (snapshot) | partial | quotes.revision; quote_acceptances.quote_revision | Manca tabella di snapshot storici (items/prezzi/markup per revisione) | L | high |
| margin_mode (HIDDEN_MARKUP/EXPLICIT/MIXED) | missing | — | Nessun enum margin_mode né gate visibilità markup nei PDF | L | high |
| override voce>preventivo>evento>profilo | partial | 20260521150100_triggers.sql:62-89 | 3 livelli (item/supplier/quote); manca livello evento e override margin_mode | M | medium |
| QuoteEditorPage UI (origin/context/margin/history) | partial | QuoteEditorPage.tsx | Manca UI per quote_origin, quote_context, margin_mode, history revisioni, override gerarchico | L | medium |
| PDF variant masking GLOBAL vs BROKER | partial | 20260521150000_schema.sql:192 | pdf_variant esiste ma logica testo per modello non tracciata; manca RLS visibilità PDF | M | high |
| contract_clause_templates versioning | exists | 20260528290000_supplier_contracts.sql | Manca colonna version/snapshot esplicita | M | medium |
| contract_addendums (BOZZA→INVIATO→FIRMATO) | missing | grep solo commento UI | Nessuna tabella addendum, enum stati, amount_delta, date_change | L | high |
| Firma offline | exists | 20260529190000_contract_sign_offline.sql:24-96 | Nessun hash PDF/immutabilità garantita | S | medium |
| Form role-aware per subrole fornitore | partial | PublicSupplierPage.tsx:15-50 | Form non adatta domande/stili per subrole (fotografo vs catering) | M | medium |
| Deduplicazione lead | exists | 20260525160000_conflict_alerts.sql:20-148 | Alert su quotes, non su lead_requests diretti duplicati | M | medium |
| Link area cliente in email transazionali | partial | quote-send/index.ts:184-210 | Manca link diretto a /area-cliente nell'email | M | medium |
| Document center tabella documents | partial | 20260521150700_wedding_suite.sql:176-189 | event_documents senza colonna visibility (PRIVATE/PUBLIC/ADMIN_ONLY) | L | high |
| payment_schedules (scadenzario_voci) | exists | 20260530300000_fase3_scadenzario.sql:28-143 | — | M | medium |
| event_audit_timeline | exists | 20260530130000_fase1_audit_log.sql:5-26 | — | M | medium |

### P3 — Disponibilità, pianificazione coppia, notifiche

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| Enum stati disponibilità evoluti (8 stati) | partial | 20260524100000_supplier_availability.sql:8; SupplierAvailabilityPage.tsx:10 | Solo 3 stati (AVAILABLE/BUSY/TENTATIVE); mancano OPTIONED, IN_NEGOTIATION, BLOCKED_BY_*, MANUAL_BUSY, UNAVAILABLE | M | medium |
| Rilascio regressione (ACCETTATO→BOZZA libera data) | missing | 20260525140000_auto_block_availability.sql:16 | Strategia forward-only; nessun trigger di rilascio automatico | M | medium |
| Funzione 'opziona data' con scadenza e reminder | missing | nessuna migrazione OPTIONED | Nessuno stato OPTIONED né job reminder per scadenza opzione | L | high |
| Blocco automatico su preventivo ACCETTATO | exists | 20260525140000:37-51; 20260528220000:137-177 | — | S | low |
| Blocco automatico su contratto FIRMATO | exists | 20260525140000:90-134 | — | S | low |
| Blocco multi-giorno (date_from..date_to) | exists | 20260528220000:94-177 | — | S | low |
| Esclusione self-quote dai conflitti | exists | 20260601400000_availability_exclude_self_quote.sql:17-115 | — | S | low |
| Sblocco manuale (warning se FIRMATO) | exists | SupplierAvailabilityPage.tsx:82-237 | — | S | low |
| Alloggi/Trasporti coppia read-only | partial | 20260521150900_couple_role.sql:107-111 | Nessuna write policy per richiedere modifiche via change_requests | M | medium |
| Richieste modifica (couple_change_requests) | exists | 20260524140000_couple_change_requests.sql:5-28 | — | S | low |
| Richieste modifica EVENT_DATE | exists | 20260601500000_change_request_event_date.sql:1-18 | — | S | low |
| event_next_actions + refresh_notifiche_per_evento | exists | 20260530200000_fase2_notifiche.sql:14-255 | — | M | medium |
| dashboard_professionista (entry point unico) | partial | FunnelMetrics.tsx; WeddingDashboard/PagamentiTab | Manca un unico entry point con tutte le metriche aggregate | M | medium |

### P4 — Team, funnel, feature flags

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| feature_flags (sistema generico) | partial | nessuna tabella dedicata; subscription_status sparsi | Gating implicito via subscription/founding_member; manca sistema generico flag pilot/beta | M | medium |
| professional_funnel_metrics | exists | 20260601780000_funnel_metrics.sql:14-85; FunnelMetrics.tsx:32-112 | — | S | low |
| supplier_team_* (membri/eventi/presenze/PDF) | exists | 20260601820000_supplier_team.sql; SupplierTeamPage.tsx:222-246 | — | S | low |

### P5 — Sito ospiti/RSVP, network, community, prodotti finanziari

| Feature | Stato | Evidenza | Gap | Effort | Rischio |
|---|---|---|---|---|---|
| product_interest_requests | missing | nessuna migrazione | Nessuna tabella/RPC di raccolta interesse finanziamento/assicurazione | M | medium |
| feed_moderation_stati | partial | 20260526260000_social_feed.sql:9-22 | Posts senza colonna stati moderazione (DRAFT/HIDDEN/REPORTED/REMOVED) | M | medium |
| RSVP dati pubblici limitati | partial | 20260521150800_logistics_suite.sql:313-330 | wedding_site_rsvp senza verifica SELECT su event_guests post-insert | M | medium |
| Sito ospiti + RSVP idempotente | exists | 20260526010100_fix_rsvp_idempotent.sql:31-74; WeddingSitePage.tsx | — | S | low |
| network_collaborations / referral / rewards | exists | collaborations; 20260526360000_referral_system.sql:60-387 | — | M | low |
| community_feed / like / comment | exists | 20260526260000_social_feed.sql | — | M | low |

---

## 4) Prossimi 10 interventi consigliati (ordine di esecuzione)

Privilegio i P0 a basso/medio rischio di regressione che chiudono i criteri di accettazione "Sicurezza e legalità", partendo da fondamenta riutilizzabili (audit centralizzato, hardening token) prima delle feature derivate.

1. **Tabella audit accessi centralizzata (`access_audit_log`)** — immutabile `(actor_id, actor_email, table_name, record_id, action READ/WRITE, ip, user_agent, at)`, RLS service_role/SECURITY DEFINER only (pattern `20260601700000_audit_tables_lockdown.sql`). *Accettazione*: SELECT diretto da anon/authenticated negato; chiude 6 voci RLS-audit P0.
2. **Hash + revoca token su quotes/contracts** (`token_hash`, `revoked_at`, `consumed_at`); le RPC cercano per hash + check `revoked_at IS NULL AND now() < expires_at`. *Accettazione*: token in chiaro non più leggibile; firma su token revocato → errore; chiude 3 voci P0.
3. **RPC `rotate_access_token(entity, id)`** — invalida il corrente, genera nuovo token+hash, restituisce il chiaro una volta. *Accettazione*: vecchio link 404, nuovo ok; chiude P0 "Rotazione token già esposti".
4. **`signature_audit_trail` immutabile** `(contract_id/quote_id, event_type, signer_name, doc_number_enc, pdf_hash_sha256, ip_hash, user_agent, signed_at)` + trigger no UPDATE/DELETE; popolata da `contract_sign_by_token` e `quote-accept-sign`. *Accettazione*: ogni firma → riga immutabile.
5. **Hash integrità PDF contratto** — SHA-256 in `contract-generate-pdf`, salvato su `contract_pdf_hash`. *Accettazione*: hash non null per ogni PDF.
6. **Cifratura/mascheramento numeri documento** — `doc_number`/fiscal_code via pgcrypto/Vault, masking in lettura. *Accettazione*: non leggibile in chiaro via SELECT diretto.
7. **Trigger coerenza `business_model` ↔ `party_kind`** — GLOBAL⇒CLIENT_WP; BROKER⇒SUPPLIER_CLIENT; vieta SUPPLIER_WP in BROKER. *Accettazione*: INSERT illegale fallisce a livello DB.
8. **Constraint range percentuali markup** — CHECK su item/supplier markup. *Accettazione*: valori fuori range respinti.
9. **Flag monouso esplicito su acceptance quote** — `consumed_at` come gate atomico; revoca token su RIFIUTATO; cron cleanup scaduti. *Accettazione*: seconda accept stesso token → no-op idempotente.
10. **Verifica gate budget_readiness lato UI prima della creazione contratto** — confermare la chiamata client a `quote_budget_readiness` prima di `create_contract_from_clauses`. *Accettazione*: UI blocca creazione in ambito COMPLETO se `ready_for_contract=false`.

---

## 5) Rischi & cautele su produzione

- **Modifiche enum** (`supplier_avail_status`, `contract_party_kind`): `ALTER TYPE ADD VALUE` è additivo e non rimuovibile; l'espansione degli 8 stati disponibilità va fatta additiva mantenendo la mappatura UI BUSY/TENTATIVE per retrocompatibilità.
- **Trigger coerenza `business_model`↔`party_kind`**: i dati storici possono contenere combinazioni oggi "illegali". Audit dei contratti esistenti + bypass legacy/ADMIN prima di attivare il trigger.
- **Rotazione e hashing token (P0)**: i token attuali sono UUID in chiaro già distribuiti via email. Migrazione a `token_hash` con **dual-read** (plaintext + hash) finché i link in circolazione scadono, altrimenti i link già inviati smettono di funzionare.
- **Cifratura `doc_number`/fiscal_code**: campi immutabili a firma per valore legale. Backfill controllato che preservi il valore originale e non alteri contratti FIRMATI; verificare i constraint `contracts_firmato_requires_signature`.
- **Constraint range/non-negatività su tabelle popolate**: prima un inventario delle violazioni, sanare/whitelistare (es. sconti a markup negativo) prima dell'`ALTER TABLE ADD CONSTRAINT`.
- **Tabelle audit immutabili**: con trigger anti-UPDATE/DELETE, prevedere via service_role per data-fix straordinari e una policy di retention per gli accessi anon ad alto volume.
- **`signature_audit_trail` vs idempotenza firma**: la firma è già idempotente; il logging non deve duplicare righe in rifirma idempotente (upsert/guard su `(contract_id, event_type, signed_at)`).
