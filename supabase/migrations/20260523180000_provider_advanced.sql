-- ============================================================================
-- Provider advanced:
-- - profiles.work_style (descrizione modo di lavorare)
-- - profiles.offers_full_dining (location con ristorazione interna - Sud Italia)
-- - profiles.privacy_consent_at (GDPR)
-- - profiles.deletion_requested_at (richiesta cancellazione GDPR)
-- - market_prices: borsino di mercato per categoria/tipo (mediana, p25, p75)
-- - service_presets: pacchetti pre-confezionati riutilizzabili
-- - service_components: calcolatore composizione (fiori singoli → composizione)
-- ============================================================================

alter table profiles
  add column if not exists work_style text,
  add column if not exists offers_full_dining boolean not null default false,
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

-- market_prices: borsino aggiornato manualmente / via job
create table if not exists market_prices (
  id              uuid primary key default gen_random_uuid(),
  subrole         text not null,
  service_kind    varchar(160) not null,
  unit            service_unit not null default 'PEZZO',
  region          text default 'ITALIA',
  price_p25       numeric(10,2) not null,
  price_median    numeric(10,2) not null,
  price_p75       numeric(10,2) not null,
  sample_size     int not null default 0,
  notes           text,
  updated_at      timestamptz not null default now(),
  unique (subrole, service_kind, region)
);
alter table market_prices enable row level security;
create policy "mp_select_all" on market_prices for select using (true);

-- Seed borsino realistico Italia (basato su stime mercato 2024-2026)
insert into market_prices (subrole, service_kind, unit, price_p25, price_median, price_p75, sample_size, notes) values
  ('fotografo', 'Servizio matrimonio full day', 'EVENTO', 1500, 2500, 3800, 120, 'Pacchetto 8-10h con album base'),
  ('fotografo', 'Album fotografico 30x30', 'PEZZO', 350, 600, 950, 80, 'Album rilegato con copertina pelle'),
  ('fotografo', 'Riprese drone', 'EVENTO', 250, 450, 700, 45, 'Permessi inclusi'),
  ('videomaker', 'Video matrimonio', 'EVENTO', 1800, 3000, 4500, 90, 'Trailer + video lungo'),
  ('videomaker', 'Reel social', 'EVENTO', 250, 450, 700, 30, 'Edit 60-90s per IG/TikTok'),
  ('fioraio', 'Bouquet sposa', 'PEZZO', 90, 150, 250, 200, 'Composizione media stagione'),
  ('fioraio', 'Centrotavola standard', 'PEZZO', 25, 45, 75, 250, 'Composizione tonda media'),
  ('fioraio', 'Addobbo chiesa cerimonia', 'EVENTO', 400, 800, 1500, 80, 'Composizioni altare + navate'),
  ('fioraio', 'Allestimento gazebo/arco', 'EVENTO', 300, 600, 1200, 60, 'Struttura + fiori'),
  ('catering', 'Menu base', 'PERSONA', 65, 95, 130, 300, 'Aperitivo + 4 portate + torta'),
  ('catering', 'Menu deluxe', 'PERSONA', 110, 145, 200, 150, 'Crudite + 5 portate + open bar'),
  ('catering', 'Open bar', 'PERSONA', 18, 28, 45, 180, 'Cocktail premium 4h'),
  ('pasticcere', 'Torta nuziale 3 piani', 'PEZZO', 280, 480, 750, 100, 'Decorata, 80-120 persone'),
  ('pasticcere', 'Confettata', 'PEZZO', 80, 140, 220, 90, 'Cassetta confetti personalizzati'),
  ('musica', 'DJ set 5 ore', 'EVENTO', 700, 1200, 1800, 130, 'Service luci/audio incluso'),
  ('musica', 'Band live cerimonia', 'EVENTO', 1000, 1800, 2800, 70, 'Trio o quartetto acustico'),
  ('musica', 'Service audio/luci location', 'EVENTO', 400, 800, 1400, 90, 'Mixer + casse + microfoni'),
  ('allestimenti', 'Allestimento gazebo bianco', 'EVENTO', 800, 1400, 2200, 60, '6x6m, telo + struttura'),
  ('allestimenti', 'Lighting design', 'EVENTO', 600, 950, 1500, 50, 'Catene luminose + spot'),
  ('make_up', 'Make-up sposa con prova', 'EVENTO', 250, 380, 550, 200, 'Prova + giorno evento'),
  ('make_up', 'Acconciatura sposa', 'EVENTO', 150, 220, 320, 200, 'Studio bouquet'),
  ('make_up', 'Make-up testimoni/mamme', 'PERSONA', 70, 110, 170, 150, 'Prezzo a testa'),
  ('location', 'Affitto sala matrimonio', 'EVENTO', 4000, 8000, 15000, 80, 'Solo location senza ristorazione, fascia premium'),
  ('location', 'Pacchetto location + menu', 'PERSONA', 80, 130, 200, 60, 'Tutto compreso per persona (Sud Italia)'),
  ('auto', 'Auto sposi vintage', 'EVENTO', 250, 400, 650, 70, 'Mercedes/Fiat 500 4-5h'),
  ('animazione', 'Mago / Illusionista', 'EVENTO', 400, 700, 1100, 40, 'Show 1-2h durante aperitivo'),
  ('animazione', 'Animazione bambini', 'EVENTO', 250, 450, 700, 60, 'Truccabimbi + giochi 3h'),
  ('abiti', 'Abito sposa atelier', 'PEZZO', 1500, 3000, 6000, 100, 'Sartoria su misura'),
  ('celebrante', 'Cerimonia simbolica', 'EVENTO', 400, 700, 1100, 50, 'Officiante + script personalizzato')
