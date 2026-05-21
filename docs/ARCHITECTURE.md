# Wedding Platform &mdash; Architettura

> Snapshot al 2026-05-21. Versione MVP completata.

## Visione

Network "vasi comunicanti" per il settore wedding italiano. I fornitori inseriscono i dati una volta sola; capostipiti (Wedding Planner, Location) li riusano per costruire preventivi, coordinare calendari e relazionarsi con il cliente finale.

## Layer

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite + Tailwind + shadcn)                 │
│  ├─ AuthProvider (Supabase Auth, JWT in localStorage)          │
│  ├─ React Query (cache server-state, invalidate on mutation)   │
│  └─ pages/* (Login, Catalog, Calendar, Quotes, Brand, /p/...)  │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼  HTTPS  (Supabase JS SDK)
┌────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres 17 + PostgREST + GoTrue + Storage + Edge)  │
│  ├─ Auth: email/password + magic link                          │
│  ├─ PostgREST: REST autogenerate da schema                     │
│  ├─ RLS Postgres: prima linea di sicurezza                     │
│  ├─ Storage: service-photos / quote-pdfs / brand-assets        │
│  ├─ Realtime (predisposto, non usato in MVP)                   │
│  └─ Edge Functions (Deno) custom:                              │
│      upload-photo, calendar-notify, calendar-export-ics,       │
│      quote-generate-pdf, quote-send                            │
│  └─ Email: Resend (con fallback Mailpit in locale)             │
└────────────────────────────────────────────────────────────────┘
```

## Modello dati (16 tabelle)

```
profiles (estende auth.users)
│   role, subrole, subscription_tier, brand_*, notification_preferences
│
├── collaborations (capostipite_id, fornitore_id, status, invite_token)
│
├── service_categories (is_standard, subrole filter)
│
└── services (fornitore_id)
    ├── price_versions (snapshot storia prezzi, trigger auto)
    ├── service_photos (max 10, thumb 400x400)
    └── service_modifiers (PERCENT | FIXED)

calendar_entries (owner_id capostipite, status enum)
├── calendar_entry_participants (entry+user)
├── notification_queue (audit / batch coalescenza)
└── calendar_export_tokens (UUID, expires 90gg)

quotes (owner_id, access_token, totals auto, jsonb log)
├── quote_items (snapshot price, modifiers jsonb, line_cost/line_client trigger)
└── quote_supplier_markups (override percent per supplier+quote)
```

## Sicurezza (RLS)

- Ogni tabella ha `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Helper SECURITY DEFINER:
  - `is_admin()` &mdash; bypass per ruolo ADMIN
  - `has_active_collab_with_supplier(uuid)` &mdash; check collab attiva
  - `is_entry_participant(uuid)` &mdash; ownership entry
  - `is_quote_owner(uuid)` &mdash; ownership quote
- View `calendar_entries_for_participants` esclude `client_*`, `value_amount`, `notes`.
- RPC pubbliche `quote_get/accept/reject_by_token` con `grant execute to anon` per /p/* (idempotenti, gestiscono cascade su calendar_entries).

Test: `tests/sql/rls_tests.sql` (8 scenari impersonation con `set_config('request.jwt.claim.sub', ...)`).

## Edge Functions

| Function | Trigger | Cosa fa |
|---|---|---|
| `upload-photo` | client (multipart) | valida + sharp resize 400x400 + upload Storage + insert `service_photos` |
| `calendar-notify` | client (post-mutation) | per ogni participant: lookup email, send Resend (skip se no API key), insert `notification_queue` con esito |
| `calendar-export-ics` | GET `?token=<uuid>` | verifica token + scadenza, genera VCALENDAR RFC 5545 con entries owner + participant dedup |
| `quote-generate-pdf` | client / `quote-send` | jsPDF layout NEUTRA o PREMIUM con brand colori/logo, upload a `quote-pdfs/{quote_id}/v{revision}.pdf`, signed URL 7g |
| `quote-send` | client | invoke generate-pdf + UUID access_token + UPDATE status INVIATO + INSERT calendar_entry IN_TRATTATIVA + auto-aggancia supplier come participants + send email Resend |

Tutte le function sono Deno + `jsr:@supabase/supabase-js@2` + service_role per bypass RLS controllato.

## Trigger DB (security definer)

| Trigger | Tabella | Azione |
|---|---|---|
| `set_updated_at()` | tutte | `new.updated_at = now()` |
| `services_after_insert_price()` | services | INSERT price_versions iniziale |
| `services_after_update_price()` | services | chiude vecchia + INSERT nuova on `base_price` change |
| `quote_items_recalc_lines()` | quote_items (BEFORE) | calcola line_cost (qty × price × modifiers) e line_client (cost × 1+markup) |
| `quote_items_after_change()` | quote_items (AFTER) | invoke `quotes_recalc_totals(quote_id)` |
| `quote_supplier_markup_after_change()` | quote_supplier_markups | ritrigger items del fornitore + recalc totals |
| `quotes_default_markup_after_update()` | quotes | recalc totals on default_markup_percent change |
| `enforce_free_quote_limit()` | quotes (BEFORE INSERT) | RAISE EXCEPTION se tier=FREE e count attivi >= 10 |
| `handle_new_auth_user()` | auth.users (AFTER INSERT) | crea row in `public.profiles` con role/subrole da `raw_user_meta_data` |

Funzione utility: `calcola_markup_effettivo(quote_id, supplier_id, item_markup)` &mdash; cascade item override &rarr; supplier override &rarr; quote default.

## Flow chiave: invio preventivo

```
[WP click "Invia"]
   │
   ▼
useSendQuote → supabase.functions.invoke('quote-send')
   │
   ▼
Edge Function quote-send:
  1. fetch quote-generate-pdf  ──┐
  2. UUID v4 → access_token       │
  3. UPDATE quotes status=INVIATO │
  4. INSERT calendar_entry        ▼
     status=IN_TRATTATIVA      Storage quote-pdfs/{id}/v1.pdf
     value_amount=total_client
     quote_id=ref
  5. SELECT DISTINCT supplier_id FROM quote_items
     INSERT calendar_entry_participants per ognuno
  6. POST Resend → email cliente con link /p/preview/:token
```

## Flow chiave: accept cliente

```
[Cliente click "Accetto" su /p/preview/:token]
   │
   ▼  Link react-router → /p/accept/:token
QuoteAcceptPage useEffect → supabase.rpc('quote_accept_by_token')
   │
   ▼
RPC SECURITY DEFINER:
  UPDATE quotes status=ACCETTATO WHERE access_token=p AND status IN ('INVIATO','ACCETTATO')
  → idempotente per React StrictMode double-mount
  → cascade: UPDATE calendar_entries status=OPZIONATA WHERE quote_id=v_id
  ritorna boolean
```

## Multi-tenant isolamento

- RLS impone owner-per-row sui dati capostipite (`owner_id = auth.uid()`).
- I servizi sono visibili al capostipite SOLO via JOIN su `collaborations` con `status='ACTIVE'`.
- I participant vedono entry solo via view ridotta &mdash; impossibile accedere a colonne sensibili a livello SQL.
- Public endpoints (`/p/*`) NON usano RLS bypass diretto: usano RPC `SECURITY DEFINER` con check esplicito `WHERE access_token = ?` &mdash; nessuna policy concede SELECT diretto a anon.

## Storage layout

```
service-photos/        (public)
  └── {service_id}/
      ├── {photo_id}.{jpg|png|webp}
      └── thumb/{photo_id}.jpg

quote-pdfs/            (privato, accesso solo via signed URL Edge Function)
  └── {quote_id}/v{revision}.pdf

brand-assets/          (public)
  └── {user_id}/
      └── logo-{timestamp}.{png|jpg|svg|webp}
```

## Decisioni architetturali pragmatiche

1. **No trigger pg_net DB → Edge Function**: la notifica viene chiamata dal client dopo mutation. Equivalente funzionale, più testabile, meno fragile (un trigger fallito non blocca l'INSERT).
2. **jsPDF in Edge Function invece di Puppeteer**: footprint minimo (~200KB import), startup veloce. Per layout complessi futuri si può migrare a Chromium headless.
3. **publishable key Supabase 2.x come anon nel frontend**: usiamo il JWT classico per compatibilità totale RLS.
4. **db:reset come fonte di verità**: ogni run rifresca con seed. Niente migration ad-hoc per dati.
