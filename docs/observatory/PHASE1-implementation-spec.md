# Osservatorio Planfully — Fase 1: spec di implementazione

**Stato: blueprint pronto, NON eseguibile finché il gate non è verde** (5 branch sicurezza + dati
reali D8 + firma legale §7). Il SQL qui sotto **non** è in `supabase/migrations/`: vive nel
documento apposta, per non auto-applicarsi a un modulo congelato. Quando il gate scatta, un agente
lo solleva in file `YYYYMMDDHHMMSS_*.sql` nell'ordine §8.

Obiettivo Fase 1 (dal PRP §8): **una metrica end-to-end** — il capostipite vede un benchmark prezzo
reale, anonimo, con campione dichiarato; sotto soglia "dati insufficienti". Qui specifichiamo tutte
e 3 le metriche di lancio (D2) perché condividono lo stesso scheletro, ma il go-live è cella-per-cella
(D8): basta che ne accenda una.

Parametri (da D1–D8): `k=5` generale, `k=7` prezzo; anti-dominanza `≤ 40%`; geo = `subrole × macro-area`
via `public.it_macro_area(profiles.province)` (Fase 0); cadenza **mensile**; lettura **solo
capostipiti** al lancio.

---

## 1. Principio dei due piani (vincolante, PRP §2.8)

- **Piano motore** (scrive): viste materializzate grezze + `refresh_observatory()` `SECURITY DEFINER`,
  **non** eseguibili dal client. Fanno l'aggregazione con `HAVING k` e anti-dominanza.
- **Piano lettura** (serve): il client legge **solo** `observatory_snapshots`, già anonimizzata e
  k-safe, via una RPC con check di ruolo. Mai dalle viste motore, mai dalle tabelle operative.

---

## 2. Migrazioni — tabelle

### 2.1 Consenso fornitore (PRP §4.1)

```sql
create table public.supplier_data_consent (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.profiles(id) on delete restrict,
  status        text not null check (status in ('granted','revoked')),
  scope         text not null default 'aggregate_anonymous',
  granted_at    timestamptz,
  revoked_at    timestamptz,
  contract_ref  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index uq_consent_active on public.supplier_data_consent(supplier_id) where status='granted';
create index idx_consent_supplier on public.supplier_data_consent(supplier_id) where status='granted';

alter table public.supplier_data_consent enable row level security;
-- il fornitore vede/gestisce SOLO il proprio consenso; admin tutto.
create policy consent_self on public.supplier_data_consent for all
  using (supplier_id = auth.uid() or public.is_admin())
  with check (supplier_id = auth.uid() or public.is_admin());
```

> Il consenso si raccoglie con la clausola contrattuale fornitore (Art. 1341 c.c. in revisione):
> una riga `granted` con `contract_ref`. Revoca → `status='revoked'`, `revoked_at=now()`.

### 2.2 Snapshot pubblicabili (PRP §4.2) — l'unica tabella che il client legge

```sql
create table public.observatory_snapshots (
  id            uuid primary key default gen_random_uuid(),
  metric_key    text not null,         -- 'price_median' | 'seasonality' | 'quote_conversion'
  subrole       text,                  -- asse settore (sostituisce category_id grezzo)
  geo_level     text not null,         -- 'macro_area' | 'national'
  geo_code      text not null,         -- es. 'SUD' | 'IT'
  period_start  date not null,
  period_end    date not null,
  n_sample      integer not null,
  k_entities    integer not null,
  payload       jsonb not null,        -- {median,p25,p75} | {by_month:{...}} | {rate}
  methodology   text not null,
  created_at    timestamptz not null default now(),
  constraint chk_k_floor check (k_entities >= 5)   -- floor statico; soglia reale nel refresh
);
create index idx_snap_lookup on public.observatory_snapshots(metric_key, subrole, geo_level, geo_code, period_end desc);

alter table public.observatory_snapshots enable row level security;
-- LETTURA: solo capostipiti (D4 lancio = a) + admin. Niente anon (principio 7).
create policy snap_read_capostipiti on public.observatory_snapshots for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN')));
-- SCRITTURA: nessuna policy → solo il refresh SECURITY DEFINER (owner) scrive.
```

