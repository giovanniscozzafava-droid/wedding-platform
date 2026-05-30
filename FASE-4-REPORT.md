# FASE 4 — Notifiche evolute + Riconciliazione

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi

1. **4.1 Notifiche evolute** — Estendere `notifiche` con `scadenza_il` + `relativa_a_data_nozze_giorni`. Funzione `notifiche_genera_promemoria_per_evento(p_entry_id)` che crea promemoria a -30/-14/-7/-2 giorni. Vista `v_notifiche_digest_per_utente`. Funzione `invia_digest_giornaliero()` placeholder (logger). Documentare pg_cron.
2. **4.2 Riconciliazione** — Vista `v_riconciliazione_evento` (ospiti YES vs coperti PER_GUEST + delta + importi). Componente `RiconciliazioneCard` in nuova tab "Riconciliazione" del `WeddingDashboard`. RPC `riconciliazione_allinea_menu` invocato dal pulsante "Allinea menu al conteggio".

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530400000_fase4_notifiche_promemoria.sql` | Alter `notifiche` (+ `scadenza_il`, + `relativa_a_data_nozze_giorni`). Funzione `notifiche_genera_promemoria_per_evento(uuid)`. Vista `v_notifiche_digest_per_utente`. Funzione `invia_digest_giornaliero()` placeholder. SQL pg_cron commentato. |
| `supabase/migrations/20260530410000_fase4_riconciliazione.sql` | Vista `v_riconciliazione_evento` con `entry_id, totale_ospiti_yes, totale_ospiti_pending, count_menu_for_guest, delta, importo_menu_per_guest, importo_totale_quote`. RPC `riconciliazione_allinea_menu(uuid)` security definer. |

## Schema dettaglio

### `notifiche` (alter)

```
scadenza_il                    timestamptz   -- "diventa live"
relativa_a_data_nozze_giorni   int           -- offset (es. -30, -14, -7, -2)
```

Indice parziale `idx_notifiche_scadenza_il (scadenza_il) where stato='PENDING' and scadenza_il is not null`.

### Funzione `notifiche_genera_promemoria_per_evento(p_entry_id uuid) returns int`

- security definer, search_path = public.
- Backfill **idempotente** su unique `(destinatario_id, evento_id, tipo)` (gia` esistente in FASE 2).
- Genera per ogni offset in `{-30, -14, -7, -2}`:
  - una notifica `PROMEMORIA_EVENTO_<offset>` per `owner_id` del `calendar_entry` + per ogni `couple` partecipante, con `scadenza_il = (date_from + offset)::timestamptz`.
  - per ogni `scadenzario_voci` non pagata dell'evento (best-effort, `exception when undefined_table`): notifica `PROMEMORIA_SCADENZA_<voce_id>_<offset>` per owner WP + debitore + creditore (deduplicati), con `scadenza_il = (scadenza + offset)::timestamptz`.
- `priorita = 9` per offset >= -7, `priorita = 6` altrimenti.
- Rispetta la volonta` utente: se `stato in ('DONE','SKIPPED')` non riapre la notifica (non sovrascrive `letto_il`).
- `grant execute to authenticated`.

### Vista `v_notifiche_digest_per_utente`

`security_invoker = true` (rispetta RLS di `notifiche`).

Colonne: `data_digest (date)`, `destinatario_id (uuid)`, `totale (bigint)`, `primi_10 (jsonb)`.

Aggrega le PENDING con `scadenza_il is not null`, raggruppando per `(scadenza_il at time zone 'Europe/Rome')::date`. Espone `count(*)` e jsonb_agg delle prime 10 per priorita`/scadenza.

### Funzione `invia_digest_giornaliero() returns int`

Placeholder: cicla la vista filtrando `data_digest = oggi` (Europe/Rome) e per ogni utente fa `raise notice 'digest user=% count=% primi=%'`. Restituisce il numero di utenti coinvolti.

