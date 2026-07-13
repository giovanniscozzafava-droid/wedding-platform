-- F&B "Scelte" v4 (DEFINITIVO): la coppia compone IL menù dell'evento scegliendo tra le
-- alternative per portata del paniere stagionale. Nessun voto degli invitati.
--   WI-S0 · snapshot del menù confermato (il menù non muta se lo chef ritocca la ricetta dopo)
--   WI-S1 · vincoli per portata (min/max), scarti testa-a-testa, "Genera menù" per la stampa
-- La cascata esistente (esplosione/food cost/dispensa/ordini) resta invariata sulle ricette VIVE.

-- ============ WI-S0 · SNAPSHOT =========================================================
alter table public.fb_menu_items add column if not exists photo_url text;
alter table public.fb_event_dish add column if not exists snapshot jsonb;

-- food cost a coperto di UN singolo piatto (qty_per_cover incluso), a costi CORRENTI
create or replace function public.fb_menu_item_cost(p_menu_item_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  with recursive expanded as (
    select ri.ingredient_id, ri.subrecipe_id,
           (ri.qty * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100 * mi.qty_per_cover / nullif(r.yield_qty,0)) as qty
    from public.fb_menu_items mi
    join public.fb_recipes r       on r.id = mi.recipe_id
    join public.fb_recipe_items ri on ri.recipe_id = r.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
    where mi.id = p_menu_item_id
    union all
    select ri.ingredient_id, ri.subrecipe_id,
           (e.qty * ri.qty * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100 / nullif(sr.yield_qty,0))
    from expanded e
    join public.fb_recipes sr      on sr.id = e.subrecipe_id
    join public.fb_recipe_items ri on ri.recipe_id = sr.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
  )
  select round(coalesce(sum(qty * coalesce((
            select cv.cost_per_unit from public.fb_ingredient_cost_versions cv
            where cv.ingredient_id = expanded.ingredient_id and cv.valid_until is null
            order by cv.valid_from desc limit 1), 0)), 0), 4)
  from expanded where ingredient_id is not null;
$$;
grant execute on function public.fb_menu_item_cost(uuid) to authenticated;

-- snapshot immutabile del piatto al momento della conferma: nome, portata, descrizione,
-- composizione (ingredienti diretti) e food cost a quella data.
create or replace function public.fb_menu_item_snapshot(p_menu_item_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'menu_item_id', mi.id,
    'nome', rc.name,
    'portata', mi.course,
    'descrizione', rc.notes,
    'foto', mi.photo_url,
    'food_cost', public.fb_menu_item_cost(mi.id),
    'composizione', coalesce((
       select jsonb_agg(jsonb_build_object('ingrediente', ing.name, 'qta', ri.qty, 'unita', ing.stock_unit) order by ing.name)
       from public.fb_recipe_items ri join public.fb_ingredients ing on ing.id = ri.ingredient_id
       where ri.recipe_id = mi.recipe_id and ri.ingredient_id is not null), '[]'::jsonb),
    'at', now()
  )
  from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id
  where mi.id = p_menu_item_id;
$$;
grant execute on function public.fb_menu_item_snapshot(uuid) to authenticated;

-- ============ WI-S1 · VINCOLI PORTATA + SCARTI =========================================
-- Vincoli per portata sul menù/paniere (es. ANTIPASTO min 2 max 3, PRIMO 1/1).
create table if not exists public.fb_menu_courses (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references public.fb_menus(id) on delete cascade,
  course     text not null,
  min_select int  not null default 1,
  max_select int  not null default 1,
  unique (menu_id, course)
);
alter table public.fb_menu_courses enable row level security;
drop policy if exists fb_menu_courses_all on public.fb_menu_courses;
create policy fb_menu_courses_all on public.fb_menu_courses for all
  using (exists (select 1 from public.fb_menus mm where mm.id = menu_id and (mm.location_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.fb_menus mm where mm.id = menu_id and (mm.location_id = auth.uid() or public.is_admin())));

create or replace function public.fb_menu_course_set(p_menu_id uuid, p_course text, p_min int, p_max int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  select location_id into v_loc from public.fb_menus where id = p_menu_id;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_loc = auth.uid() or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if p_course not in ('APERITIVO','ANTIPASTO','PRIMO','SECONDO','CONTORNO','DOLCE','FRUTTA','BEVANDE') then
    return jsonb_build_object('error','bad_course'); end if;
  insert into public.fb_menu_courses(menu_id, course, min_select, max_select)
    values (p_menu_id, p_course, greatest(0, coalesce(p_min,1)), greatest(1, coalesce(p_max,1)))
  on conflict (menu_id, course) do update set min_select = excluded.min_select, max_select = excluded.max_select;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_menu_course_set(uuid, text, int, int) to authenticated;

-- Scelte SCARTATE (per le statistiche testa-a-testa): quando una scelta ne sostituisce
-- un'altra nella stessa portata, la scartata resta registrata con chosen_instead.
create table if not exists public.fb_dish_passed_over (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references public.calendar_entries(id) on delete cascade,
  menu_item_id   uuid not null references public.fb_menu_items(id) on delete cascade,
  chosen_instead uuid references public.fb_menu_items(id) on delete set null,
  created_at     timestamptz not null default now()
);
alter table public.fb_dish_passed_over enable row level security;
drop policy if exists fb_passed_over_read on public.fb_dish_passed_over;
create policy fb_passed_over_read on public.fb_dish_passed_over for select using (
  exists (select 1 from public.calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or public.is_wedding_couple(entry_id) or public.is_admin())));

-- ============ RPC conferma v4: snapshot + vincolo max per portata + scarti =============
create or replace function public.fb_dish_confirm(p_entry uuid, p_menu_item_id uuid, p_on boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_menu uuid; v_cov int; v_course text; v_max int; v_victims uuid[];
begin
  select owner_id, coalesce(guest_count,0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  select menu_id, course into v_menu, v_course from public.fb_menu_items where id = p_menu_item_id;
  if v_menu is null then return jsonb_build_object('error','dish_not_found'); end if;
  if p_on then
    -- conferma con SNAPSHOT immutabile (mantiene lo snapshot già esistente in caso di ri-conferma)
    insert into public.fb_event_dish(entry_id, menu_item_id, confirmed_by, snapshot)
      values (p_entry, p_menu_item_id, auth.uid(), public.fb_menu_item_snapshot(p_menu_item_id))
      on conflict (entry_id, menu_item_id) do update
        set confirmed_by = excluded.confirmed_by,
            snapshot = coalesce(public.fb_event_dish.snapshot, excluded.snapshot);
    -- vincolo MAX per portata: se si supera il max, sostituisce le scelte più vecchie (registrate come scarti)
    select coalesce(max_select, 1) into v_max from public.fb_menu_courses where menu_id = v_menu and course = v_course;
    if v_max is null then v_max := 1; end if;
    select array_agg(mi2) into v_victims from (
      select ed.menu_item_id as mi2 from public.fb_event_dish ed
      join public.fb_menu_items mi on mi.id = ed.menu_item_id
      where ed.entry_id = p_entry and mi.menu_id = v_menu and mi.course = v_course and ed.menu_item_id <> p_menu_item_id
      order by ed.confirmed_at desc offset greatest(v_max - 1, 0)) t;
    if v_victims is not null and array_length(v_victims, 1) > 0 then
      insert into public.fb_dish_passed_over(entry_id, menu_item_id, chosen_instead)
        select p_entry, unnest(v_victims), p_menu_item_id;
      delete from public.fb_event_dish where entry_id = p_entry and menu_item_id = any(v_victims);
    end if;
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

-- ============ Vista scelta v4: descrizione, foto, costo, vincoli per portata ===========
create or replace function public.fb_event_choice_view(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_cov int; v_month int; v_tast record;
begin
  select owner_id, coalesce(guest_count, 0), coalesce(extract(month from date_from)::int, 0)
    into v_owner, v_cov, v_month from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if v_cov = 0 then select count(*) into v_cov from public.event_guests g where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
  select scheduled_at, sala, status into v_tast from public.fb_tastings where entry_id = p_entry order by created_at desc limit 1;

  return jsonb_build_object('ok', true, 'coperti', v_cov, 'mese_evento', nullif(v_month,0),
    'prova', case when v_tast is null then null else jsonb_build_object('quando', v_tast.scheduled_at, 'sala', v_tast.sala, 'status', v_tast.status) end,
    'proposte', coalesce((
      select jsonb_agg(jsonb_build_object('menu_id', mm.id, 'nome', mm.name, 'scelto', p.is_chosen,
        'vincoli', coalesce((select jsonb_object_agg(mc.course, jsonb_build_object('min', mc.min_select, 'max', mc.max_select))
                             from public.fb_menu_courses mc where mc.menu_id = mm.id), '{}'::jsonb),
        'piatti', coalesce((
          select jsonb_agg(jsonb_build_object(
              'menu_item_id', mi.id, 'portata', mi.course, 'piatto', rc.name,
              'descrizione', rc.notes, 'foto', mi.photo_url, 'costo', public.fb_menu_item_cost(mi.id),
              'confermato', exists (select 1 from public.fb_event_dish ed where ed.entry_id = p_entry and ed.menu_item_id = mi.id),
              'season', case when mi.season_from is null then null else jsonb_build_object('from', mi.season_from, 'to', mi.season_to) end,
              'disponibile', (mi.season_from is null or v_month = 0 or
                case when mi.season_from <= mi.season_to then v_month between mi.season_from and mi.season_to
                     else (v_month >= mi.season_from or v_month <= mi.season_to) end),
              'voti', (select jsonb_build_object('media', round(avg(dv.score),1), 'n', count(*))
                       from public.fb_dish_votes dv where dv.entry_id = p_entry and dv.menu_item_id = mi.id))
            order by mi.sort_order, rc.name)
          from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id where mi.menu_id = mm.id), '[]'::jsonb))
        order by mm.name)
      from public.fb_menu_proposals p join public.fb_menus mm on mm.id = p.menu_id where p.entry_id = p_entry), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_choice_view(uuid) to authenticated;

-- ============ Menù finale (snapshot) + divergenza ricetta viva ↔ snapshot ==============
create or replace function public.fb_event_menu_final(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  return jsonb_build_object('ok', true, 'piatti', coalesce((
    select jsonb_agg(jsonb_build_object(
        'menu_item_id', ed.menu_item_id,
        'portata', coalesce(ed.snapshot->>'portata', mi.course),
        'nome', coalesce(ed.snapshot->>'nome', rc.name),
        'descrizione', coalesce(ed.snapshot->>'descrizione', rc.notes),
        'food_cost_snapshot', nullif(ed.snapshot->>'food_cost','')::numeric,
        'nome_vivo', rc.name,
        'food_cost_vivo', public.fb_menu_item_cost(ed.menu_item_id),
        'diverge', (ed.snapshot is not null and (
                     (ed.snapshot->>'nome') is distinct from rc.name
                     or round(coalesce(nullif(ed.snapshot->>'food_cost','')::numeric,0),2)
                        is distinct from round(public.fb_menu_item_cost(ed.menu_item_id),2))))
      order by case coalesce(ed.snapshot->>'portata', mi.course)
        when 'APERITIVO' then 1 when 'ANTIPASTO' then 2 when 'PRIMO' then 3 when 'SECONDO' then 4
        when 'CONTORNO' then 5 when 'DOLCE' then 6 when 'FRUTTA' then 7 else 8 end, coalesce(ed.snapshot->>'nome', rc.name))
    from public.fb_event_dish ed
    join public.fb_menu_items mi on mi.id = ed.menu_item_id
    join public.fb_recipes rc on rc.id = mi.recipe_id
    where ed.entry_id = p_entry), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_menu_final(uuid) to authenticated;

-- ============ "Genera menù": porta i piatti confermati (snapshot) nel menù stampabile ==
-- Scrive in event_menu (la tabella che alimenta il PDF/atelier) una riga per piatto confermato,
-- marcata notes='fb:auto' così da poter essere rigenerata senza toccare le voci scritte a mano.
create or replace function public.fb_generate_event_menu(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_n int;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  delete from public.event_menu where entry_id = p_entry and notes = 'fb:auto';
  insert into public.event_menu(entry_id, section, ord, title, description, notes)
  select p_entry,
    (case coalesce(ed.snapshot->>'portata', mi.course)
       when 'APERITIVO' then 'BENVENUTO' when 'ANTIPASTO' then 'ANTIPASTO' when 'PRIMO' then 'PRIMO'
       when 'SECONDO' then 'SECONDO' when 'CONTORNO' then 'CONTORNO' when 'DOLCE' then 'DOLCE'
       when 'FRUTTA' then 'FRUTTA' when 'BEVANDE' then 'BEVANDA' else 'ANTIPASTO' end)::menu_section_kind,
    (case coalesce(ed.snapshot->>'portata', mi.course)
       when 'APERITIVO' then 0 when 'ANTIPASTO' then 1 when 'PRIMO' then 2 when 'SECONDO' then 3
       when 'CONTORNO' then 4 when 'FRUTTA' then 5 when 'DOLCE' then 6 when 'BEVANDE' then 7 else 1 end),
    left(coalesce(ed.snapshot->>'nome', rc.name), 180),
    nullif(ed.snapshot->>'descrizione',''),
    'fb:auto'
  from public.fb_event_dish ed
  join public.fb_menu_items mi on mi.id = ed.menu_item_id
  join public.fb_recipes rc on rc.id = mi.recipe_id
  where ed.entry_id = p_entry;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'inseriti', v_n);
end$$;
grant execute on function public.fb_generate_event_menu(uuid) to authenticated;
