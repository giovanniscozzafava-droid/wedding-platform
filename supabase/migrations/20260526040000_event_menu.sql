-- ============================================================================
-- EVENT MENU — gestione menu matrimonio (antipasti, primi, secondi, dolci,
-- bevande, ecc.) editabile da WP e LOCATION (le location gestiscono spesso
-- catering in-house). Coppia legge in sola-lettura, può suggerire modifiche
-- via couple_change_requests.
--
-- Allergeni: lista UE 14 allergeni alimentari obbligatori (Reg. 1169/2011).
-- Diete: tag liberi (vegano, vegetariano, celiaco, kosher, halal, no_lattosio).
-- ============================================================================

create type menu_section_kind as enum (
  'BENVENUTO',
  'ANTIPASTO',
  'PRIMO',
  'SECONDO',
  'CONTORNO',
  'FRUTTA',
  'DOLCE',
  'TORTA',
  'CAFFE',
  'BEVANDA',
  'OPEN_BAR',
  'CONFETTATA'
);

create table if not exists event_menu (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  section         menu_section_kind not null,
  ord             int not null default 0,
  title           varchar(180) not null,
  description     text,
  dietary_tags    text[] not null default '{}',
  allergens       text[] not null default '{}',
  supplier_id     uuid references profiles(id) on delete set null,
  price_per_guest numeric(8,2),
  notes           text,
  is_optional     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_event_menu_entry on event_menu(entry_id, section, ord);
create index if not exists idx_event_menu_supplier on event_menu(supplier_id) where supplier_id is not null;

create trigger trg_event_menu_updated_at before update on event_menu
  for each row execute function set_updated_at();

alter table event_menu enable row level security;

drop policy if exists "menu_modify_owner" on event_menu;
create policy "menu_modify_owner" on event_menu for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

drop policy if exists "menu_select_couple" on event_menu;
create policy "menu_select_couple" on event_menu for select using (
  is_wedding_couple(entry_id)
);

drop policy if exists "menu_select_supplier" on event_menu;
create policy "menu_select_supplier" on event_menu for select using (
  supplier_id = auth.uid()
);

drop policy if exists "menu_admin_all" on event_menu;
create policy "menu_admin_all" on event_menu for all using (is_admin()) with check (is_admin());

-- Couple change request entity: aggiungi MENU all'enum
do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'change_request_entity' and e.enumlabel = 'MENU'
  ) then
    alter type change_request_entity add value 'MENU';
  end if;
end$$;

comment on table event_menu is
  'Menu matrimonio modificabile da WP/LOCATION owner. Coppia read-only + CR. Fornitore catering vede solo proprie voci. Allergeni Reg. UE 1169/2011.';
