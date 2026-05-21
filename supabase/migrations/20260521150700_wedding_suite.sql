-- ============================================================================
-- Wedding Platform — Suite gestionale completa
--
-- Concept: ogni calendar_entry OPZIONATA/CONFERMATA con quote_id e` un "wedding"
-- e diventa root per timeline, tavoli, invitati, budget, checklist, mood,
-- playlist, contratti, documenti. Tutte le tabelle hanno owner_id = capostipite
-- (RLS strict) + view ridotte per fornitori coinvolti.
-- ============================================================================

-- 1. Estensioni quote_items per preventivo dinamico ---------------------------
alter table quote_items
  add column if not exists is_optional boolean not null default false,
  add column if not exists alternative_group text,
  add column if not exists selected_by_client boolean,
  add column if not exists client_selected_at timestamptz;

-- Trigger: i totali NON includono optional non selezionati
create or replace function quote_items_recalc_lines_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base numeric;
  v_mod jsonb;
  v_type text;
  v_value numeric;
  v_markup_pct numeric;
  v_include boolean;
begin
  v_base := coalesce(new.snapshot_price,0) * coalesce(new.quantity,0);

  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type  := v_mod->>'type';
      v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then v_base := v_base + v_value;
      end if;
    end loop;
  end if;

  -- Se optional non selezionato dal cliente -> escluso dai totali
  v_include := not new.is_optional or coalesce(new.selected_by_client, false);
  if not v_include then v_base := 0; end if;

  new.line_cost := round(v_base, 2);
  v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
  new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);
  return new;
end$$;

drop trigger if exists trg_qitems_recalc_lines on quote_items;
create trigger trg_qitems_recalc_lines
  before insert or update on quote_items
  for each row execute function quote_items_recalc_lines_v2();

-- 2. quote_views: tracking analytics ----------------------------------------
create table if not exists quote_views (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  event_type  text not null check (event_type in ('OPEN','SCROLL','ITEM_FOCUS','ALTERNATIVE_PICK','OPTIONAL_TOGGLE','PDF_DOWNLOAD','ACCEPT','REJECT')),
  payload     jsonb not null default '{}'::jsonb,
  user_agent  text,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_qviews_quote on quote_views(quote_id, created_at desc);

alter table quote_views enable row level security;

create policy "qviews_owner_select" on quote_views for select
  using (exists (select 1 from quotes q where q.id = quote_views.quote_id and q.owner_id = auth.uid()));

create policy "qviews_admin_all" on quote_views for all
  using (is_admin()) with check (is_admin());

-- 3. Contratti ---------------------------------------------------------------
create type contract_status as enum ('BOZZA','INVIATO','FIRMATO','ANNULLATO');

create table if not exists contracts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  entry_id        uuid references calendar_entries(id) on delete set null,
  title           varchar(200) not null,
  client_name     varchar(160),
  client_email    varchar(200),
  client_fiscal_code varchar(32),
  event_date      date,
  total_amount    numeric(12,2) not null default 0,
  status          contract_status not null default 'BOZZA',
  access_token    uuid unique,
  sections        jsonb not null default '[]'::jsonb,
    -- [{ heading, body, type: 'CLAUSULE|PRICE|TERMS' }, ...]
  signed_at       timestamptz,
  signature_data  jsonb,
    -- { name, ip_hash, user_agent, drawn_image_base64? }
  pdf_url         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_contracts_owner on contracts(owner_id, status);
create index if not exists idx_contracts_token on contracts(access_token) where access_token is not null;

create trigger trg_contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

alter table contracts enable row level security;
create policy "contracts_select_owner" on contracts for select using (owner_id = auth.uid());
create policy "contracts_all_admin" on contracts for all using (is_admin()) with check (is_admin());
create policy "contracts_modify_owner" on contracts for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 4. Timeline / scaletta evento ---------------------------------------------
create table if not exists event_timeline (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references calendar_entries(id) on delete cascade,
  ord          int not null default 0,
  start_time   time,
  duration_min int,
  title        varchar(200) not null,
  description  text,
  supplier_id  uuid references profiles(id) on delete set null,
  location     varchar(160),
  is_critical  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_timeline_entry on event_timeline(entry_id, ord);
create trigger trg_timeline_updated_at before update on event_timeline for each row execute function set_updated_at();

alter table event_timeline enable row level security;
create policy "timeline_select_owner_or_part" on event_timeline for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "timeline_modify_owner" on event_timeline for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 5. Tavoli + invitati -------------------------------------------------------
create type rsvp_status as enum ('PENDING','YES','NO','MAYBE');

create table if not exists event_tables (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  table_no    int not null,
  label       varchar(80),
  seats       int not null default 8,
  shape       text not null default 'ROUND' check (shape in ('ROUND','SQUARE','RECT','HEAD')),
  pos_x       int,
  pos_y       int,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tables_entry on event_tables(entry_id);

alter table event_tables enable row level security;
create policy "tables_select_owner_or_part" on event_tables for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "tables_modify_owner" on event_tables for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

create table if not exists event_guests (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  full_name       varchar(160) not null,
  email           varchar(200),
  phone           varchar(40),
  party_size      int not null default 1,
  rsvp            rsvp_status not null default 'PENDING',
  diet            varchar(120), -- vegano, gluten-free, allergie
  notes           text,
  table_id        uuid references event_tables(id) on delete set null,
  seat_no         int,
  side            text check (side in ('SPOSA','SPOSO','ENTRAMBI')),
  group_label     varchar(80), -- "famiglia sposa", "amici lavoro", ecc.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_guests_entry on event_guests(entry_id);
create index if not exists idx_guests_table on event_guests(table_id) where table_id is not null;
create trigger trg_guests_updated_at before update on event_guests for each row execute function set_updated_at();

alter table event_guests enable row level security;
create policy "guests_select_owner_or_part" on event_guests for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "guests_modify_owner" on event_guests for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 6. Budget tracker -----------------------------------------------------------
create table if not exists budget_categories (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  name        varchar(120) not null,
  planned_amount numeric(12,2) not null default 0,
  color       varchar(7),
  ord         int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_budget_cat_entry on budget_categories(entry_id, ord);

create table if not exists budget_entries (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references budget_categories(id) on delete cascade,
  entry_id     uuid not null references calendar_entries(id) on delete cascade,
  description  varchar(200) not null,
  amount       numeric(12,2) not null,
  paid         boolean not null default false,
  paid_at      date,
  supplier_id  uuid references profiles(id) on delete set null,
  receipt_url  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_budget_e_cat on budget_entries(category_id);
create index if not exists idx_budget_e_entry on budget_entries(entry_id);

alter table budget_categories enable row level security;
alter table budget_entries enable row level security;
create policy "budgetc_select_owner" on budget_categories for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or is_admin()
);
create policy "budgetc_modify_owner" on budget_categories for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);
create policy "budgete_select_owner" on budget_entries for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or is_admin()
);
create policy "budgete_modify_owner" on budget_entries for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 7. Checklist matrimonio ---------------------------------------------------
create table if not exists wedding_tasks (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  phase       text not null default 'GENERICA',
    -- '12_MESI', '6_MESI', '3_MESI', '1_MESE', '1_SETTIMANA', 'DAY_OF', 'GENERICA'
  title       varchar(200) not null,
  description text,
  due_at      date,
  done        boolean not null default false,
  done_at     timestamptz,
  ord         int not null default 0,
  supplier_id uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tasks_entry on wedding_tasks(entry_id, phase, ord);
create trigger trg_tasks_updated_at before update on wedding_tasks for each row execute function set_updated_at();

alter table wedding_tasks enable row level security;
create policy "tasks_select_owner_or_part" on wedding_tasks for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "tasks_modify_owner" on wedding_tasks for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 8. Mood board --------------------------------------------------------------
create table if not exists mood_images (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  url         text not null,
  source      text default 'pexels',
  caption     varchar(200),
  tag         varchar(40), -- 'vestito','fiori','location','torta','allestimento','altro'
  ord         int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mood_entry on mood_images(entry_id, ord);

alter table mood_images enable row level security;
create policy "mood_select_owner" on mood_images for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or is_admin()
);
create policy "mood_modify_owner" on mood_images for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 9. Playlist musica ---------------------------------------------------------
create table if not exists event_playlist (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  moment      text not null check (moment in ('CERIMONIA','APERITIVO','CENA','TAGLIO_TORTA','PRIMA_DANZA','FESTA')),
  song_title  varchar(200) not null,
  artist      varchar(160),
  notes       text,
  ord         int not null default 0,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_playlist_entry on event_playlist(entry_id, moment, ord);

alter table event_playlist enable row level security;
create policy "playlist_select_owner_or_part" on event_playlist for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "playlist_modify_owner" on event_playlist for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 10. Documents vault --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-documents','event-documents', false, 20971520)  -- 20MB privato
on conflict (id) do nothing;

create table if not exists event_documents (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  kind        text not null default 'OTHER',
    -- 'CONTRATTO','FATTURA','RICEVUTA','PERMESSO','LIBERATORIA','OTHER'
  name        varchar(200) not null,
  storage_path text not null,
  size_bytes  bigint,
  mime        text,
  uploaded_by uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_docs_entry on event_documents(entry_id, kind);

alter table event_documents enable row level security;
create policy "docs_select_owner" on event_documents for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or is_admin()
);
create policy "docs_modify_owner" on event_documents for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Storage policy event-documents: owner cap. su path {entry_id}/{file}
drop policy if exists "event-docs read owner" on storage.objects;
create policy "event-docs read owner" on storage.objects for select using (
  bucket_id = 'event-documents' and exists (
    select 1 from calendar_entries ce
    where ce.id::text = split_part(name, '/', 1)
      and ce.owner_id = auth.uid()
  )
);
drop policy if exists "event-docs write owner" on storage.objects;
create policy "event-docs write owner" on storage.objects for insert with check (
  bucket_id = 'event-documents' and exists (
    select 1 from calendar_entries ce
    where ce.id::text = split_part(name, '/', 1)
      and ce.owner_id = auth.uid()
  )
);
drop policy if exists "event-docs delete owner" on storage.objects;
create policy "event-docs delete owner" on storage.objects for delete using (
  bucket_id = 'event-documents' and exists (
    select 1 from calendar_entries ce
    where ce.id::text = split_part(name, '/', 1)
      and ce.owner_id = auth.uid()
  )
);

-- 11. RPC pubblica per preview dinamica (incluso analytics) -----------------
create or replace function quote_track_event(p_token uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_quote_id uuid;
begin
  select id into v_quote_id from quotes where access_token = p_token;
  if v_quote_id is null then return; end if;
  insert into quote_views (quote_id, event_type, payload)
  values (v_quote_id, upper(p_event), coalesce(p_payload, '{}'::jsonb));
end$$;

revoke all on function quote_track_event(uuid, text, jsonb) from public;
grant execute on function quote_track_event(uuid, text, jsonb) to anon, authenticated;

-- Cliente seleziona/deseleziona voce opzionale
create or replace function quote_toggle_option(p_token uuid, p_item_id uuid, p_selected boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  -- Verifica che item appartenga al quote indicato dal token
  select qi.id into v_id
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and qi.id = p_item_id
     and qi.is_optional = true;
  if v_id is null then return false; end if;

  update quote_items
     set selected_by_client = p_selected,
         client_selected_at = case when p_selected then now() else null end
   where id = v_id;

  insert into quote_views (quote_id, event_type, payload)
  select q.id, 'OPTIONAL_TOGGLE', jsonb_build_object('item_id', p_item_id, 'selected', p_selected)
  from quotes q where q.access_token = p_token;
  return true;
end$$;
revoke all on function quote_toggle_option(uuid, uuid, boolean) from public;
grant execute on function quote_toggle_option(uuid, uuid, boolean) to anon, authenticated;

-- Cliente sceglie un'alternativa (radio group)
create or replace function quote_pick_alternative(p_token uuid, p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qid uuid;
  v_group text;
begin
  select qi.quote_id, qi.alternative_group
    into v_qid, v_group
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and qi.id = p_item_id
     and qi.alternative_group is not null;
  if v_qid is null then return false; end if;

  -- Deseleziona altre del gruppo
  update quote_items
     set selected_by_client = false
   where quote_id = v_qid
     and alternative_group = v_group;

  -- Seleziona target
  update quote_items
     set selected_by_client = true,
         client_selected_at = now()
   where id = p_item_id;

  insert into quote_views (quote_id, event_type, payload)
  values (v_qid, 'ALTERNATIVE_PICK', jsonb_build_object('item_id', p_item_id, 'group', v_group));
  return true;
end$$;
revoke all on function quote_pick_alternative(uuid, uuid) from public;
grant execute on function quote_pick_alternative(uuid, uuid) to anon, authenticated;

-- Extension public RPC: ritorna anche items opzionali e alternative_group
create or replace function quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
begin
  select * into v_quote from quotes where access_token = p_token;
  if v_quote.id is null then return null; end if;

  select jsonb_agg(
           jsonb_build_object(
             'id', qi.id,
             'name_snapshot', qi.name_snapshot,
             'description_snapshot', qi.description_snapshot,
             'quantity', qi.quantity,
             'unit_snapshot', qi.unit_snapshot,
             'snapshot_price', qi.snapshot_price,
             'line_client', qi.line_client,
             'is_optional', qi.is_optional,
             'alternative_group', qi.alternative_group,
             'selected_by_client', qi.selected_by_client,
             'sort_order', qi.sort_order
           ) order by qi.sort_order
         )
    into v_items
    from quote_items qi where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',             v_quote.id,
    'title',          v_quote.title,
    'client_name',    v_quote.client_name,
    'event_date',     v_quote.event_date,
    'guest_count',    v_quote.guest_count,
    'status',         v_quote.status,
    'revision',       v_quote.revision,
    'total_client',   v_quote.total_client,
    'pdf_url',        v_quote.pdf_url,
    'pdf_variant',    v_quote.pdf_variant,
    'owner',          to_jsonb(v_owner),
    'items',          coalesce(v_items, '[]'::jsonb)
  );
end$$;

-- RPC pubblica contratti: lettura + firma
create or replace function contract_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c contracts%rowtype;
  v_owner record;
begin
  select * into v_c from contracts where access_token = p_token;
  if v_c.id is null then return null; end if;
  select full_name, business_name, brand_logo_url, brand_primary_color
    into v_owner from profiles where id = v_c.owner_id;
  return jsonb_build_object(
    'id', v_c.id, 'title', v_c.title, 'client_name', v_c.client_name,
    'client_email', v_c.client_email, 'event_date', v_c.event_date,
    'total_amount', v_c.total_amount, 'status', v_c.status,
    'sections', v_c.sections, 'signed_at', v_c.signed_at,
    'owner', to_jsonb(v_owner)
  );
end$$;
revoke all on function contract_get_by_token(uuid) from public;
grant execute on function contract_get_by_token(uuid) to anon, authenticated;

create or replace function contract_sign_by_token(p_token uuid, p_signer_name text, p_signer_fiscal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         signature_data = jsonb_build_object(
            'name', p_signer_name,
            'fiscal_code', p_signer_fiscal,
            'at', now()
         )
   where access_token = p_token
     and status in ('INVIATO','FIRMATO')
   returning id into v_id;
  return v_id is not null;
end$$;
revoke all on function contract_sign_by_token(uuid, text, text) from public;
grant execute on function contract_sign_by_token(uuid, text, text) to anon, authenticated;
