-- FASE — CANTINA bottiglie con regola "1 bottiglia ogni N coperti". Catalogo bevande per location,
-- piano bottiglie per evento (bottiglie = ceil(coperti / coperti_per_bottiglia)), giacenza cantina,
-- bottiglie da comprare (integra la spesa) e scarico cantina a evento. Generico multi-tenant (RLS owner-only).

-- ── Catalogo bevande della location ───────────────────────────────────────
create table if not exists public.fb_cantina (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references public.profiles(id) on delete restrict,
  name              text not null,
  category          text not null default 'ROSSO'
                      check (category in ('BOLLICINE','BIANCO','ROSSO','ROSATO','ACQUA','BIRRA','AMARO','ANALCOLICO')),
  bottle_ml         int  not null default 750,
  cost_per_bottle   numeric(10,2) not null default 0,
  covers_per_bottle numeric(6,2) not null default 3 check (covers_per_bottle > 0), -- 1 bottiglia ogni N coperti
  stock_bottles     int  not null default 0,                                       -- giacenza cantina
  is_default        boolean not null default true,                                 -- entra in ogni evento
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_fb_cantina_loc on public.fb_cantina(location_id) where is_active;
alter table public.fb_cantina enable row level security;
drop policy if exists fb_cantina_owner on public.fb_cantina;
create policy fb_cantina_owner on public.fb_cantina for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_cantina_admin on public.fb_cantina;
create policy fb_cantina_admin on public.fb_cantina for select using (public.is_admin());
drop trigger if exists trg_fb_cantina_upd on public.fb_cantina;
create trigger trg_fb_cantina_upd before update on public.fb_cantina for each row execute function public.set_updated_at();

-- ── Assegnazione/override per evento (opzionale: senza righe → usa la cantina di default) ──
create table if not exists public.fb_event_cantina (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references public.profiles(id) on delete restrict,
  entry_id          uuid not null references public.calendar_entries(id) on delete cascade,
  cantina_id        uuid not null references public.fb_cantina(id) on delete cascade,
  covers_per_bottle numeric(6,2),  -- override regola per l'evento
  covers_override   int,           -- coperti bevande specifici (null = coperti evento)
  unique (entry_id, cantina_id)
);
alter table public.fb_event_cantina enable row level security;
drop policy if exists fb_event_cantina_owner on public.fb_event_cantina;
create policy fb_event_cantina_owner on public.fb_event_cantina for all using (location_id = auth.uid()) with check (location_id = auth.uid());

-- ── Scarico cantina a evento (idempotente) ─────────────────────────────────
create table if not exists public.fb_cantina_consumption (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.profiles(id) on delete restrict,
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  cantina_id   uuid not null references public.fb_cantina(id) on delete cascade,
  bottles      int not null,
  consumed_at  timestamptz not null default now(),
  unique (entry_id, cantina_id)
);
alter table public.fb_cantina_consumption enable row level security;
drop policy if exists fb_cantina_consumption_owner on public.fb_cantina_consumption;
create policy fb_cantina_consumption_owner on public.fb_cantina_consumption for all using (location_id = auth.uid()) with check (location_id = auth.uid());

-- ── Coperti "beve": guest_count → covers OSPITI → invitati YES non-INFANT ───
create or replace function public.fb_drinking_covers(p_entry uuid)
returns int language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce((select nullif(guest_count,0) from public.calendar_entries where id = p_entry), 0),
    coalesce((select max(covers) filter (where role='OSPITI') from public.fb_event_menus where entry_id = p_entry), 0),
    coalesce((select count(*) from public.event_guests g where g.entry_id = p_entry and g.rsvp='YES' and g.age_group<>'INFANT'), 0)
  )::int;
$$;

