-- ============================================================================
-- Pannello Admin/Staff: panoramica, gestione team (flag staff), controllo funnel.
-- Tutte le funzioni sono SECURITY DEFINER e rifiutano chi non è staff/admin.
-- ----------------------------------------------------------------------------

create or replace function public.admin_guard()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_support_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end$$;

-- ── Panoramica numeri piattaforma ───────────────────────────────────────────
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_guard();
  select jsonb_build_object(
    'users_total',          (select count(*) from profiles),
    'users_by_role',        (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
                               from (select role::text as role, count(*) n from profiles group by role) s),
    'staff_count',          (select count(*) from profiles where is_support_staff),
    'quotes_total',         (select count(*) from quotes),
    'quotes_by_status',     (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                               from (select status::text as status, count(*) n from quotes group by status) s),
    'events_total',         (select count(*) from calendar_entries),
    'events_confirmed',     (select count(*) from calendar_entries where status = 'CONFERMATA'),
    'tickets_open',         (select count(*) from support_tickets where status <> 'CHIUSO'),
    'tickets_total',        (select count(*) from support_tickets),
    'funnel_active',        coalesce((select active from cron.job where jobname = 'funnel-daily'), false),
    'funnel_active_quotes', (select count(*) from quotes
                               where status = 'INVIATO' and accepted_at is null and archived_at is null
                                 and coalesce(funnel_paused,false) = false and sent_at is not null)
  ) into v;
  return v;
end$$;
grant execute on function public.admin_overview() to authenticated;

-- ── Lista utenti (con email) per gestione staff ─────────────────────────────
create or replace function public.admin_list_users(p_search text default null)
returns table (
  id uuid, full_name text, business_name text, role text, email text,
  is_support_staff boolean, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.full_name, p.business_name, p.role::text, u.email,
           p.is_support_staff, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    where p_search is null or p_search = ''
       or p.full_name ilike '%'||p_search||'%'
       or p.business_name ilike '%'||p_search||'%'
       or u.email ilike '%'||p_search||'%'
    order by p.is_support_staff desc, p.created_at desc
    limit 100;
end$$;
grant execute on function public.admin_list_users(text) to authenticated;

-- ── Attiva/disattiva flag staff su un utente ────────────────────────────────
create or replace function public.admin_set_support_staff(p_user_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update profiles set is_support_staff = p_value where id = p_user_id;
end$$;
grant execute on function public.admin_set_support_staff(uuid, boolean) to authenticated;

-- ── Accendi/spegni il funnel (cron) senza perdere il comando/secret ─────────
create or replace function public.admin_set_funnel(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_jobid bigint;
begin
  perform admin_guard();
  select jobid into v_jobid from cron.job where jobname = 'funnel-daily';
  if v_jobid is null then return false; end if;
  perform cron.alter_job(v_jobid, active := p_on);
  return p_on;
end$$;
grant execute on function public.admin_set_funnel(boolean) to authenticated;

-- ── Metti in pausa / riattiva il funnel su un preventivo ────────────────────
create or replace function public.admin_pause_quote_funnel(p_quote_id uuid, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update quotes set funnel_paused = p_paused where id = p_quote_id;
end$$;
grant execute on function public.admin_pause_quote_funnel(uuid, boolean) to authenticated;