### 2.3 Fonti esterne curate a mano (Fase 3, qui per completezza — PRP §4.3)

```sql
create table public.observatory_external_sources (
  id varchar primary key default gen_random_uuid()::text,
  title text not null, publisher text not null, reference_year int,
  source_url text, note text, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- RLS: lettura capostipiti, scrittura solo admin/editor. (dettaglio in Fase 3)
```

---

## 3. Migrazioni — motore (viste materializzate, NON leggibili dal client)

> Revoca esplicita: `revoke all on mv_obs_* from anon, authenticated;` — le mv alimentano solo il refresh.

### 3.1 Indice prezzi mediano (k=7, anti-dominanza 40%)

```sql
create materialized view public.mv_obs_price as
with svc as (
  select s.base_price, p.id as supplier_id, p.subrole,
         public.it_macro_area(p.province) as macro_area
  from public.services s
  join public.profiles p on p.id = s.fornitore_id
  join public.supplier_data_consent c on c.supplier_id = p.id and c.status='granted'
  where s.is_active and p.subrole is not null
    and public.it_macro_area(p.province) is not null
),
per_supplier as (
  select subrole, macro_area, supplier_id, count(*) cnt
  from svc group by subrole, macro_area, supplier_id
),
cells as (
  select subrole, macro_area,
         count(distinct supplier_id) k_entities,
         sum(cnt) n_sample,
         max(cnt)::numeric / nullif(sum(cnt),0) max_share
  from per_supplier group by subrole, macro_area
)
select c.subrole, c.macro_area, c.k_entities, c.n_sample, c.max_share,
       percentile_cont(0.5)  within group (order by s.base_price) median,
       percentile_cont(0.25) within group (order by s.base_price) p25,
       percentile_cont(0.75) within group (order by s.base_price) p75
from cells c
join svc s on s.subrole = c.subrole and s.macro_area = c.macro_area
where c.k_entities >= 7 and c.max_share <= 0.40
group by c.subrole, c.macro_area, c.k_entities, c.n_sample, c.max_share;
```

### 3.2 Stagionalità domanda (k=5 eventi)

```sql
create materialized view public.mv_obs_seasonality as
select public.it_macro_area(p.province) as macro_area,
       extract(month from ce.date_from)::int as month,
       count(*) as n_sample, count(*) as k_entities  -- entità = eventi
from public.calendar_entries ce
join public.profiles p on p.id = ce.owner_id
where ce.status = 'CONFERMATA' and ce.date_from is not null
  and public.it_macro_area(p.province) is not null
group by 1, 2
having count(*) >= 5;
```

### 3.3 Conversione preventivo→firmato (k=5 fornitori)

```sql
create materialized view public.mv_obs_conversion as
with qs as (
  select distinct q.id quote_id, q.status, p.subrole, p.id supplier_id
  from public.quotes q
  join public.quote_items qi on qi.quote_id = q.id
  join public.profiles p on p.id = qi.supplier_id
  join public.supplier_data_consent c on c.supplier_id = p.id and c.status='granted'
  where q.sent_at is not null and p.subrole is not null
)
select subrole,
       count(distinct supplier_id) k_entities,
       count(distinct quote_id) n_sample,
       count(distinct quote_id) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))::numeric
         / nullif(count(distinct quote_id),0) conversion_rate
from qs group by subrole
having count(distinct supplier_id) >= 5;
```

---

## 4. Refresh + Cron (mensile, D5)

