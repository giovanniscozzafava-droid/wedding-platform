-- Stagionalità per singolo piatto (mesi ricorrenti) + voci modificabili dalla location.
-- Un piatto è proposto solo per matrimoni la cui data cade nella finestra stagionale.

-- 1) Finestra stagionale sul singolo piatto (mesi 1-12, null = tutto l'anno) ------------
alter table public.fb_menu_items add column if not exists season_from int;
alter table public.fb_menu_items add column if not exists season_to   int;
do $$ begin
  alter table public.fb_menu_items add constraint fb_menu_items_season_chk
    check ((season_from is null and season_to is null)
        or (season_from between 1 and 12 and season_to between 1 and 12));
exception when duplicate_object then null; end $$;

-- 2) RPC: la location modifica un piatto (nome, portata, stagione) -----------------------
create or replace function public.fb_dish_update(p_menu_item_id uuid, p_name text default null,
  p_course text default null, p_season_from int default null, p_season_to int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_recipe uuid;
begin
  select mm.location_id, mi.recipe_id into v_loc, v_recipe
    from public.fb_menu_items mi join public.fb_menus mm on mm.id = mi.menu_id
   where mi.id = p_menu_item_id;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_loc = auth.uid() or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if p_course is not null and p_course not in ('APERITIVO','ANTIPASTO','PRIMO','SECONDO','CONTORNO','DOLCE','FRUTTA','BEVANDE') then
    return jsonb_build_object('error','bad_course'); end if;
  if p_season_from is not null and p_season_from <> 0
     and (p_season_from < 1 or p_season_from > 12 or coalesce(p_season_to,0) < 1 or p_season_to > 12) then
    return jsonb_build_object('error','bad_season'); end if;

  update public.fb_menu_items
     set course = coalesce(p_course, course),
         season_from = case when p_season_from = 0 then null else coalesce(p_season_from, season_from) end,
         season_to   = case when p_season_from = 0 then null else coalesce(p_season_to, season_to) end
   where id = p_menu_item_id;

  if p_name is not null and length(btrim(p_name)) > 0 then
    update public.fb_recipes set name = btrim(p_name) where id = v_recipe and location_id = auth.uid();
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_dish_update(uuid, text, text, int, int) to authenticated;

-- 3) Vista scelta: aggiunge stagione + disponibilità per la data del matrimonio ----------
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
        'piatti', coalesce((
          select jsonb_agg(jsonb_build_object(
              'menu_item_id', mi.id, 'portata', mi.course, 'piatto', rc.name,
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
