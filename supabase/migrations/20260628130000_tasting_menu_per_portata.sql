-- Prova menu: i piatti devono comparire SCOMPOSTI per portata (Aperitivo/Antipasti/Primi/Secondi/
-- Contorni/Dolci/Vini), non tutti insieme. fb_tasting_public ora ritorna 'piatti' raggruppato per course.
create or replace function public.fb_tasting_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_t record;
begin
  select t.id, t.entry_id, t.scheduled_at, t.sala, t.location_id, ce.title
    into v_t from public.fb_tastings t join public.calendar_entries ce on ce.id = t.entry_id
    where t.vote_token = p_token;
  if v_t.id is null then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true,
    'tasting_id', v_t.id, 'titolo', v_t.title, 'quando', v_t.scheduled_at, 'sala', v_t.sala,
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object('menu_id', mm.id, 'nome', mm.name,
        'portate', coalesce((
          select jsonb_agg(jsonb_build_object('course', g.course, 'voci', g.voci) order by g.rk)
          from (
            select mi.course,
                   jsonb_agg(rc.name order by mi.sort_order, rc.name) as voci,
                   min(case mi.course
                         when 'APERITIVO' then 1 when 'ANTIPASTO' then 2 when 'PRIMO' then 3
                         when 'SECONDO' then 4 when 'CONTORNO' then 5 when 'FRUTTA' then 6
                         when 'DOLCE' then 7 when 'BEVANDE' then 8 else 9 end) as rk
            from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id
            where mi.menu_id = mm.id
            group by mi.course
          ) g
        ), '[]'::jsonb)) order by mm.name)
      from public.fb_menu_proposals p join public.fb_menus mm on mm.id = p.menu_id where p.entry_id = v_t.entry_id), '[]'::jsonb));
end$$;
grant execute on function public.fb_tasting_public(text) to anon, authenticated;