```sql
create or replace function public.refresh_observatory() returns void
language plpgsql security definer set search_path = public as $$
declare v_start date := date_trunc('month', now())::date - interval '1 month';
        v_end   date := date_trunc('month', now())::date - interval '1 day';
begin
  refresh materialized view public.mv_obs_price;
  refresh materialized view public.mv_obs_seasonality;
  refresh materialized view public.mv_obs_conversion;

  -- ripopola lo snapshot del periodo (idempotente): cancella e reinserisce solo le celle k-safe.
  delete from public.observatory_snapshots where period_start = v_start;

  insert into public.observatory_snapshots
    (metric_key, subrole, geo_level, geo_code, period_start, period_end, n_sample, k_entities, payload, methodology)
  select 'price_median', subrole, 'macro_area', macro_area, v_start, v_end, n_sample, k_entities,
         jsonb_build_object('median',median,'p25',p25,'p75',p75),
         'Mediana dei prezzi di listino dei fornitori consenzienti per settore e macro-area. Campione Planfully, non rappresentativo del mercato nazionale.'
  from public.mv_obs_price;

  insert into public.observatory_snapshots
    (metric_key, subrole, geo_level, geo_code, period_start, period_end, n_sample, k_entities, payload, methodology)
  select 'seasonality', null, 'macro_area', macro_area, v_start, v_end,
         sum(n_sample), sum(k_entities),
         jsonb_object_agg(month, n_sample),
         'Distribuzione delle date evento confermate per mese. Mostra quando si concentra la domanda.'
  from public.mv_obs_seasonality group by macro_area
  having sum(k_entities) >= 5;

  insert into public.observatory_snapshots
    (metric_key, subrole, geo_level, geo_code, period_start, period_end, n_sample, k_entities, payload, methodology)
  select 'quote_conversion', subrole, 'national', 'IT', v_start, v_end, n_sample, k_entities,
         jsonb_build_object('rate', round(conversion_rate,3)),
         'Quota di preventivi inviati che arrivano a firma, per settore. FIRMATO è stato terminale.'
  from public.mv_obs_conversion;
end$$;

revoke all on function public.refresh_observatory() from anon, authenticated;  -- solo cron/owner

-- Cron Supabase (pg_cron): primo del mese, 03:00 UTC.
select cron.schedule('observatory-refresh-monthly', '0 3 1 * *',
  $$ select public.refresh_observatory(); $$);
```

---

## 5. Lettura dal client (RPC k-safe, solo capostipiti, dietro feature flag)

### 5.1 Interruttore unico di pubblicazione (deploy dormiente)

Il motore può girare e **accumulare** snapshot fin da subito (sono k-safe → innocui). Ma la
**pubblicazione** resta dietro un singolo flag che un umano gira **una volta sola, dopo la firma del
legale §7**. Pattern identico a `referral_accounting_enabled`.

```sql
create table if not exists public.observatory_config (
  id boolean primary key default true check (id),   -- riga singola
  live boolean not null default false,              -- false = dormiente; true = pubblica
  updated_at timestamptz not null default now()
);
insert into public.observatory_config(id, live) values (true, false) on conflict do nothing;

create or replace function public.is_observatory_live()
returns boolean language sql stable set search_path = public as $$
  select coalesce((select live from public.observatory_config where id), false);
$$;
```

### 5.2 RPC di lettura

```sql
create or replace function public.get_observatory(p_metric text default null)
returns setof public.observatory_snapshots
language sql stable security definer set search_path = public as $$
  select s.* from public.observatory_snapshots s
  where public.is_observatory_live()                          -- finché false → ritorna 0 righe
    and exists (select 1 from public.profiles p where p.id = auth.uid()
               and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN'))
    and (p_metric is null or s.metric_key = p_metric)
  order by s.period_end desc, s.metric_key;
$$;
grant execute on function public.get_observatory(text) to authenticated;  -- mai anon
```

> Con `live = false` la RPC non restituisce nulla, anche se gli snapshot esistono: il dato si
> accumula da solo (cella-per-cella, D8) ma **non si vede** finché un umano non gira il flag dopo la
> firma legale. `observatory_snapshots` contiene comunque **solo** celle oltre `k` + anti-dominanza:
> nessuna RPC tocca le mv o le tabelle operative (principio 7).

