-- ============================================================================
-- PIANI ABBONAMENTO FORNITORI (reach) + impostazioni piattaforma + gestione admin.
--  * subscription_plan: NONE | PRESENCE(29) | REGION(59) | NATIONAL(79).
--    "Reach" = dove il fornitore entra nella "pancia" (pool suggerimenti):
--    PRESENCE = solo presente/cercabile; REGION = pancia di tutti i WP della sua
--    regione; NATIONAL = pancia di tutti i capostipiti d'Italia.
--  * Non tocco subscription_status (lo usa il sistema crediti/referral).
--  * app_settings: configurazione tunabile (cap pancia, prezzi) editabile da admin.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists subscription_plan text not null default 'NONE'
    check (subscription_plan in ('NONE','PRESENCE','REGION','NATIONAL'));

-- Impostazioni piattaforma (chiave→valore jsonb).
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- nessun accesso diretto: solo via funzioni admin.

insert into public.app_settings (key, value) values
  ('pricing', '{"presence":29,"region":59,"national":79}'::jsonb),
  ('belly', '{"cap_per_category":5,"cap_total":null}'::jsonb)
on conflict (key) do nothing;

-- ── Letture/gestione (solo staff) ───────────────────────────────────────────
create or replace function public.admin_subscriptions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_price jsonb;
begin
  perform admin_guard();
  select value into v_price from app_settings where key = 'pricing';
  select jsonb_build_object(
    'by_plan', (select coalesce(jsonb_object_agg(plan, n),'{}'::jsonb)
                  from (select subscription_plan as plan, count(*) n
                          from profiles where role = 'FORNITORE' group by subscription_plan) s),
    'fornitori_total', (select count(*) from profiles where role='FORNITORE'),
    'paying', (select count(*) from profiles where role='FORNITORE' and subscription_plan <> 'NONE'),
    'mrr', (select coalesce(sum(
              case subscription_plan
                when 'PRESENCE' then (v_price->>'presence')::numeric
                when 'REGION'   then (v_price->>'region')::numeric
                when 'NATIONAL' then (v_price->>'national')::numeric
                else 0 end), 0)
              from profiles where role='FORNITORE'),
    'pricing', v_price,
    'belly', (select value from app_settings where key='belly')
  ) into v;
  return v;
end$$;
grant execute on function public.admin_subscriptions() to authenticated;

create or replace function public.admin_list_fornitori(p_search text default null, p_plan text default null)
returns table (
  id uuid, full_name text, business_name text, subrole text, email text,
  subscription_plan text, subscription_status text, service_regions text[], created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.full_name::text, p.business_name::text, p.subrole::text, u.email::text,
           p.subscription_plan, p.subscription_status, p.service_regions, p.created_at
    from profiles p join auth.users u on u.id = p.id
    where p.role = 'FORNITORE'
      and (p_plan is null or p_plan = '' or p.subscription_plan = p_plan)
      and (p_search is null or p_search = ''
           or p.full_name ilike '%'||p_search||'%'
           or p.business_name ilike '%'||p_search||'%'
           or u.email ilike '%'||p_search||'%')
    order by p.subscription_plan desc, p.created_at desc
    limit 100;
end$$;
grant execute on function public.admin_list_fornitori(text,text) to authenticated;

create or replace function public.admin_set_subscription_plan(p_user_id uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if p_plan not in ('NONE','PRESENCE','REGION','NATIONAL') then raise exception 'invalid plan'; end if;
  update profiles set subscription_plan = p_plan,
    -- tengo coerente subscription_status per il sistema crediti:
    -- PRESENCE/REGION → PLUS, NATIONAL → PREMIUM, NONE → invariato.
    subscription_status = case
        when p_plan in ('PRESENCE','REGION') then 'PLUS'
        when p_plan = 'NATIONAL' then 'PREMIUM'
        else subscription_status end
  where id = p_user_id and role = 'FORNITORE';
end$$;
grant execute on function public.admin_set_subscription_plan(uuid,text) to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  insert into app_settings(key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end$$;
grant execute on function public.admin_set_setting(text,jsonb) to authenticated;
