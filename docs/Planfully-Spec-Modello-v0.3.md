# Planfully — Spec Modello Capostipite v0.3

> **Spec di prodotto** per il nuovo modello operativo del capostipite.
> Documento di riferimento per l'implementazione a fasi del branch
> `feature/nuovo-modello`. Tutte le decisioni operative del prompt-master
> hanno precedenza in caso di conflitto con questo documento.

---

## CONTESTO
Repo `wedding-platform` (prodotto **Planfully**, planfully.it): gestionale wedding "a vasi comunicanti".
Stack: React 18 + TypeScript strict + Vite + Tailwind + shadcn-style; Supabase (Postgres 17 + Auth + Storage + Edge Functions Deno) **hosted ma ambiente di TEST (nessun cliente reale)**; Resend; deploy Vercel.
Figure: **Capostipite** (Wedding Planner / Location) → **Fornitore** → **Coppia** (cliente finale).
Obiettivo: implementare il nuovo modello operativo (doppia modalità di incasso, ciclo evento guidato, notifiche, pagamenti monitorati, contratti, collaborazione, gestione cambiamenti) e poi una simulazione completa.

---

## ⛓️ REGOLE GLOBALI (vincoli assoluti, valgono per tutte le fasi)

1. **Una fase alla volta, in sequenza.** Lavora su un unico branch `feature/nuovo-modello` partito da `main`. Ogni fase = commit propri e chiari + un file `FASE-N-REPORT.md`. Procedi alla fase successiva **solo se** build e test della fase corrente passano. Se una fase si rompe e non riesci a sistemarla, **fermati e segnala** invece di andare avanti.
2. **Database in LOCALE.** Usa `supabase db reset` e i test in locale. Prepara le migrazioni come file versionati in `supabase/migrations/`. **NON** fare `supabase db push`/`link`/`functions deploy` sul progetto hosted, **NON** fare deploy su Vercel. L'applicazione in remoto la fa l'umano dopo review.
3. **NON fare merge su `main`.** Push solo del branch `feature/nuovo-modello`.
4. **Sicurezza:** RLS sempre abilitata su nuove tabelle/colonne, con policy esplicite per ruolo; testa impersonando ogni ruolo. **Mai** `service_role` o segreti nel frontend.
5. **Qualità:** `npm run build` deve passare a ogni fase; esegui i test pertinenti; aggiorna i tipi (`npm run db:types`) dopo le migrazioni.
6. **Tocca solo ciò che la fase richiede.** Se per farlo funzionare devi cambiare altro, fermati e segnalalo nel report.

## 🎨 REGOLE DI DESIGN GLOBALI (ogni schermata che crei o tocchi)

- **MOBILE FIRST.** Progetta prima per ~380px: layout a colonna singola, azioni raggiungibili col pollice, target touch ≥44px, niente tabelle larghe non scrollabili. Molti utenti useranno **solo il telefono**. Adatta al desktop dopo.
- **RISPOSTA CHIUSA / UNA MOSSA ALLA VOLTA.** Gli utenti sono poco informatizzati. Per ogni schermata: **una azione primaria evidente**; **pulsanti che suggeriscono la mossa giusta** invece di campi vuoti (es. "Invia preventivo alla coppia", "Conferma la data", "Chiedi modifica"); testo libero solo quando inevitabile (es. una nota); **conferme in lingua umana** (es. "Sei sicuro di voler riaprire il preventivo? Il fornitore dovrà riconfermare la disponibilità."). La sidebar e le notifiche dicono "la prossima cosa da fare è questa → premi qui", non "ecco tutte le opzioni".
- Riusa i componenti shadcn/ui esistenti; non reinventare la UI.

---

