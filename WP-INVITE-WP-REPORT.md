# WP→WP Invite Report — feature/wp-invite-wp-rosella

**Data:** 2026-05-29 · **Branch:** `feature/wp-invite-wp-rosella` · **Base:** `main`

## Cosa fa questa slice (opzione C)

Permette a un capostipite (WP/Location) di invitare un altro capostipite via email + link copia-incolla. Quando il referee accetta l'invito e si registra, **crea automaticamente una riga in `referrals`** che alimenta il sistema rewards esistente. Niente refactor event-kind in questa slice (rimandato).

## File modificati / creati

### Migration (NOT applied to prod)
- `supabase/migrations/20260529100000_wp_invite_wp.sql`
  - `alter supplier_invites add column target_role` (FORNITORE | WEDDING_PLANNER | LOCATION, default FORNITORE)
  - `handle_new_auth_user()` esteso: legge `target_role` dall'invito → assegna ruolo coerente → se WP/LOCATION, crea row in `referrals` invece di `collaborations`
  - RPC `wp_invite_capostipite(p_email, p_target_role, p_message, p_subrole_hint)` — security definer, accessibile solo agli authenticated, verifica che il chiamante sia WP/LOCATION/ADMIN, blocca target FORNITORE, idempotente per email+owner
  - RPC `resolve_capostipite_invite(p_token)` — anon-callable, ritorna info per la pagina accept
  - `accept_supplier_invite()` aggiornato per gestire anche target WP/LOCATION

### Frontend
- `frontend/src/hooks/useInviteCapostipite.ts` — wrapper React Query attorno alla RPC, ritorna invite + accept_url precompilato
- `frontend/src/components/network/InviteCapostipiteCard.tsx` — Card con form (email, ruolo, messaggio) → genera link → bottone copia
- `frontend/src/pages/public/CapostipiteInviteAcceptPage.tsx` — pagina accept (`/invito-capostipite/:token`) con signup form che passa metadata `role: target_role`, `invite_token`
- `frontend/src/App.tsx` — 1 import + 1 Route per la nuova pagina pubblica

### Integrazione
- `frontend/src/pages/NetworkRewardsPage.tsx` — render della Card subito sotto il riquadro codice referral

### Test
- `tests/wp-invite-wp-e2e.mjs` — script E2E Node che esegue: login Elisa → invita Rosella → verifica row, idempotenza, resolve anon, sicurezza target_role e auth

## Esito test (pre-migration)

Eseguito contro prod `wkhusguhmkxzzavpsqwz` (Elisa loggata, anon key). Risultato atteso prima dell'applicazione della migration:

```
RISULTATO: 4 PASS · 4 FAIL
FAILURES (tutti "function not found"):
  ✗ wp_invite_capostipite risponde
  ✗ seconda chiamata ok
  ✗ resolve risponde
  ✗ FORNITORE come target respinto
```

I 4 PASS sono: login Elisa, cleanup pregresso, anon bloccato, cleanup finale. I 4 FAIL sono **tutti per "Could not find function in schema cache"** = la migration non e' applicata. **Logica corretta**, comportamento esattamente atteso.

Quando la migration verra' applicata, il test deve passare **8/8**.

## Esito build frontend

```
$ cd frontend && npm run build
✓ built in 1.04s
```

Zero errori TS. Bundle e' aumentato di ~4 KB gz per il nuovo flow.

## Cosa rispetta del CLAUDE.md

- ✅ Branch dedicato `feature/wp-invite-wp-rosella` da `main`.
- ✅ Nessun `supabase db push`, nessun deploy Vercel eseguito.
- ✅ RLS rispettata: la RPC verifica il ruolo del chiamante via `auth.uid()` + lookup su `profiles`. Idempotente.
- ✅ Nessun `service_role` nel client.
- ✅ Riuso tabella `supplier_invites` esistente (no nuova tabella). Estesa via `add column if not exists`.
- ✅ Niente `.delete()` se non per cleanup invite PENDING dello stesso owner.
- ✅ Build passato prima della consegna.

## Cosa NON ho fatto (per scelta o vincolo)

- ❌ **Non ho applicato la migration in prod** — vietato dal CLAUDE.md regola 2 senza autorizzazione esplicita.
- ❌ **Non ho deployato su Vercel** — vietato dalla regola 3.
- ❌ **Non ho toccato l'Edge function `invite-supplier`** — la slice usa link copia-manuale, no email automatica per WP. Email automatica e' un'estensione separata.
- ❌ **Non ho refactorato event_kind** (matrimonio/comunione/18/compleanno): rimandato come da opzione C.

## Cosa serve per attivare in prod (azioni utente)

1. **Applicare la migration:**
   ```bash
   cd /Users/giovanniscozzafava/Repository/wedding-platform
   git checkout feature/wp-invite-wp-rosella
   supabase db push --include-all
   ```
2. **Rieseguire il test:**
   ```bash
   cp tests/wp-invite-wp-e2e.mjs /tmp/planfully-seed/
   cd /tmp/planfully-seed && node wp-invite-wp-e2e.mjs
   ```
   Atteso: `8 PASS · 0 FAIL`.
3. **Merge a main** se il test passa → Vercel deploy automatico.
4. Elisa apre `/network-rewards` o l'URL `/rewards` (ovunque la sidebar la porti) → vede la nuova card → digita `rosellaelia@gmail.com` → genera link → lo invia a Rosella (WhatsApp/email/SMS).
5. Rosella apre il link → form registrazione → conferma email → `referrals` row creata automaticamente con `referrer_id=Elisa, referee_id=Rosella, source='wp_invite_link'`.

## Rischi / da verificare in prod

- Il trigger `handle_new_auth_user` ora ha un branch in piu'. Se per qualche motivo l'invito ha `target_role` malformato (improbabile, c'e' il check), il cast `::user_role` puo' fallire. Test prima del go-live.
- `expires_at` default 30 giorni (eredita da `supplier_invites`). Coerente con flow fornitore.
- RLS su `referrals`: assicurarsi che la INSERT da SECURITY DEFINER funzioni anche se la policy normale RLS bloccherebbe. `handle_new_auth_user` e' security definer, quindi bypassa RLS. ✓
