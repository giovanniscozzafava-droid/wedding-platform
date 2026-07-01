-- Selezione PIATTO-PER-PIATTO: la coppia (o la location in demo) vota ogni singolo piatto (1-5)
-- e lo CONFERMA. Il piatto confermato = selezione effettiva → guida food cost / fabbisogno / dispensa.
-- Sostituisce la scelta "menu intero" (fb_member_choose) con la scelta granulare per portata.

-- 1) Voti per singolo piatto (menu_item) ------------------------------------------------
create table if not exists public.fb_dish_votes (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  menu_item_id uuid not null references public.fb_menu_items(id) on delete cascade,
  voter_id     uuid,
  voter_name   text,
  score        int  not null check (score between 1 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (entry_id, menu_item_id, voter_id)
);
alter table public.fb_dish_votes enable row level security;
drop policy if exists fb_dish_votes_read on public.fb_dish_votes;
create policy fb_dish_votes_read on public.fb_dish_votes for select using (
  exists (select 1 from public.calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or public.is_wedding_couple(entry_id) or public.is_admin())));

-- 2) Piatti confermati per l'evento -----------------------------------------------------
create table if not exists public.fb_event_dish (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  menu_item_id uuid not null references public.fb_menu_items(id) on delete cascade,
  confirmed_by uuid,
  confirmed_at timestamptz not null default now(),
  unique (entry_id, menu_item_id)
);
alter table public.fb_event_dish enable row level security;
drop policy if exists fb_event_dish_read on public.fb_event_dish;
create policy fb_event_dish_read on public.fb_event_dish for select using (
  exists (select 1 from public.calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or public.is_wedding_couple(entry_id) or public.is_admin())));

-- 3) RPC: voto piatto (upsert per votante) ---------------------------------------------
create or replace function public.fb_dish_vote(p_entry uuid, p_menu_item_id uuid, p_score int, p_voter text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  if p_score < 1 or p_score > 5 then return jsonb_build_object('error','bad_score'); end if;
  if not exists (select 1 from public.fb_menu_items where id = p_menu_item_id) then
    return jsonb_build_object('error','dish_not_found'); end if;
  insert into public.fb_dish_votes(entry_id, menu_item_id, voter_id, voter_name, score)
    values (p_entry, p_menu_item_id, auth.uid(), p_voter, p_score)
  on conflict (entry_id, menu_item_id, voter_id)
    do update set score = excluded.score, voter_name = coalesce(excluded.voter_name, public.fb_dish_votes.voter_name), updated_at = now();
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_dish_vote(uuid, uuid, int, text) to authenticated;

-- 4) RPC: conferma/annulla piatto (attesta la selezione) --------------------------------
create or replace function public.fb_dish_confirm(p_entry uuid, p_menu_item_id uuid, p_on boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_menu uuid; v_cov int;
begin
  select owner_id, coalesce(guest_count,0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  select menu_id into v_menu from public.fb_menu_items where id = p_menu_item_id;
  if v_menu is null then return jsonb_build_object('error','dish_not_found'); end if;
  if p_on then
    insert into public.fb_event_dish(entry_id, menu_item_id, confirmed_by)
      values (p_entry, p_menu_item_id, auth.uid())
      on conflict (entry_id, menu_item_id) do nothing;
    -- assicura una riga fb_event_menus (i coperti servono al motore food cost / dispensa)
    if v_cov = 0 then select greatest(count(*),1) into v_cov from public.event_guests g
       where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
    if v_cov = 0 then v_cov := 100; end if;
    if not exists (select 1 from public.fb_event_menus where entry_id = p_entry and menu_id = v_menu) then
      insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_owner, p_entry, v_menu, v_cov);
    end if;
  else
    delete from public.fb_event_dish where entry_id = p_entry and menu_item_id = p_menu_item_id;
  end if;
  return jsonb_build_object('ok', true, 'confermato', p_on);
end$$;
grant execute on function public.fb_dish_confirm(uuid, uuid, boolean) to authenticated;

-- 5) Esplosione fabbisogno sui SOLI piatti confermati dell'evento -----------------------
create or replace function public.fb_explode_event(p_entry uuid, p_covers numeric)
returns table (ingredient_id uuid, qty_stock_unit numeric)
language sql stable security invoker set search_path = public as $$
  with recursive expanded as (
    select ri.ingredient_id, ri.subrecipe_id,
           (ri.qty
             * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100
             * mi.qty_per_cover * p_covers
             / nullif(r.yield_qty,0)) as qty
    from public.fb_event_dish ed
    join public.fb_menu_items mi   on mi.id = ed.menu_item_id
    join public.fb_recipes r       on r.id = mi.recipe_id
    join public.fb_recipe_items ri on ri.recipe_id = r.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
    where ed.entry_id = p_entry
    union all
    select ri.ingredient_id, ri.subrecipe_id,
           (e.qty * ri.qty
             * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100
             / nullif(sr.yield_qty,0)) as qty
    from expanded e
    join public.fb_recipes sr      on sr.id = e.subrecipe_id
    join public.fb_recipe_items ri on ri.recipe_id = sr.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
  )
  select ingredient_id, sum(qty)::numeric
  from expanded where ingredient_id is not null
  group by ingredient_id;
