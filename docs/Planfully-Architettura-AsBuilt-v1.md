# Planfully.it (wedding-platform) — Architettura, Spec & Coerenza

**Versione 1.0 · maggio 2026 · documento as-built**
Fotografia tecnica del gestionale `wedding-platform`, online su **planfully.it**, letta direttamente dal codice (90 migrazioni, ~60 pagine frontend, 17 Edge Functions). Include una lettura critica: *regge l'insieme?*

---

## 0. In sintesi

- **Cos'è:** il gestionale wedding "a vasi comunicanti" del Dossier — catalogo fornitori, calendario condiviso, preventivi, contratti — **più** un'espansione enorme aggiunta dopo (logistica eventi, area coppie, finanza, social network, referral).
- **Dominio:** `planfully.it`. **Online, con clienti veri**, su Supabase hosted + Vercel.
- **Verdetto di coerenza (in tre righe):** il *cuore* è solido, coerente e testato. Ma in circa una settimana ci è stata montata sopra una quantità di funzioni che ha fatto esplodere la superficie del prodotto più in fretta della sua rete di sicurezza — e ora tutto questo è **live, con dati personali reali** (inclusi dati di minori e accessibilità degli invitati). Il rischio non è la qualità dei singoli pezzi: è la **manutenibilità e la sicurezza dell'insieme**. Dettagli nella §7.

---

## 1. Cos'è il prodotto

Network "vasi comunicanti": il fornitore inserisce i dati una volta sola; i **capostipiti** (Wedding Planner e Location) li riusano per costruire preventivi, coordinare il calendario e gestire la coppia cliente fino al giorno dell'evento.

Le tre figure:
- **Capostipite** (Wedding Planner / Location) — il cliente pagante, costruisce preventivi, coordina fornitori ed eventi.
- **Fornitore** — gestisce il proprio catalogo e disponibilità; collabora con i capostipiti.
- **Coppia** — il cliente finale; ha un proprio accesso (entra su invito del capostipite), una dashboard, preferenze, e gestisce gli invitati dell'evento.

