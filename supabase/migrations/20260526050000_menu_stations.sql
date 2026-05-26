-- ============================================================================
-- MENU STATIONS — estensione enum menu_section_kind per coprire isole/buffet/
-- carrelli tipici dei matrimoni italiani + tabella menu_presets con catalogo
-- di stazioni standard che WP/Location possono importare nel menu di un wedding.
-- ============================================================================

-- 1. ADD VALUE all'enum menu_section_kind ----------------------------------
do $$
declare
  v_kind text;
  new_values text[] := array[
    'ISOLA_BENVENUTO',       -- isola di benvenuto, finger food, taralli
    'ISOLA_PRECENA',         -- buffet pre-cena con isole tematiche
    'ISOLA_DOPOCENA',        -- isole dei dolci, frutta, ecc.
    'ISOLA_SALUMI',          -- prosciutto, salame, formaggi
    'ISOLA_FRITTI',          -- pizzaiolo, arancini, panzerotti
    'ISOLA_PIZZA',           -- pizza al taglio o forno
    'ISOLA_PESCE_CRUDO',     -- crudo di mare, ostriche, sushi
    'ISOLA_PASTA_LIVE',      -- pasta fresca tirata al momento
    'ISOLA_FORMAGGI',        -- selezione formaggi DOP
    'ISOLA_DOLCI',           -- pasticceria, mignon, gelati
    'ISOLA_FRUTTA',          -- frutta caramellata, esotica
    'ISOLA_CIOCCOLATO',      -- fontana, cioccolatini, pralineria
    'SHOW_COOKING',          -- chef in postazione (tagliata, risotto al parmigiano)
    'CARRELLO_DISTILLATI',   -- carrello whisky/grappe/cognac
    'CARRELLO_SIGARI',
    'CARRELLO_GIN_TONIC',    -- gin tonic station
    'CARRELLO_CAFFE_SPECIAL' -- caffè con liquori, moka, espresso
  ];
begin
  foreach v_kind in array new_values loop
    if not exists (
      select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
       where t.typname = 'menu_section_kind' and e.enumlabel = v_kind
    ) then
      execute format('alter type menu_section_kind add value %L', v_kind);
    end if;
  end loop;
end$$;

-- 2. menu_presets: catalogo stazioni standard riusabili ---------------------
create table if not exists menu_presets (
  id              uuid primary key default gen_random_uuid(),
  section         menu_section_kind not null,
  title           varchar(180) not null,
  description     text,
  dietary_tags    text[] not null default '{}',
  allergens       text[] not null default '{}',
  typical_price_per_guest numeric(8,2),
  notes           text,
  is_active       boolean not null default true,
  region          varchar(40),
    -- 'italia', 'sud', 'centro', 'nord', 'sicilia', 'puglia' — filtraggio
  created_at      timestamptz not null default now()
);

create index if not exists idx_menu_presets_section on menu_presets(section) where is_active = true;

alter table menu_presets enable row level security;

-- Tutti gli autenticati possono leggere il catalogo
drop policy if exists "menu_presets_read_all" on menu_presets;
create policy "menu_presets_read_all" on menu_presets for select to authenticated using (is_active = true);

-- Solo admin scrive
drop policy if exists "menu_presets_admin_write" on menu_presets;
create policy "menu_presets_admin_write" on menu_presets for all using (is_admin()) with check (is_admin());
