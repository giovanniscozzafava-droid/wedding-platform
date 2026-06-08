-- ============================================================================
-- Quando il professionista è OCCUPATO per la data richiesta, può (opzionalmente)
-- suggerire automaticamente 2 colleghi simili e disponibili, con un messaggio di
-- pugno ("fidati, è bravo come me"). Funzione attivabile dal profilo.
-- ============================================================================
alter table public.profiles
  add column if not exists auto_suggest_when_busy boolean not null default false,
  add column if not exists auto_suggest_message   text;
comment on column public.profiles.auto_suggest_when_busy is 'Se occupato, suggerisce automaticamente 2 colleghi simili e disponibili.';

-- RPC anon: dato lo slug (professionista occupato) e la data, restituisce fino a
-- 2 colleghi SIMILI (stesso subrole/ruolo) e DISPONIBILI in quella data.
create or replace function public.public_suggest_alternatives(p_slug text, p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_owner uuid; v_sub text; v_role user_role; v_city text;
  v_enabled boolean; v_msg text; v_res jsonb;
begin
  if p_slug is null or p_date is null then return jsonb_build_object('enabled', false); end if;
  select id, subrole, role, city, coalesce(auto_suggest_when_busy,false), auto_suggest_message
    into v_owner, v_sub, v_role, v_city, v_enabled, v_msg
    from public.profiles where slug = p_slug limit 1;
  if v_owner is null or not v_enabled then return jsonb_build_object('enabled', false); end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
             'name', coalesce(c.business_name, c.full_name),
             'slug', c.slug, 'subrole', c.subrole, 'city', c.city, 'role', c.role
           ) as x
    from public.profiles c
    where c.id <> v_owner
      and c.is_discoverable = true
      and c.slug is not null
      and ((v_sub is not null and c.subrole = v_sub) or (v_sub is null and c.role = v_role))
      and not exists (
        select 1 from public.supplier_appointments a
         where a.owner_id = c.id and a.kind in ('BLOCCO','VACANZA')
           and p_date between a.date and coalesce(a.end_date, a.date))
      and not exists (
        select 1 from public.supplier_availability sa
         where sa.fornitore_id = c.id and sa.date = p_date and sa.status = 'UNAVAILABLE')
      and (select count(*) from public.supplier_appointments a2
             where a2.owner_id = c.id and a2.date = p_date and a2.kind in ('EVENTO','APPUNTAMENTO'))
          < coalesce(c.daily_capacity, 999)
    order by (c.city is not distinct from v_city) desc, c.discover_tier desc nulls last, c.created_at desc
    limit 2
  ) s;

  return jsonb_build_object(
    'enabled', true,
    'message', v_msg,
    'endorser', (select coalesce(business_name, full_name) from public.profiles where id = v_owner),
    'suggestions', v_res
  );
end$$;
grant execute on function public.public_suggest_alternatives(text, date) to anon, authenticated;