E qui la risposta alla tua frustrazione di prima: **sì, qui esistono tutti**. "Coppia" = `wedding_couple_members` (utenti, con ruoli sposo/sposa/partner). "Invitato" = `event_guests` (con RSVP, fasce d'età, accessibilità, trasporto, alloggio). "Fornitore" e "mail" ci sono da sempre. Il customer care che vuoi, qui, ha dati veri su cui agire.

---

## 2. Architettura tecnica

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React 18 + TS strict + Vite + Tailwind v4 + shadcn │
│  ├─ AuthProvider (Supabase Auth, JWT)                         │
│  ├─ React Query (cache) + Zustand + Zod                       │
│  └─ ~60 pagine lazy-loaded, routing per ruolo (RequireAuth)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (Supabase JS SDK)
┌─────────────────────────────────────────────────────────────┐
│  Supabase hosted (ref zfwlkvqxfzvubmfyxofs)                   │
│  ├─ Postgres 17 + PostgREST (REST autogenerata)              │
│  ├─ RLS = prima linea di sicurezza (helper SECURITY DEFINER) │
│  ├─ Storage (foto servizi, PDF preventivi, brand, foto nozze)│
│  ├─ Realtime (predisposto, poco usato)                       │
│  └─ 17 Edge Functions Deno (PDF, email, import, sitemap…)    │
│  └─ Email: Resend                                            │
└─────────────────────────────────────────────────────────────┘
  Deploy: Vercel (frontend) · dominio planfully.it
```

**Stack:** React 18 + TypeScript strict + Vite + Tailwind v4 + shadcn-style; React Query + Zustand + Zod; Supabase (Postgres 17, Auth, Storage, Edge Functions Deno); Resend; jsPDF per i PDF dentro Edge Function. Test: Vitest + Playwright + test SQL di impersonation RLS.

---

## 3. Modello dati

**Il cuore (MVP documentato, ~16 tabelle):**
- `profiles` (estende auth.users: role, subrole, subscription_tier, brand_*, notification_preferences)
- `collaborations` (capostipite ↔ fornitore, status, invite_token)
- `service_categories`, `services`, `price_versions` (storico prezzi automatico), `service_photos`, `service_modifiers`
- `calendar_entries`, `calendar_entry_participants`, `calendar_export_tokens`, `notification_queue`
- `quotes`, `quote_items`, `quote_supplier_markups`, `quote_acceptances`

**L'espansione aggiunta dopo (decine di tabelle):**
- **Logistica evento:** `event_guests`, `event_tables`, `event_menu`, `event_timeline`, `event_subevents`, `event_transport`, `event_accommodations`, `event_playlist`, `event_documents`, `event_gadgets`, alloggio/trasporto per invitato.
- **Area coppia:** `wedding_couple_members`, `couple_preferences`, `couple_change_requests`, `couple_planning_status`, `wedding_tasks`, `mood_inspirations`.
- **Finanza:** `finance_applications/offers`, `insurance_offers/policies`, `budget_categories/entries`, `market_prices`.
- **Social & contenuti:** `posts`, `post_comments`, `post_likes`, `follows`, `blog_posts`, `feed`/articoli, discovery.
- **Crescita:** `referrals`, `referral_credits`, `lead_requests`, candidacy inbox, reviews, contratti (`contracts`).

---

## 4. Ruoli e permessi

- Enum `user_role`: **WEDDING_PLANNER, LOCATION, FORNITORE, ADMIN** + `subrole` libero.
- Le **coppie** non sono nell'enum: entrano su invito (pagine `CoupleInviteAccept`, dashboard coppia dedicata). Ruoli interni: `couple_role` = SPOSO/SPOSA/PARTNER/PERSONA_DI_FIDUCIA.
- **RLS** attiva su ogni tabella, con funzioni helper `SECURITY DEFINER` (`is_admin()`, `has_active_collab_with_supplier()`, `is_entry_participant()`, `is_quote_owner()`).
- View `calendar_entries_for_participants` che nasconde ai partecipanti i campi sensibili (cliente, importo, note).
- RPC pubbliche per token (`quote_get/accept/reject_by_token`) per le pagine `/p/*` senza login.

> ⚠️ Segnale (vedi §7): circa **20 migrazioni** sono correzioni di permessi/RLS o "hardening". È un modello di sicurezza che è stato rattoppato molte volte, reattivamente. Su un prodotto live con dati personali, è l'area che merita più attenzione.

---

## 5. Edge Functions (17)

PDF e documenti: `quote-generate-pdf`, `contract-generate-pdf`, `moodboard-pdf`.
Orchestrazione: `quote-send` (PDF + token + calendar entry + email), `quote-accept-sign`, `send-questionnaire`, `invite-supplier`, `lead-notify`, `calendar-notify`, `calendar-export-ics`.
Media/utility: `upload-photo` (thumbnail), `import-pin-url`, `instagram-avatar`, `link-preview`, `pexels-search`, `sitemap-xml`.

---

## 6. Spec funzionale per area (sintesi)

- **Catalogo fornitori:** il fornitore crea servizi con categorie, prezzi versionati, foto, modificatori; il capostipite collaborante li vede (RLS). Foto via Edge Function con thumbnail.
- **Calendario:** il capostipite crea voci, aggancia fornitori come partecipanti (vista ridotta), esporta iCal via token.
- **Preventivi & contratti:** editor a pannelli, calcolo totali e markup via trigger, limite 10 nel tier FREE, invio al cliente con link pubblico di accettazione/rifiuto, generazione PDF, contratti con firma.
- **Logistica evento:** gestione invitati (RSVP, età, accessibilità), tavoli, menu, timeline, sotto-eventi, trasporti e alloggi.
- **Area coppia:** dashboard, preferenze, mood board, richieste di modifica, stato pianificazione.
- **Finanza/assicurazioni:** offerte finanziarie e assicurative, budget.
- **Social & crescita:** profili pubblici fornitori, feed, blog, follow, lead, referral con crediti.

---

## 7. Lettura critica — "ha senso?"

**Cosa ha senso e funziona (le fondamenta).**
Il cuore vasi-comunicanti — fornitori → capostipiti → coppia, con catalogo, calendario, preventivi, contratti — è progettato bene, ha RLS pensata, una view per la visibilità ridotta, RPC pubbliche idempotenti e 43 test verdi. Questa parte è coerente con il Dossier ed è una base seria.

**Dove l'insieme scricchiola (da prendere sul serio).**

1. **Esplosione di scope su un prodotto live.** Le migrazioni vanno dal 21 al 28 maggio: in ~una settimana, sopra l'MVP a 3 funzioni, sono stati montati logistica eventi completa, area coppia, finanza, assicurazioni, un intero social network (feed, post, follow, blog, discovery) e un motore di referral. È enorme per un fondatore solo con l'AI, e la superficie è cresciuta più in fretta della rete di sicurezza. La domanda non è "funziona una demo?", ma "riesci a mantenerlo, testarlo e tenerlo sicuro mentre serve clienti veri?".

2. **Sicurezza rattoppata su dati sensibili, in produzione.** ~20 migrazioni di fix RLS/permessi/hardening dicono che il modello di accesso è stato corretto a strappi. E i dati in gioco non sono banali: gli invitati hanno **fascia d'età (inclusi minori) e accessibilità** — sotto GDPR è roba delicata. Una RLS sbagliata qui non è un bug estetico, è un incidente privacy. Questa è la priorità numero uno.

3. **Due prodotti, un dominio.** Sia questo gestionale sia il magazine in `skorpiov3` fanno riferimento a `planfully.it`. Vanno chiariti i confini (chi serve il dominio principale, chi un sottodominio o sottocartella), altrimenti rischi conflitti di routing, redirect di login e SEO.

4. **Funzioni "a metà" che un cliente vero può toccare.** Dai tuoi stessi appunti: l'upgrade PREMIUM è un **bottone finto** (`UPDATE tier`, niente pagamento), le notifiche sono "best-effort" dal client (se un dato cambia via SQL non parte nulla), le revisioni preventivo non si incrementano. Su un prodotto a pagamento e live, queste vanno chiuse o nascoste.

5. **Documentazione e migrazioni disallineate.** I tuoi doc (`ARCHITECTURE.md`, `PROGRESS.md`, `KNOWN_ISSUES.md`) sono fermi allo snapshot MVP del 21 maggio: descrivono 16 tabelle e 3 funzioni, e indicano "deploy cloud" come passo *futuro* — ma sei già online. E la catena di migrazioni contiene operazioni una-tantum sui dati (`delete_stefano_severini`, `transfer_to_real_sara`, `seed_demo_*`, `full_e2e_verify`): roba che gira a ogni reset e non dovrebbe stare tra le migrazioni permanenti.

**In una frase:** ha senso *come fondamenta*, ma è cresciuto troppo in fretta per essere già live senza una fase di consolidamento. La priorità giusta adesso **non sono altre funzioni** — è mettere in sicurezza e in ordine quello che già serve clienti veri.

---

## 8. Cosa farei adesso (in ordine)

1. **Audit RLS serio**, partendo dalle tabelle con dati sensibili (`event_guests`, coppie, quotes, contratti). Test di impersonazione per ogni ruolo. È la rete sotto il trapezio.
2. **Igiene migrazioni:** isolare/neutralizzare le migrazioni una-tantum e i seed di test, così il database è ricostruibile in modo pulito e prevedibile.
3. **Chiudere le funzioni "finte"** o nasconderle ai clienti (PREMIUM/pagamento su tutte).
4. **Risolvere il nodo dominio** Planfully.it tra le due repo.
5. **Costruire la console di customer care / admin** — che è esattamente ciò che vuoi, e che è **già sul tuo TODO** (in `KNOWN_ISSUES.md`: *"Pagina /admin con override RLS per supporto"*). Ora che sei live è il momento giusto, e poggia bene sulle fondamenta esistenti (audit log, soft-delete, ruoli). Questa volta sulla repo giusta.
6. Allineare i documenti (questo sostituisce gli snapshot MVP).

---

*Documento as-built, generato leggendo direttamente `wedding-platform` (branch main). Per ogni affermazione sono stati letti file reali: schema e migrazioni Supabase, RLS, Edge Functions, routing e pagine frontend, e i documenti di progetto esistenti.*