## FASE 1 — Fondamenta
Obiettivo: le basi su cui poggia tutto. Quasi tutto additivo.
1. **Fix questionario-once (tutti i ruoli):** migrazione `onboarding_completato_il timestamptz` su `profiles`; il questionario/onboarding si mostra solo se nullo; valorizzalo al salvataggio; verifica che dopo logout/login NON ricompaia.
2. **Modus operandi:** su `profiles` → `modalita_incasso_default` enum('INTERO','SEGNALAZIONE'), `parcella_default numeric`, `applica_ricarico_default boolean`; step nell'onboarding capostipite per impostarli. Sull'evento → `modalita_incasso` (override per rapporto con la coppia).
3. **Stato evento:** enum `evento_stato` (LEAD, INCARICO_FIRMATO, PREVENTIVI, PREVENTIVO_FIRMATO, CONTRATTO, PIANIFICAZIONE, CHECKLIST, SVOLTO, ANNULLATO) + colonna stato + helper/commenti con le transizioni ammesse. Non cablare ancora tutta la UI.
4. **Audit "chi-ha-cambiato-cosa":** tabella `audit_log` + trigger generico `SECURITY DEFINER`, agganciato alle tabelle condivise chiave (eventi, quotes, quote_items, event_guests, event_tables, budget).
Accettazione: questionario non ricompare; campi/enum presenti; audit registra le modifiche; build+test verdi.

## FASE 2 — Workflow guidato (versione semplice)
Obiettivo: la guida "cosa fare adesso", mobile-first, a pulsanti.
1. **Sidebar per priorità, per ruolo** (coppia / WP / fornitore): elenco di "prossime azioni" ordinate, ciascuna è un **pulsante** che porta all'azione. Su mobile è un pannello/bottom-sheet, non una sidebar laterale.
2. **Motore notifiche base:** una tabella `notifiche` (destinatario, tipo, riferimento, stato, owner_della_mossa, creato_il) + logica che genera le voci "manca X / in attesa di Y" dallo stato evento. Per ora SOLO stato attuale + chi blocca chi (niente scadenze/digest ancora).
Accettazione: ogni ruolo vede in cima la mossa giusta; le notifiche indicano a chi tocca; tutto usabile con un pollice su 380px.

## FASE 3 — Soldi & contratti
1. **Scadenzario pagamenti (monitoraggio, non incasso):** per evento, voci con importo, acconto/saldo, scadenza, pagato/non pagato, chi-deve-a-chi. Niente Stripe/fattura.
2. **Template contratti:** import del proprio modello + libreria di modelli suggeriti; template diversi per INTERO vs SEGNALAZIONE; firma anche offline con stato tracciato.
3. **Conferma fornitore:** quando un fornitore viene "bloccato", resta "in attesa di conferma" finché non conferma; genera notifica.
4. **Consenso GDPR (segnalazione):** la coppia acconsente alla condivisione con i professionisti segnalati; registra consenso (data + versione); visibilità al professionista limitata al minimo necessario (nome, contatto, data/luogo, solo le voci che lo riguardano).
Accettazione: pagamenti tracciati e visibili; contratti import/suggeriti; fornitore deve confermare; consenso registrato e visibilità ristretta verificata via RLS per ruolo.

## FASE 4 — Notifiche evolute + riconciliazione
1. **Scadenze + escalation + digest:** ogni voce con deadline relativa alla **data nozze**; promemoria a -30/-14/-7/-2 giorni; digest periodico per ruolo. Attiva lo scheduler (**pg_cron**) — oggi mancante — per i job periodici; documenta come si abilita.
2. **Riconciliazione conteggio → menu → preventivo:** il numero invitati definitivo (entro scadenza) lega `event_guests` ↔ menu (PER_GUEST) ↔ totale preventivo ↔ scadenzario; mostra il delta ("conteggio 118, menu per 130 → aggiorna").
Accettazione: i promemoria scattano ai tempi giusti; il digest elenca i pendenti; il delta conteggio/menu/preventivo è visibile e aggiornabile.

## FASE 5 — Cambiamenti & collaborazione
1. **Chat per evento:** thread di messaggi per evento (e/o per voce) tra coppia, WP, fornitori coinvolti. Mobile-first.
2. **Rinvio / annullamento / dropout — meccanica unica** (cambio stato → ri-approvazione/ri-conferma → ri-controllo disponibilità → aggiustamento pagamenti tracciato → audit → notifica):
   - **Riprogramma (nuova data):** ricalcola scadenze, sposta calendar entries e blocchi disponibilità, lancia ri-controllo disponibilità + richiesta di riconferma a ogni fornitore; chi non è libero → "da sostituire".
   - **Dropout fornitore:** riapre le sue voci di preventivo ("da ricollocare"), libera disponibilità, annulla il suo contratto; il WP sceglie un sostituto → nuova voce → la coppia ri-approva il delta → nuovo contratto + conferma → scadenzario e totale ricalcolati. Urgenza in cima a sidebar/notifiche.
   - **Annullamento:** stato CANCELLED, libera disponibilità, annulla preventivi/contratti con motivo, registra saldo finale (pagato/da rimborsare/penali, solo tracciato), notifica tutti, archivia (soft-delete) recuperabile.