$$;

-- 6) Food cost per coperto sui piatti confermati ----------------------------------------
create or replace function public.fb_event_foodcost(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_cov int; v_n int; v_total numeric;
begin
  select owner_id, coalesce(guest_count,0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  if v_cov = 0 then select coalesce(max(covers),0) into v_cov from public.fb_event_menus where entry_id = p_entry; end if;
  if v_cov = 0 then v_cov := 100; end if;
  select count(*) into v_n from public.fb_event_dish where entry_id = p_entry;
  select coalesce(sum(e.qty_stock_unit * coalesce((
            select cv.cost_per_unit from public.fb_ingredient_cost_versions cv
            where cv.ingredient_id = e.ingredient_id and cv.valid_until is null
            order by cv.valid_from desc limit 1), 0)), 0)
    into v_total
    from public.fb_explode_event(p_entry, v_cov::numeric) e;
  return jsonb_build_object('ok', true, 'coperti', v_cov, 'piatti', v_n,
    'total_cost', round(coalesce(v_total,0),2),
    'cost_per_cover', round(coalesce(v_total,0) / nullif(v_cov,0), 2));
end$$;
grant execute on function public.fb_event_foodcost(uuid) to authenticated;

-- 7) Vista scelta: espone menu_item_id, voti e stato "confermato" per singolo piatto -----
create or replace function public.fb_event_choice_view(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_cov int; v_tast record;
begin
  select owner_id, coalesce(guest_count, 0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if v_cov = 0 then select count(*) into v_cov from public.event_guests g where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
  select scheduled_at, sala, status into v_tast from public.fb_tastings where entry_id = p_entry order by created_at desc limit 1;

  return jsonb_build_object('ok', true, 'coperti', v_cov,
    'prova', case when v_tast is null then null else jsonb_build_object('quando', v_tast.scheduled_at, 'sala', v_tast.sala, 'status', v_tast.status) end,
    'proposte', coalesce((
      select jsonb_agg(jsonb_build_object('menu_id', mm.id, 'nome', mm.name, 'scelto', p.is_chosen,
        'piatti', coalesce((
          select jsonb_agg(jsonb_build_object(
              'menu_item_id', mi.id, 'portata', mi.course, 'piatto', rc.name,
              'confermato', exists (select 1 from public.fb_event_dish ed where ed.entry_id = p_entry and ed.menu_item_id = mi.id),
              'voti', (select jsonb_build_object('media', round(avg(dv.score),1), 'n', count(*))
                       from public.fb_dish_votes dv where dv.entry_id = p_entry and dv.menu_item_id = mi.id))
            order by mi.sort_order, rc.name)
          from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id where mi.menu_id = mm.id), '[]'::jsonb))
        order by mm.name)
      from public.fb_menu_proposals p join public.fb_menus mm on mm.id = p.menu_id where p.entry_id = p_entry), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_choice_view(uuid) to authenticated;

-- 8) Foglio servizio/dispensa: usa i PIATTI CONFERMATI se presenti, altrimenti il menu ---
create or replace function public.fb_event_sheet(p_entry uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_loc uuid; v_cov int; v_title text; v_date timestamptz; v_has_dish boolean;
begin
  select owner_id, coalesce(guest_count, 0), title, date_from into v_loc, v_cov, v_title, v_date
  from public.calendar_entries where id = p_entry;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if v_cov = 0 then select coalesce(max(covers),0) into v_cov from public.fb_event_menus where entry_id = p_entry; end if;
  select exists (select 1 from public.fb_event_dish where entry_id = p_entry) into v_has_dish;

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
    'piatti', case when v_has_dish then coalesce((
         select jsonb_agg(jsonb_build_object('piatto', rc.name, 'per_coperto', mi.qty_per_cover,
             'porzioni', round(mi.qty_per_cover * v_cov)) order by mi.course, rc.name)
         from public.fb_event_dish ed
         join public.fb_menu_items mi on mi.id = ed.menu_item_id
         join public.fb_recipes rc on rc.id = mi.recipe_id
         where ed.entry_id = p_entry), '[]'::jsonb)
       else coalesce((select jsonb_agg(jsonb_build_object('piatto', rc.name,
             'per_coperto', mi.qty_per_cover, 'porzioni', round(mi.qty_per_cover * v_cov)) order by rc.name)
         from public.fb_event_menus em
         join public.fb_menu_items mi on mi.menu_id = em.menu_id
         join public.fb_recipes rc on rc.id = mi.recipe_id
         where em.entry_id = p_entry), '[]'::jsonb) end,
    'fabbisogno', case when v_has_dish then coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name,
         'qta', round(t.qty), 'unita', i.stock_unit) order by i.name)
       from (select e.ingredient_id, sum(e.qty_stock_unit) qty
             from public.fb_explode_event(p_entry, v_cov::numeric) e group by e.ingredient_id) t
       join public.fb_ingredients i on i.id = t.ingredient_id), '[]'::jsonb)
       else coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name,
         'qta', round(t.qty), 'unita', i.stock_unit) order by i.name)
       from (select e.ingredient_id, sum(e.qty_stock_unit) qty
             from public.fb_event_menus em
             cross join lateral public.fb_explode_menu(em.menu_id, v_cov::numeric) e
             where em.entry_id = p_entry group by e.ingredient_id) t
       join public.fb_ingredients i on i.id = t.ingredient_id), '[]'::jsonb) end,
    'magazzino', case when v_has_dish then coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name, 'lotto', l.lot_code,
         'disponibile', l.qty_remaining, 'unita', i.stock_unit, 'scadenza', l.expiry_date) order by i.name, l.expiry_date)
       from public.fb_stock_lots l join public.fb_ingredients i on i.id = l.ingredient_id
       where l.location_id = v_loc and l.qty_remaining > 0
         and l.ingredient_id in (select e.ingredient_id from public.fb_explode_event(p_entry, v_cov::numeric) e)), '[]'::jsonb)
       else coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name, 'lotto', l.lot_code,
         'disponibile', l.qty_remaining, 'unita', i.stock_unit, 'scadenza', l.expiry_date) order by i.name, l.expiry_date)
       from public.fb_stock_lots l join public.fb_ingredients i on i.id = l.ingredient_id
       where l.location_id = v_loc and l.qty_remaining > 0
         and l.ingredient_id in (
           select distinct e.ingredient_id from public.fb_event_menus em
           cross join lateral public.fb_explode_menu(em.menu_id, v_cov::numeric) e where em.entry_id = p_entry)), '[]'::jsonb) end
  );
end$$;