-- ── Piano cantina dell'evento: bottiglie, giacenza, da comprare, costi ──────
create or replace function public.fb_event_cantina_plan(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_cov int;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  v_cov := public.fb_drinking_covers(p_entry);
  return jsonb_build_object('ok', true, 'coperti', v_cov, 'righe', coalesce((
    select jsonb_agg(jsonb_build_object(
        'cantina_id', c.id, 'nome', c.name, 'categoria', c.category, 'bottle_ml', c.bottle_ml,
        'coperti_per_bottiglia', v.cpb, 'bottiglie', b.bottles, 'giacenza', c.stock_bottles,
        'da_comprare', greatest(0, b.bottles - c.stock_bottles),
        'costo_bottiglia', c.cost_per_bottle,
        'costo_totale', round(b.bottles * c.cost_per_bottle, 2),
        'costo_acquisto', round(greatest(0, b.bottles - c.stock_bottles) * c.cost_per_bottle, 2))
      order by case c.category when 'BOLLICINE' then 1 when 'BIANCO' then 2 when 'ROSATO' then 3 when 'ROSSO' then 4
                               when 'BIRRA' then 5 when 'AMARO' then 6 when 'ACQUA' then 7 else 8 end, c.name)
    from public.fb_cantina c
    left join public.fb_event_cantina ec on ec.cantina_id = c.id and ec.entry_id = p_entry
    cross join lateral (select coalesce(ec.covers_per_bottle, c.covers_per_bottle) as cpb,
                               coalesce(ec.covers_override, v_cov) as cov) v
    cross join lateral (select ceil(v.cov::numeric / nullif(v.cpb, 0))::int as bottles) b
    where c.location_id = v_owner and c.is_active and (
      (exists (select 1 from public.fb_event_cantina e2 where e2.entry_id = p_entry) and ec.id is not null)
      or (not exists (select 1 from public.fb_event_cantina e2 where e2.entry_id = p_entry) and c.is_default)
    )), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_cantina_plan(uuid) to authenticated;

-- ── Scarico cantina (decrementa giacenza, idempotente per evento) ──────────
create or replace function public.fb_cantina_consume_event(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cov int; r record; n int := 0;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  v_cov := public.fb_drinking_covers(p_entry);
  for r in
    select c.id as cantina_id,
      ceil(coalesce(ec.covers_override, v_cov)::numeric / nullif(coalesce(ec.covers_per_bottle, c.covers_per_bottle), 0))::int as bottles
    from public.fb_cantina c
    left join public.fb_event_cantina ec on ec.cantina_id = c.id and ec.entry_id = p_entry
    where c.location_id = v_owner and c.is_active and (
      (exists (select 1 from public.fb_event_cantina e2 where e2.entry_id = p_entry) and ec.id is not null)
      or (not exists (select 1 from public.fb_event_cantina e2 where e2.entry_id = p_entry) and c.is_default))
  loop
    insert into public.fb_cantina_consumption(location_id, entry_id, cantina_id, bottles)
      values (v_owner, p_entry, r.cantina_id, r.bottles)
      on conflict (entry_id, cantina_id) do nothing;
    if found then
      update public.fb_cantina set stock_bottles = stock_bottles - r.bottles where id = r.cantina_id;
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'bevande_scaricate', n);
end$$;
grant execute on function public.fb_cantina_consume_event(uuid) to authenticated;

-- ── Demo cantina gourmet per La Baronella (beta) ───────────────────────────
insert into public.fb_cantina(location_id, name, category, bottle_ml, cost_per_bottle, covers_per_bottle, stock_bottles, is_default)
select 'c117d389-0626-4a9e-8dd4-b2751902df27'::uuid, d.n, d.c, d.ml, d.cost, d.cpb, d.stock, true
from (values
  ('Franciacorta Metodo Classico Brut','BOLLICINE',750,14.0,6,24),
  ('Cirò Bianco DOC','BIANCO',750,7.5,3,48),
  ('Cirò Rosso DOC Riserva','ROSSO',750,9.0,3,48),
  ('Greco di Bianco passito','BIANCO',500,16.0,15,8),
  ('Acqua minerale (naturale e frizzante)','ACQUA',750,0.5,1.5,150),
  ('Birra artigianale calabrese','BIRRA',330,2.2,8,40),
  ('Amaro del Capo','AMARO',700,10.0,20,6)
) d(n,c,ml,cost,cpb,stock)
where not exists (select 1 from public.fb_cantina x where x.location_id = 'c117d389-0626-4a9e-8dd4-b2751902df27' and x.name = d.n);
