-- BRIGATA di ristorazione (cucina/sala/bar/plonge) della location + assegnazione per singolo evento,
-- e RPC fb_event_sheet che assembla il FOGLIO DI SERVIZIO: brigata + piatti del menu + fabbisogno +
-- lotti da prelevare (FEFO) + tavoli. RLS owner-only.

create table if not exists public.fb_brigade_members (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete cascade,
  full_name   text not null,
  role        text not null,                 -- es. "Sous chef", "Capo sala", "Cameriere"
  reparto     text not null default 'CUCINA' check (reparto in ('CUCINA','SALA','BAR','PLONGE')),
  phone       text,
  hourly_cost numeric(8,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_fb_brigade_loc on public.fb_brigade_members(location_id) where active;

create table if not exists public.fb_event_brigade (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete cascade,
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  member_id   uuid not null references public.fb_brigade_members(id) on delete cascade,
  station     text,                          -- postazione: "Antipasti", "Forno", "Rango 1-4"...
  call_time   text,                          -- ora di chiamata
  end_time    text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_fb_event_brigade_entry on public.fb_event_brigade(entry_id);

alter table public.fb_brigade_members enable row level security;
alter table public.fb_event_brigade   enable row level security;
drop policy if exists fb_brigade_owner on public.fb_brigade_members;
create policy fb_brigade_owner on public.fb_brigade_members for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_event_brigade_owner on public.fb_event_brigade;
create policy fb_event_brigade_owner on public.fb_event_brigade for all using (location_id = auth.uid()) with check (location_id = auth.uid());

-- FOGLIO DI SERVIZIO: tutto ciò che serve per l'evento in un unico JSON
create or replace function public.fb_event_sheet(p_entry uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_loc uuid; v_cov int; v_title text; v_date timestamptz; r jsonb;
begin
  select owner_id, coalesce(guest_count, 0), title, date_from into v_loc, v_cov, v_title, v_date
  from public.calendar_entries where id = p_entry;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  -- coperti: dall'evento o dal primo menu agganciato
  if v_cov = 0 then select coalesce(max(covers),0) into v_cov from public.fb_event_menus where entry_id = p_entry; end if;

  return jsonb_build_object(
    'evento', jsonb_build_object('titolo', v_title, 'data', v_date, 'coperti', v_cov,
       'tavoli', ceil(v_cov::numeric / 10), 'coperti_per_tavolo', 10),
    'brigata', coalesce((select jsonb_agg(jsonb_build_object(
         'reparto', m.reparto, 'ruolo', m.role, 'nome', m.full_name,
         'postazione', b.station, 'chiamata', b.call_time, 'fine', b.end_time, 'tel', m.phone)
         order by case m.reparto when 'CUCINA' then 1 when 'SALA' then 2 when 'BAR' then 3 else 4 end, m.role)
       from public.fb_event_brigade b join public.fb_brigade_members m on m.id = b.member_id
       where b.entry_id = p_entry), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(distinct mm.name) from public.fb_event_menus em
       join public.fb_menus mm on mm.id = em.menu_id where em.entry_id = p_entry), '[]'::jsonb),
    'piatti', coalesce((select jsonb_agg(jsonb_build_object('piatto', rc.name,
         'per_coperto', mi.qty_per_cover, 'porzioni', round(mi.qty_per_cover * v_cov)) order by rc.name)
       from public.fb_event_menus em
       join public.fb_menu_items mi on mi.menu_id = em.menu_id
       join public.fb_recipes rc on rc.id = mi.recipe_id
       where em.entry_id = p_entry), '[]'::jsonb),
    'fabbisogno', coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name,
         'qta', round(t.qty), 'unita', i.stock_unit) order by i.name)
       from (select e.ingredient_id, sum(e.qty_stock_unit) qty
             from public.fb_event_menus em
             cross join lateral public.fb_explode_menu(em.menu_id, v_cov::numeric) e
             where em.entry_id = p_entry group by e.ingredient_id) t
       join public.fb_ingredients i on i.id = t.ingredient_id), '[]'::jsonb),
    'magazzino', coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name, 'lotto', l.lot_code,
         'disponibile', l.qty_remaining, 'unita', i.stock_unit, 'scadenza', l.expiry_date) order by i.name, l.expiry_date)
       from public.fb_stock_lots l join public.fb_ingredients i on i.id = l.ingredient_id
       where l.location_id = v_loc and l.qty_remaining > 0
         and l.ingredient_id in (
           select distinct e.ingredient_id from public.fb_event_menus em
           cross join lateral public.fb_explode_menu(em.menu_id, v_cov::numeric) e where em.entry_id = p_entry)), '[]'::jsonb)
  );
end$$;
grant execute on function public.fb_event_sheet(uuid) to authenticated;

-- Seed brigata realistica per la location + assegnazione a tutti i matrimoni confermati
create or replace function public.fb_seed_brigade()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); r record; n int := 0;
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if exists (select 1 from public.fb_brigade_members where location_id = v_loc) then return jsonb_build_object('already', true); end if;

  insert into public.fb_brigade_members(location_id, full_name, role, reparto, phone, hourly_cost)
  select v_loc, d.nome, d.ruolo, d.rep, d.tel, d.cost from (values
    ('Antonio Greco','Executive Chef','CUCINA','347 1100001',22),
    ('Maria Rizzo','Sous Chef','CUCINA','347 1100002',16),
    ('Pietro Mancuso','Chef de partie','CUCINA','347 1100003',13),
    ('Giuseppe Russo','Chef de partie','CUCINA','347 1100004',13),
    ('Lucia Ferraro','Pasticciere','CUCINA','347 1100005',14),
    ('Sara Conti','Commis di cucina','CUCINA','347 1100006',10),
    ('Davide Esposito','Commis di cucina','CUCINA','347 1100007',10),
    ('Rocco Larosa','Maitre / Capo sala','SALA','347 1100008',16),
    ('Elena Bruno','Chef de rang','SALA','347 1100009',12),
    ('Marco Vitale','Chef de rang','SALA','347 1100010',12),
    ('Chiara Galati','Cameriere','SALA','347 1100011',10),
    ('Luca Ferrari','Cameriere','SALA','347 1100012',10),
    ('Anna Romano','Cameriere','SALA','347 1100013',10),
    ('Paolo Costa','Cameriere','SALA','347 1100014',10),
    ('Simone Riva','Barman','BAR','347 1100015',12),
    ('Ahmed Khan','Lavapiatti','PLONGE','347 1100016',9),
    ('Ion Popescu','Lavapiatti','PLONGE','347 1100017',9)
  ) d(nome, ruolo, rep, tel, cost);

  -- assegna l'intera brigata a ogni matrimonio confermato (orari per reparto)
  for r in select id from public.calendar_entries where owner_id = v_loc and status = 'CONFERMATA' loop
    insert into public.fb_event_brigade(location_id, entry_id, member_id, station, call_time, end_time)
    select v_loc, r.id, m.id,
      case m.reparto when 'CUCINA' then 'Cucina' when 'SALA' then 'Sala' when 'BAR' then 'Bar' else 'Lavaggio' end,
      case m.reparto when 'CUCINA' then '14:00' when 'PLONGE' then '15:00' when 'BAR' then '17:30' else '17:00' end,
      '01:00'
    from public.fb_brigade_members m where m.location_id = v_loc;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'eventi_assegnati', n);
end$$;
grant execute on function public.fb_seed_brigade() to authenticated;
