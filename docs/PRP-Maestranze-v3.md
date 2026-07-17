# PRP · MAESTRANZE v3 — pool + ingaggi diretti
### Area collaboratori: miniprofili ricercabili, richieste di ingaggio dirette
### v3 — scope v1 ridotto (Giovanni, 13/07): niente bacheca pubblica di offerte al lancio

> ⚠️ **SUPERATO (17/07/2026) da [PRP-Maestranze-Bacheca-v1.1.md](PRP-Maestranze-Bacheca-v1.1.md) — non eseguire questo.**
> Il matching semantico (pgvector + gte-small, ~85h) è eliminato by design: l'architettura legale
> "bacheca informativa, non intermediazione" richiede che Planfully non selezioni, non ordini per
> rilevanza, non suggerisca candidati. Resta qui solo come storia della decisione.
> **Nota:** la §8 qui sotto ("la banca dati ricercabile È intermediazione tanto quanto la bacheca")
> resta un'osservazione valida e non risolta dal nuovo PRP — è materia del parere giuslavorista,
> non del design. Portarla nella lettera al legale.

> STATO: **CONGELATO / GATED** — non costruire prima del gate (vedi Sequenza).
> Gate tecnico calendario P0 ✅ fatto 13/07. Restano: Stripe, giuslavorista D-M-1, ≥3 capostipiti attivi.

**Cambiamenti rispetto a v2:** la v1 di Maestranze è **pool + richieste dirette di ingaggio**. Le offerte di lavoro pubbliche escono dallo scope iniziale e diventano l'upgrade v2 (un flag di visibilità sullo stesso schema, non un rebuild). Motivazioni: coerenza col DNA curato (il professionista sceglie la persona, non pubblica al vento), cold start più pulito (niente bacheca che può apparire vuota), −23h di build. Il quadro legale NON cambia: la banca dati di candidature ricercabile È intermediazione tanto quanto la bacheca — rotta B, iscrizione 3.1, gratuità strutturale restano identiche alla v2.

---

## Il flusso v1 in una riga

Il collaboratore crea il miniprofilo → il professionista **cerca nel pool** (filtri duri + ranking) → invia una **richiesta di ingaggio** (data, ruolo, luogo, compenso indicativo) → il collaboratore accetta o rifiuta → all'accettazione: contact reveal reciproco + l'ingaggio entra nel sistema turni esistente → dopo l'evento: feedback bidirezionale.

## Modello dati (delta rispetto a v2)

**Sostituisce `job_offers` + `job_applications` con un'unica entità:**

- `engagements` — la richiesta di ingaggio diretta:
  - `professional_id` (WP/LOCATION/FORNITORE), `collaborator_id`, categoria/ruolo, `date_from`/`date_to`, orario indicativo, luogo (testo + provincia + lat/lng), compenso indicativo (testo libero), messaggio
  - `visibility text default 'DIRETTA'` — **il gancio per la v2**: quando arriveranno le offerte pubbliche basterà `visibility='POOL'` con `collaborator_id null` + tabella di candidature; lo schema nasce già pronto
  - stato: `PROPOSTA → ACCETTATA / RIFIUTATA / RITIRATA` poi `COMPLETATA / NO_SHOW / ANNULLATA` (post-evento)
  - **snapshot del profilo del collaboratore alla proposta** (jsonb) — disciplina snapshot invariata
  - vincolo: un solo engagement PROPOSTA/ACCETTATA per (professional, collaborator, data) — indice unico parziale