Pensata per essere chiamata via pg_cron (vedi sotto). Nel prossimo step si sostituira` la log con call a edge function email/transactional.

### Vista `v_riconciliazione_evento`

`security_invoker = true`.

```
entry_id                  uuid
totale_ospiti_yes         int   -- sum(party_size) where rsvp='YES'
totale_ospiti_pending     int   -- sum(party_size) where rsvp='PENDING'
count_menu_for_guest      numeric -- sum(quantity) di quote_items con quantity_basis='PER_GUEST'
delta                     numeric -- count_menu_for_guest - totale_ospiti_yes
importo_menu_per_guest    numeric -- avg(snapshot_price) sui PER_GUEST
importo_totale_quote      numeric -- sum(line_client) sui PER_GUEST
```

Nota terminologica: la traccia parla di `unit_snapshot='PER_GUEST'`, ma nello schema reale:
- `quote_items.unit_snapshot` e` un enum `service_unit` `(PEZZO|PERSONA|ORA|EVENTO)` — descrive l'unita` di misura snapshot.
- `quote_items.quantity_basis` e` l'enum `quantity_basis` `(FLAT|PER_GUEST|PER_TABLE|PER_HOUR)` — descrive il moltiplicatore automatico legato a `quote.guest_count` / `table_count` (FASE quote_basis del 21/05).

L'allineamento "menu al conteggio" lavora dunque su `quantity_basis = 'PER_GUEST'` (semantica = "una porzione per ogni invitato"). E` annotato in commento dentro la migrazione.

### RPC `riconciliazione_allinea_menu(p_entry_id uuid) returns jsonb`

- security definer.
- Authz: `owner_id = auth.uid()` del `calendar_entry` oppure `is_admin()` (altrimenti `42501`).
- Se `quote_id` e` null ritorna `{updated:0, reason:'no_quote'}`.
- Calcola `v_yes = sum(case when rsvp='YES' then party_size else 0)`.
- `UPDATE quote_items SET quantity = greatest(v_yes, 1) WHERE quote_id = ... and quantity_basis = 'PER_GUEST'`.
- Ritorna `{updated, totale_ospiti_yes, quote_id}`.
- `grant execute to authenticated`.

Il `greatest(v_yes, 1)` evita di violare il `check (quantity > 0)` su `quote_items` quando l'evento ha ancora 0 YES.

## pg_cron — come abilitare

1. Supabase dashboard del progetto → **Database** → **Extensions** → cercare `pg_cron` → **Enable**.
2. Una volta abilitata, schedulare via SQL editor (esempio, gia` documentato in migrazione):

```sql
-- digest giornaliero alle 8:00 server time
select cron.schedule(
  'invia-digest-giornaliero',
  '0 8 * * *',
  $$select public.invia_digest_giornaliero();$$
);

-- rigenerazione promemoria di tutti gli eventi futuri ogni notte alle 2:15
select cron.schedule(
  'rigenera-promemoria',
  '15 2 * * *',
  $$do $$
    declare r record;
    begin
      for r in select id from public.calendar_entries
                where date_from >= current_date
      loop
        perform public.notifiche_genera_promemoria_per_evento(r.id);
      end loop;
    end$$;$$
);
```