on conflict do nothing;

-- service_presets: pacchetti riutilizzabili per fornitore
create table if not exists service_presets (
  id             uuid primary key default gen_random_uuid(),
  fornitore_id   uuid not null references profiles(id) on delete cascade,
  name           varchar(200) not null,
  description    text,
  default_price  numeric(10,2),
  default_unit   service_unit default 'EVENTO',
  category_id    uuid references service_categories(id) on delete set null,
  items          jsonb not null default '[]'::jsonb,
    -- [{ name, qty, unit_price, subtotal }, ...]
  is_template    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_presets_forn on service_presets(fornitore_id);
alter table service_presets enable row level security;
create policy "presets_select" on service_presets for select using (
  fornitore_id = auth.uid()
  or exists (select 1 from collaborations c
             where c.fornitore_id = service_presets.fornitore_id
               and c.capostipite_id = auth.uid()
               and c.status = 'ACTIVE')
  or is_admin()
);
create policy "presets_modify" on service_presets for all using (fornitore_id = auth.uid())
  with check (fornitore_id = auth.uid());

-- service_components: ingredienti di una composizione (es. fiori singoli in un bouquet)
create table if not exists service_components (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references services(id) on delete cascade,
  name          varchar(160) not null,
  unit_price    numeric(10,2) not null,
  unit          varchar(40) default 'pz',
  quantity      numeric(10,2) not null default 1,
  notes         text,
  ord           int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_components_service on service_components(service_id);
alter table service_components enable row level security;
create policy "comp_select" on service_components for select using (
  exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())
  or exists (
    select 1 from services s join collaborations c on c.fornitore_id = s.fornitore_id
    where s.id = service_components.service_id and c.capostipite_id = auth.uid() and c.status = 'ACTIVE'
  )
  or is_admin()
);
create policy "comp_modify" on service_components for all using (
  exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())
) with check (
  exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())
);

-- RPC per cancellazione account GDPR
create or replace function request_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then return false; end if;
  update profiles set deletion_requested_at = now() where id = auth.uid();
  return true;
end$$;
grant execute on function request_account_deletion() to authenticated;

-- RPC admin: esegue cancellazione effettiva
create or replace function admin_purge_deletion_requests()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count int := 0;
  rec record;
begin
  if not is_admin() then return 0; end if;
  for rec in
    select id from profiles
    where deletion_requested_at is not null
      and deletion_requested_at < now() - interval '30 days'
  loop
    delete from auth.users where id = rec.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end$$;
grant execute on function admin_purge_deletion_requests() to authenticated;
