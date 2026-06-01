# PLANFULLY — Documento operativo completo per sviluppo
_Business rules, UX logic, database logic, moduli, priorità e criteri di accettazione._
_Versione operativa integrata — Data riferimento: 1 giugno 2026._

> Fonte: documento operativo fornito dal product owner (analisi/espansione della SPEC-REGOLE-PLANFULLY.md).
> Questo file è la **fonte di verità** per la roadmap. Lo stato di implementazione è tracciato a parte
> in `docs/PLANFULLY-GAP-ANALYSIS.md` (generato dal workflow di gap-analysis).
> Nota: l'originale incollato risultava troncato all'ultimissima riga della sez. 50.

---

## Indice priorità (sintesi P0–P5)

- **P0 — Sicurezza e legalità:** secure_action_tokens (scadenza + monouso), rotazione token esposti, audit RLS, constraint dati, coerenza GLOBAL/BROKER↔party_kind, gating contratti server-side, cifratura numeri documento, riduzione profili pubblici, test cross-tenant, audit accessi anon.
- **P1 — Core commerciale:** modulo lead capostipite, modulo lead fornitore, landing pubbliche, form embeddabili, conversione lead→preventivo, preventivi diretti fornitori, preventivi capostipite, contratti, firma, area cliente.
- **P2 — Operatività contrattuale:** addendum, revisioni preventivo, document center, audit timeline, email transazionali, scadenze token, quote snapshot, contract snapshot.
- **P3 — Disponibilità e pianificazione:** opzione data, blocco automatico, multi-giorno, rilascio regressione, timeline, checklist, invitati, tavoli, richieste modifica, cambio data.
- **P4 — Fornitori e retention:** brief fornitore, template subrole, team, presenze, export PDF, dashboard fornitore, metriche fornitore, pipeline fornitore.
- **P5 — Scena, network e crescita:** community, feed, referral, recensioni, rewards, mood board, gadget, sito ospiti, finanziamento (soon), assicurazione (soon).

---

## Moduli chiave e tabelle proposte (riferimento rapido)

| Modulo | Tabelle/oggetti proposti |
|---|---|
| Lead generale | `lead_requests` (capostipite), campi comuni + source + UTM |
| Lead fornitore | `supplier_leads` (NEW→CONTACTED→QUALIFIED→QUOTE_CREATED→QUOTE_SENT→WON→LOST→ARCHIVED), `supplier_clients` 1→N |
| Sovrapposizione cliente | alert "possibile sovrapposizione cliente" (LOW/MEDIUM/HIGH) + audit |
| Prossima mossa | `event_next_actions` (owner/actor/priority/title/action_url/status) |
| Preventivi | `quote_origin`, `quote_context` (jsonb), `quote_revisions` (snapshot) |
| Mark-up | `margin_mode` (HIDDEN_MARKUP / EXPLICIT_COORDINATION_FEE / MIXED), override voce>preventivo>evento>profilo |
| Budget readiness | FORNITORE_DIRETTO vs COMPLETO vs ristretto, gate server-side |
| Contratti | party_kind (CLIENT_WP/SUPPLIER_WP/SUPPLIER_CLIENT), coerenza modello, trigger |
| Template contratto | `contract_clause_templates` (versioning + snapshot a firma) |
| Addendum | `contract_addendums` (BOZZA→INVIATO→FIRMATO, amount_delta, date_change) |
| Firma | `signature_audit_trail` (immutable, doc number encrypted, hash) |
| Token | `secure_action_tokens` (token_hash, scadenze, monouso, revoca, open log) |
| Disponibilità | stati evoluti (AVAILABLE/TENTATIVE/OPTIONED/IN_NEGOTIATION/BLOCKED_*), opzione data |
| Area cliente | aggregazione per email verificata, separata per professionista, magic link/OTP |
| Provisioning CLIENT | magic link/OTP/firma; link area cliente in ogni email transazionale |
| Brief | `supplier_client_briefs` (template per subrole) |
| Richieste modifica | `client_change_requests` (PENDING/APPROVED/REJECTED/NEEDS_DISCUSSION/APPLIED) |
| Pagamenti | `payment_schedules` (DUE/PAID/PARTIALLY_PAID/OVERDUE/CANCELLED) |
| Team | `supplier_team_members` / `supplier_team_events` / `supplier_team_attendance` |
| Network | collaborazioni (PENDING→ACCEPTED solo a consenso), referral, rewards |
| Community | feed/post (DRAFT/PUBLISHED/HIDDEN/REPORTED/REMOVED) + moderazione |
| Prodotti futuri | `product_interest_requests`, flag financing/insurance |
| Document center | `documents` (visibility: PRIVATE_INTERNAL…PUBLIC_LINK/ADMIN_ONLY) |
| Audit | `event_audit_timeline` |
| Questionari | `event_questionnaire_templates` (event-aware + subrole-aware) |

---

## Naming UI (glossario)

- capostipite → **Coordinatore evento**
- GLOBAL → "Gestisco tutto io" · BROKER → "Ogni fornitore firma col cliente"
- SOLO_COORDINAMENTO → "Coordino soltanto" · SOLO_PROPRI_SERVIZI → "Vendo solo i miei servizi"
- quote → Preventivo · contract → Contratto · addendum → Integrazione contratto
- quote_budget_readiness → Stato budget · direct client → Cliente diretto · supplier → Fornitore
- next action → Prossima mossa · disintermediazione → **Possibile sovrapposizione cliente**
- availability busy → Data bloccata · tentative → Forse disponibile · optioned → Data opzionata · supplier lead → Richiesta diretta

---

## Criteri di accettazione (estratto vincolante)

1. **Lead fornitore:** landing pubblica → lead diretto → dashboard fornitore → preventivo con `direct_client_id`, **senza** budget readiness capostipite.
2. **Lead capostipite:** lead → evento → preventivo.
3. **Preventivo diretto:** `direct_client_id` ACCETTATO → contratto `SUPPLIER_CLIENT`.
4. **GLOBAL:** cliente firma col capostipite; fornitore firma col capostipite.
5. **BROKER:** fornitore firma direttamente col cliente.
6. **Token:** scaduto non firma; usato non rifirma; revocato non accede.
7. **Disponibilità:** multi-giorno blocca tutto l'intervallo; accettato blocca; firmato conferma; regressione libera se nessun contratto firmato.
8. **Area cliente:** stessa email → documenti aggregati per professionista, nessun leak cross-tenant.
9. **Community:** coppie/clienti non vedono il feed professionisti; anonimi fuori dall'app privata.
10. **Documenti:** contratto firmato ha snapshot + hash + audit trail + PDF + signer data.

---

_Il documento integrale (sezioni 0–50: visione, ruoli, modelli commerciali, ambito, macchina a stati + badge trasversali, moduli lead, alert sovrapposizione, prossima mossa, preventivi/revisioni/mark-up/budget, contratti/template/addendum, firma, token, disponibilità, area cliente, provisioning, brief, pianificazione, richieste modifica, sito ospiti/RSVP, pagamenti, funnel, team, network, community, prodotti futuri, document center, audit timeline, email transazionali, dashboard, onboarding, event-kind/questionari, branding, feature flags, sicurezza/multi-tenancy, constraint, priorità, criteri di accettazione, naming, microcopy, roadmap tecnica per sprint, sintesi) è la specifica operativa di riferimento condivisa dal product owner._