Il blocco e` riportato anche in coda alla migrazione `20260530400000_fase4_notifiche_promemoria.sql`, commentato per non eseguirsi al `db reset`.

## Frontend

### `RiconciliazioneCard.tsx`

Path: `frontend/src/components/wedding/RiconciliazioneCard.tsx`.

Mobile-first:
- Header con titolo + CTA secondario "Ricarica" (min-h-44).
- 3 KPI card responsive: Ospiti confermati / Coperti su preventivo / Delta (con colore semantico: verde=ok, ambra=eccesso, rosso=difetto).
- Card importi (medio per ospite + totale preventivo).
- Card "Allinea menu al conteggio" appare **solo se** `delta != 0 && count_menu_for_guest > 0`. Una azione primaria ("Allinea menu al conteggio") che apre conferma inline (Annulla / Conferma allineamento) per evitare azioni accidentali. Tutti i tap target >= 44px.
- Stato success: pill verde "Coperti e ospiti confermati sono allineati" quando delta == 0 e ci sono voci PER_GUEST.
- Empty state se la vista non ha riga.
- Toast `sonner` per esito (numero righe aggiornate).

### `WeddingDashboard.tsx`

- Aggiunto import `Scale` da `lucide-react` + import `RiconciliazioneCard`.
- Nuovo `TabKey` `'riconciliazione'`.
- Nuova tab `{ key: 'riconciliazione', label: 'Riconciliazione', icon: Scale }` inserita fra "Pagamenti" e "Checklist" (vicina a Budget/Payments — flusso commerciale/operativo).
- Aggiunto render: `{tab === 'riconciliazione' && <RiconciliazioneCard entryId={wedding.id} />}`.

## Build

```
cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build
```
**PASS** — `built in 1.00s`, nessun errore TS.

## DB

`supabase db reset --local` continua a fallire sui seed legacy (`v_sara`/`TEST-SEED`/`lead_requests`) — stesso problema documentato in FASE 1/2/3. Le migrazioni di FASE 4 sono **scritte e committate ma NON applicate** al DB locale in questa sessione. Sono idempotenti e pronte ad essere applicate appena i seed legacy verranno ripuliti (fuori scope FASE 4).

Per applicarle in preview/CI: il workflow Supabase eseguira` `supabase migration up` su un DB pulito (senza i seed legacy).

## Mobile-first

- `RiconciliazioneCard`: colonna singola < sm, grid 3-col KPI > sm, una azione primaria (Allinea menu) con conferma inline. Tutti i tap target Button (>=44px).
- Tab `Riconciliazione` accessibile dallo strip orizzontale scrollabile di WeddingDashboard (gia` mobile-first dalla FASE 1/2).

## File toccati / creati

Creati:
- `supabase/migrations/20260530400000_fase4_notifiche_promemoria.sql`
- `supabase/migrations/20260530410000_fase4_riconciliazione.sql`
- `frontend/src/components/wedding/RiconciliazioneCard.tsx`
- `FASE-4-REPORT.md`

Modificati:
- `frontend/src/pages/wedding/WeddingDashboard.tsx` (import `Scale`, import `RiconciliazioneCard`, TabKey, voce TABS, render tab)

## Criticita` / Note

- **Seed legacy ancora rotti**: stessa diagnosi delle FASI precedenti. `supabase db reset` non si completa. Fuori scope FASE 4.
- **DB locale non aggiornato**: migrazioni scritte come file, non applicate. Idempotenti.
- **Cast `as any` lato frontend**: la vista `v_riconciliazione_evento` e la RPC `riconciliazione_allinea_menu` non sono ancora nei types generati. Usato `(supabase.from('...' as any) as any)` e `(supabase as any).rpc(...)`. Da rigenerare con `npm run db:types` quando il DB sara` aggiornato — fuori scope FASE 4.
- **pg_cron non eseguito**: l'abilitazione richiede la dashboard Supabase (vedi sezione). Lo schedule e` documentato in migrazione come SQL commentato, per evitare errori di `db reset` su istanze dove pg_cron non e` ancora attivo.
- **Terminologia traccia vs schema**: la traccia 4.2 indica `unit_snapshot='PER_GUEST'` ma lo schema reale ha `quote_items.unit_snapshot service_unit (PEZZO|PERSONA|ORA|EVENTO)` e `quote_items.quantity_basis quantity_basis (FLAT|PER_GUEST|PER_TABLE|PER_HOUR)`. L'allineamento usa `quantity_basis = 'PER_GUEST'`, coerente con la semantica "una porzione per ogni invitato" e con `quotes_propagate_basis` (trigger esistente sulla guest_count del preventivo). E` documentato come commento in `20260530410000_fase4_riconciliazione.sql`.
- **`invia_digest_giornaliero` e` un placeholder**: non spedisce email. La vista `v_notifiche_digest_per_utente` e` pronta per essere consumata da una edge function (fuori scope FASE 4).
- **`notifiche_genera_promemoria_per_evento` non e` triggered automaticamente**: l'invocazione e` lasciata al cron job notturno (`rigenera-promemoria`) o a call manuale. Si potrebbe agganciare un trigger AFTER INSERT/UPDATE su `scadenzario_voci` per crearli "live" — annotato come miglioria futura per non aumentare lo scope.
