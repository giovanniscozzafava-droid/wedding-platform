-- ============================================================================
-- Alternative con contatti DIRETTI (nome, email, telefono) per l'email al
-- cliente. Niente link al profilo Planfully: la piattaforma è riservata ai
-- fornitori, non aperta al pubblico.
-- ============================================================================
create or replace function public.suggest_alternatives_full(p_slug text, p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_owner uuid; v_sub text; v_role user_role; v_city text; v_msg text; v_name text; v_res jsonb;
begin
  if p_slug is null or p_date is null then return jsonb_build_object('found', false); end if;
  select id, subrole, role, city, auto_suggest_message, coalesce(business_name, full_name)
    into v_owner, v_sub, v_role, v_city, v_msg, v_name
    from public.profiles where slug = p_slug limit 1;
  if v_owner is null then return jsonb_build_object('found', false); end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
             'name', coalesce(c.business_name, c.full_name),
             'full_name', c.full_name,
             'subrole', c.subrole, 'city', c.city,
             'phone', c.phone,
             'email', (select u.email from auth.users u where u.id = c.id)
           ) as x
    from public.profiles c
    where c.id <> v_owner and c.is_discoverable = true and c.slug is not null
      and ((v_sub is not null and c.subrole = v_sub) or (v_sub is null and c.role = v_role))
      and not exists (select 1 from public.supplier_appointments a
                       where a.owner_id = c.id and a.kind in ('BLOCCO','VACANZA')
                         and p_date between a.date and coalesce(a.end_date, a.date))
      and not exists (select 1 from public.supplier_availability sa
                       where sa.fornitore_id = c.id and sa.date = p_date and sa.status in ('BUSY','UNAVAILABLE'))
      and (select count(*) from public.supplier_appointments a2
             where a2.owner_id = c.id and a2.date = p_date and a2.kind in ('EVENTO','APPUNTAMENTO'))
          < coalesce(c.daily_capacity, 999)
    order by (c.city is not distinct from v_city) desc, c.discover_tier desc nulls last, c.created_at desc
    limit 2
  ) s;

  return jsonb_build_object('found', true, 'busy_name', v_name, 'message', v_msg, 'alternatives', v_res);
end$$;
grant execute on function public.suggest_alternatives_full(text, date) to anon, authenticated;
