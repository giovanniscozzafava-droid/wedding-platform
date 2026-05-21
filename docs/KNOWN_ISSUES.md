# Known Issues / Limitazioni MVP

> Aggiornato al completamento Fase 6.

## Rinviati a v1.1+

### 1. pg_cron schedules
- **Cosa manca**: schedulazione automatica `calendar-notify-batch` (ogni minuto) e `calendar-notify-reminders` (notturna 3:00 per promemoria 7 giorni prima).
- **Workaround attuale**: nello stress test invoca `calendar-notify` manualmente. In produzione: usare Vercel Cron o Supabase cron jobs via dashboard.
- **Effetto utente**: nessun reminder automatico via email.

### 2. Trigger pg_net DB → Edge Function
- **Cosa manca**: trigger Postgres che chiamano `calendar-notify` automaticamente al cambio di `calendar_entries`/`participants`.
- **Workaround attuale**: il client chiama l'Edge Function dopo create/update.
- **Trade-off**: se un dev fa update via SQL diretto, nessuna notifica parte.

### 3. Vista calendario settimanale (PRP-2 WI-9)
- **Cosa manca**: CalendarWeekView con slot orari.
- **Workaround**: la vista mensile (lista cronologica) copre i casi d'uso MVP.

### 4. UI admin categorie (PRP-1 WI-12)
- **Cosa manca**: pagina `/admin/categories` con promozione a standard.
- **Workaround**: admin opera direttamente via Supabase Studio (http://127.0.0.1:54323).

### 5. Preferenze notifiche per utente (PRP-2 WI-11)
- **Cosa manca**: pagina `/settings/notifications` con toggle `immediate`/`digest`.
- **Workaround**: defaults `{immediate:true, digest:false}`. Override via SQL.

### 6. Upgrade PREMIUM reale (Stripe / 2C2P)
- **Cosa manca**: integrazione pagamento. Per ora `BrandSettingsPage` ha un bottone "Diventa PREMIUM (demo)" che esegue `UPDATE profiles SET subscription_tier='PREMIUM'`.
- **Effetto**: in produzione serve aggiungere checkout e webhook conferma.

### 7. Revisioni preventivo
- **Cosa manca**: la colonna `revision` esiste su `quotes` ma non viene incrementata automaticamente quando l'editor invia v2/v3. Lo stress test rigenera PDF allo stesso `v{revision}` (upsert).
- **Effetto**: solo un PDF per quote (l'ultimo). Aggiungere bottone "Crea revisione" che fa `revision++` + INSERT historical row.

### 8. Alert "prezzo cambiato" inline editor (PRP-3 WI-8)
- **Cosa manca**: confronto runtime tra snapshot_price del quote item e current price_versions del service, con badge UI "Prezzo aggiornato".
- **Workaround**: il dato è disponibile, è solo UI mancante.

## Bug / limitazioni note

### Browser locale
- **React Router warning** v6 → v7 startTransition / relativeSplatPath: warning ignorabili, comportamento attuale corretto.
- **React StrictMode double-mount**: gestito a livello RPC con `WHERE status IN (target, current)` per idempotenza.

### Edge Functions in locale
- `supabase functions serve` deve girare in background per i test E2E. In produzione: `supabase functions deploy <name>`.
- Mailpit cattura tutte le email senza Resend API key. URL: http://127.0.0.1:54324.

### Disco
- `supabase start` può occupare ~500MB di immagini Docker. `supabase stop` libera la VM ma le immagini restano. `docker system prune -a` se serve recuperare spazio.

### Tipi TS auto-generati
- Lo script `npm run db:types` filtra le righe stderr (`Connecting to db`, `A new version`, ecc.) — se la CLI Supabase cambia output, aggiornare il grep.

## TODO Sviluppo futuro (post-MVP)

- [ ] Pagina `/suppliers` per WP: lista collaborazioni + invio nuovo invito (con email magic link)
- [ ] Pagina `/admin` con override RLS per supporto
- [ ] Realtime subscription su `services` per aggiornamento live catalogo capostipite
- [ ] Export PDF preventivo HTML/CSS via puppeteer per layout custom
- [ ] i18n (briefing menziona "architettura predisposta per multi-lingua")
- [ ] Test load Edge Functions (concurrency 50+ generate-pdf)
- [ ] Backup + restore strategia
- [ ] GDPR: esportazione dati utente + delete cascade su richiesta