### 5.3 Perché NON auto-attivare sul numero di clienti

Il `k`-gate protegge dal mostrare celle *sotto soglia*; **non** sostituisce i due lucchetti
**non-tecnici** che il PRP §7 mette prima della prima cella pubblicata: **firma legale** e **flusso
di consenso attivo**. Auto-pubblicare al crescere del campione li scavalcherebbe. Quindi: deploy
dormiente + flag manuale = "già dentro, si riempie da solo, ma si accende con un interruttore unico".

---

## 6. Contratto UI (PRP §5, non negoziabile)

Ogni scheda metrica nel cruscotto capostipite mostra **sempre**: `n` (numerosità), **intervallo**
(es. p25–p75 per il prezzo), **periodo** (`period_start`–`period_end`), **una riga di metodologia**
(`methodology`), e la nota *"campione Planfully, non rappresentativo dell'intero mercato nazionale"*.
Celle assenti (sotto `k`) → **"dati insufficienti"**, mai un valore.

---

## 7. Definition of Done (PRP §9) — test obbligatori

- [ ] **RLS impersonazione**: come capostipite / fornitore / anon, nessuna query risale al prezzo di
      un fornitore identificabile. (test: select diretta su `services`/mv negata; solo snapshot aggregati.)
- [ ] **Soglia k**: inserito un dataset con `k-1` fornitori in una cella → la cella NON compare in
      `observatory_snapshots`; con `k` → compare. UI "dati insufficienti" sotto soglia.
- [ ] **Anti-dominanza**: cella con `k` entità ma una al 60% → NON pubblicata.
- [ ] **No-granular**: `get_observatory` e ogni vista esposta non restituiscono righe per-fornitore.
- [ ] **Consenso**: fornitore senza `granted` non entra in alcun aggregato; revoca → esce al refresh
      successivo (test con `refresh_observatory()` forzato; la cella può ri-spegnersi se scende sotto k).
- [ ] **Contratto UI**: ogni metrica mostra n/intervallo/periodo/metodologia (e2e).
- [ ] **No-network**: nessuna chiamata di rete a fonti esterne nel runtime.
- [ ] **Feature flag**: con `observatory_config.live = false` la RPC `get_observatory` ritorna **0
      righe** anche se gli snapshot esistono; con `live = true` ritorna le celle k-safe. (Garantisce
      che l'accumulo dati non equivale a pubblicazione.)
- [ ] **Firma legale §7** ottenuta (antitrust / GDPR / IP) **prima** di girare il flag a `true`.

I test k/anti-dominanza/consenso girano su un seed sintetico in transazione + `refresh_observatory()`,
poi rollback — niente dati finti in prod (coerente con la disciplina del progetto).

---

## 8. Ordine di rollout (quando il gate è verde)

1. `*_observatory_consent.sql` — §2.1 (+ raccolta consenso nella clausola contrattuale fornitore).
2. `*_observatory_snapshots.sql` — §2.2.
3. `*_observatory_engine.sql` — §3 (le 3 mv) + §4 (refresh + cron).
4. `*_observatory_read.sql` — §5 (RPC).
5. `*_observatory_read.sql` include il **flag** `observatory_config` (default `live = false`) — §5.1:
   il motore gira e accumula snapshot, ma nulla è visibile.
6. Frontend: una scheda metrica nel cruscotto capostipite (contratto UI §6), poi le altre due.
7. Test DoD §7 → verde. **Firma legale §7 → si gira `observatory_config.live = true`** (un solo
   `update`, da admin): da qui go-live **automatico cella-per-cella** (D8), senza altri interventi.

La Fase 2 (ricarico, trend storico, "tuo dato vs benchmark" fornitore) e la Fase 3 (fonti esterne)
riusano questo scheletro.