Accettazione: i tre flussi funzionano end-to-end con ri-conferme, ricalcoli e audit; tutto guidato a pulsanti con conferme in lingua umana.

## FASE 6 — Salute evento & feature flag
1. **Indicatore di salute evento:** stato, blocchi aperti, giorni alla data; colpo d'occhio per il WP e rassicurazione per la coppia.
2. **Feature flag** per attivare il nuovo modello solo su profili scelti (per il beta).
Accettazione: indicatore leggibile su mobile; flag controlla l'esposizione del nuovo modello.

## FASE 7 — Simulazione / seed completo
Obiettivo: un matrimonio intero che attraversa il **nuovo** flusso, su locale/staging. Estendi `tests/e2e/full-lifecycle-agent.mjs`.

**Convenzione email +numero (Gmail alias)** — solo per simulazioni, mai utenti reali:
- Tutte le email del tipo `giovanni.scozzafava+NUMERO@gmail.com`.
- Numerazione per ruolo: **1000–1099 capostipiti · 2000–2099 coppie · 3000–3999 fornitori · 5000+ invitati.**
- **PRIMA di generare account a decine**, verifica che nel codice non ci sia una normalizzazione email che fonde due alias `+` in un solo utente (in `quote-send`/`send-questionnaire`/`quote-accept-sign` c'è un `replace(/\+.*$/,'')` che serve SOLO a ricavare un nome leggibile e NON tocca l'indirizzo né l'identità — quello va bene; cerca invece eventuali normalizzazioni in registrazione/login/lookup). Segnala l'esito nel report.

**Scenario da simulare (modalità INTERO, una WP):**
1. Crea capostipite (nome inventato) + logo; imposta modus operandi.
2. Crea **20 fornitori**, ognuno con un'offerta dettagliata e realistica (servizi, prezzi, modificatori, foto placeholder).
3. Crea una coppia che firma l'incarico per la WP → compila questionario + moodboard → fase preventivi.
4. WP propone preventivi → la coppia chiede modifiche → modifiche applicate → preventivo chiuso → coppia firma.
5. Dopo firma: RSVP creato; la coppia aggiunge **30 invitati** che ricevono email di conferma (agli alias +5000…).
6. WP costruisce i tavoli; la coppia interviene con una modifica.
7. WP blocca chiesa + celebrante; prenota transfer e alberghi per gli invitati.
8. Menu dalla Location a **150€/persona** + un piatto extra **+30€/persona** → si somma nel preventivo (riconciliazione PER_GUEST).
9. WP segnala le bomboniere come **voce esterna** (da sito).
10. Mood finalizzato (blocco ampio di foto/pagine, anche per colore).
11. Budget spostato nel questionario, monitorato insieme; la coppia lo allarga.
12. Scatta la **checklist per ogni evento della giornata** → partono email di conferma/riepilogo a ogni fornitore (orari, luoghi, fornitura, checklist individuale).
13. (facoltativo) simula un **dropout** di un fornitore e la riapertura/sostituzione (Fase 5).
14. Cleanup a fine simulazione.

**Report obbligatorio della simulazione:** includi una **tabella di mappatura** `numero → chi è → ruolo → password`, l'esito della verifica anti-normalizzazione alias, e l'elenco delle email generate per tipo.

---

## ALLA FINE DI OGNI FASE
Scrivi `FASE-N-REPORT.md`: cosa fatto, migrazioni create (non applicate in remoto), file toccati, come hai verificato l'accettazione, criticità, e cosa resta da applicare con supervisione. Commit + push del solo branch `feature/nuovo-modello`. NON merge su main, NON deploy, NON DB remoto.