- `contact_reveals` — invariato, ora aggancia `engagement_id`
- `engagement_feedback` — invariato, aggancia `engagement_id` con stato COMPLETATA/NO_SHOW (l'ancora anti-recensioni-false resta: niente ingaggio reale, niente feedback)

**Tutto il resto invariato dalla v1/v2:** `collaborator_profiles` + split PII (`_private`), `collaborator_categories` (~30 seed), `collaborator_documents` con scadenza, ponte `supplier_team_members.linked_profile_id`, riconferma 48h, GDPR.

## Matching v1 (ridotto e legalmente sereno)

Solo **ricerca avviata dal professionista**: filtri duri SQL (categoria, raggio km, data libera negli slot, documenti validi non scaduti) + ranking pgvector/gte-small in-house. Il pannello risultati mostra i criteri duri soddisfatti ("disponibile il 12/9 · 18 km · HACCP valido").

Escono dallo scope v1 (tornano in v2 con le offerte pubbliche, dietro il flag `maestranze_push_matching` attivabile solo a iscrizione 3.1 perfezionata): avvisi push ai collaboratori, pannello "candidati suggeriti" proattivo.

Lato collaboratore, l'unico segnale in v1 è la **richiesta di ingaggio ricevuta** (notifica via queue riparata + badge in app): è già il matching che gli serve — qualcuno lo ha scelto.

## Architettura legale — invariata dalla v2, con una precisazione

La raccolta di candidature con banca dati ricercabile rientra nell'intermediazione: la v3 NON alleggerisce gli adempimenti. Restano: gratuità strutturale con test CI anti-paywall, pagina trasparenza con estremi autorizzazione, footer negli invii, predisposizione export interoperabile, mai compensi dal lavoratore, D-M-1 (giuslavorista, domanda già formulata in v2) prima del lancio pubblico. La modalità v1 (solo ricerca professionista-iniziata + ingaggi diretti) è comunque la configurazione più prudente possibile in attesa del perfezionamento dell'iscrizione.

## Work items (v3)

| WI | Contenuto | Stima | Delta |
|----|-----------|-------|-------|
| M-1 | Migrazione schema + RLS + tassonomia (con `engagements` al posto di offers/applications) | 9h | −1h |
| M-2 | Registrazione collaboratore + onboarding miniprofilo | 12h | = |
| M-3 | Ponte team + "Invita la tua squadra" | 6h | = |
| M-4 | ~~Offerte pubbliche~~ → **Richiesta di ingaggio**: composer dal profilo del collaboratore, inbox ingaggi per il collaboratore, stati | 7h | −1h |
| M-5 | Ricerca pool: filtri duri + UI risultati | 10h | = |
| M-6 | Ranking semantico pgvector + gte-small | 8h | = |
| M-7 | Flusso accettazione + contact reveal + aggancio al sistema turni | 8h | −2h |
| M-8 | Affidabilità: feedback + no-show + riconferma 48h | 10h | = |
| M-9 | GDPR: consensi, informativa, cancellazione/export | 6h | = |
| M-10 | ~~Matching proattivo~~ → rimandato a v2 (offerte pubbliche) | 0h | −10h |
| M-11 | Adempimenti: trasparenza, export interoperabile, test CI anti-paywall | 6h | = |
| M-12 | Test: RLS in CI, e2e (registrazione → ricerca → ingaggio → reveal → feedback), fixture matching, gratuità strutturale | 10h | −2h |

**Totale ≈ 92h nominali → ~85 ore effettive ≈ 10-11 giornate** (−23h rispetto alla v2).

## Sequenza (invariata nella sostanza)

1. Gate tecnico (fix/1–5, Stripe, hotfix calendario P0)
2. Giuslavorista D-M-1 (in parallelo: la pratica 3.1 corre gratis durante la build)
3. Almeno 3 capostipiti attivi con fornitori collegati
4. Build → **Fase A: "Invita la tua squadra"** — il pool nasce pieno dall'anagrafica team esistente
5. Fase B: iscrizioni esterne (badge NON_VERIFICATO, moderazione su segnalazione — D-M-3)
6. v2 futura: offerte pubbliche + push matching, a iscrizione Albo perfezionata e pool con massa — è un flag, non un progetto

## Registro decisioni

- **D-M-0** ✓ "Maestranze"
- **Gratuità** ✓ strutturale, testata in CI
- **Scope v1** ✓ pool + ingaggi diretti, niente bacheca pubblica (13/07)
- **D-M-1** — giuslavorista: aperta (domanda formulata in v2)
- **D-M-3** — moderazione Fase B: proposta auto-approvazione + revisione su segnalazione, da confermare
