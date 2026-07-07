-- OSSERVATORIO ADMIN — analytics di prodotto (solo admin).
-- Chi/quando ha avuto accesso, cosa ha fatto, crescita utenti.
-- Costruito sui dati già tracciati: auth.users (last_sign_in_at, created_at),
-- public.profiles (ruoli, iscrizione), public.audit_log (azioni chi-cosa-quando).
-- RPC SECURITY DEFINER guardate da public.is_admin(). Sola lettura.

-- ── Crescita utenti ────────────────────────────────────────────────────────
create or replace function public.admin_obs_growth(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  n_days int := greatest(7, least(coalesce(p_days, 90), 365));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  with days as (
    select generate_series((current_date - (n_days - 1) * interval '1 day')::date, current_date, interval '1 day')::date as day
  ),
  s as (
    select created_at::date as day, count(*) as n
    from public.profiles
    where created_at::date >= (current_date - (n_days - 1) * interval '1 day')::date
    group by 1
  ),
  base as (
    select count(*) as c from public.profiles
    where created_at::date < (current_date - (n_days - 1) * interval '1 day')::date
  ),
  series as (
    select d.day,
           coalesce(s.n, 0) as signups,
           (select c from base) + sum(coalesce(s.n, 0)) over (order by d.day) as cumulative
    from days d
    left join s on s.day = d.day
  )
  select jsonb_build_object(
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'signups', signups, 'cumulative', cumulative) order by day), '[]'::jsonb) from series),
    'by_role', (select coalesce(jsonb_agg(jsonb_build_object('role', role, 'n', n) order by n desc), '[]'::jsonb)
                from (select coalesce(role, 'SCONOSCIUTO') as role, count(*) as n from public.profiles group by 1) r),
    'totals', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new7',  (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'prev7', (select count(*) from public.profiles where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
      'new30', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'active7',  (select count(distinct eseguito_da) from public.audit_log where eseguito_il >= now() - interval '7 days' and eseguito_da is not null),
      'active30', (select count(distinct eseguito_da) from public.audit_log where eseguito_il >= now() - interval '30 days' and eseguito_da is not null),
      'actions_today', (select count(*) from public.audit_log where eseguito_il >= current_date)
    )
  ) into v;
  return v;
end $$;

grant execute on function public.admin_obs_growth(int) to authenticated;

-- ── Accessi per utente (chi / quando) ──────────────────────────────────────
create or replace function public.admin_obs_access(p_limit int default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(row order by last_seen desc nulls last), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'user_id', u.id,
      'email', u.email,
      'full_name', p.full_name,
      'business_name', p.business_name,
      'role', p.role,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'actions', coalesce(a.n, 0),
      'last_activity', a.last_at
    ) as row,
    greatest(u.last_sign_in_at, a.last_at) as last_seen
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join (
      select eseguito_da, count(*) as n, max(eseguito_il) as last_at
      from public.audit_log group by eseguito_da
    ) a on a.eseguito_da = u.id
    order by last_seen desc nulls last
    limit greatest(1, least(coalesce(p_limit, 300), 1000))
  ) t;
  return v;
end $$;

grant execute on function public.admin_obs_access(int) to authenticated;

-- ── Attività (cosa ha fatto) ───────────────────────────────────────────────
create or replace function public.admin_obs_activity(p_limit int default 120)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select jsonb_build_object(
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'at', al.eseguito_il, 'actor_id', al.eseguito_da, 'email', u.email,
        'role', p.role, 'op', al.operazione, 'tabella', al.tabella, 'record_id', al.record_id
      ) order by al.eseguito_il desc), '[]'::jsonb)
      from (select * from public.audit_log order by eseguito_il desc limit greatest(1, least(coalesce(p_limit, 120), 500))) al
      left join auth.users u on u.id = al.eseguito_da
      left join public.profiles p on p.id = al.eseguito_da
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day), '[]'::jsonb)
      from (select eseguito_il::date as day, count(*) as n from public.audit_log
            where eseguito_il >= now() - interval '30 days' group by 1) d
    ),
    'top_actors', (
      select coalesce(jsonb_agg(jsonb_build_object('actor_id', actor_id, 'email', email, 'role', role, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select al.eseguito_da as actor_id, u.email, p.role, count(*) as n
        from public.audit_log al
        left join auth.users u on u.id = al.eseguito_da
        left join public.profiles p on p.id = al.eseguito_da
        where al.eseguito_il >= now() - interval '30 days' and al.eseguito_da is not null
        group by al.eseguito_da, u.email, p.role
        order by n desc
        limit 12
      ) ta
    )
  ) into v;
  return v;
end $$;

grant execute on function public.admin_obs_activity(int) to authenticated;
