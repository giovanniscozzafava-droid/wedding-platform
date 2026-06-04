-- ============================================================================
-- MONITORAGGIO ERRORI & SEGNALAZIONI (stile Sentry, interno).
--  * client_errors: errori JS catturati in automatico, RAGGRUPPATI per fingerprint
--    (un gruppo = stesso errore ricorrente, con conteggio occorrenze).
--  * bug_reports: segnalazioni scritte dagli utenti ("Segnala un problema").
-- Gli utenti SCRIVONO soltanto (anche anon per gli errori auto). Solo staff LEGGE.
-- ----------------------------------------------------------------------------

-- ── Errori auto-catturati (raggruppati) ─────────────────────────────────────
create table if not exists public.client_errors (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null unique,
  message      text not null,
  stack        text,
  source       text not null default 'JS',      -- JS | PROMISE | REACT
  severity     text not null default 'ERROR',   -- ERROR | WARNING
  status       text not null default 'NEW',      -- NEW | INVESTIGATING | RESOLVED | IGNORED
  count        integer not null default 1,
  url          text,
  release      text,
  last_user_id uuid references auth.users(id) on delete set null,
  last_user_agent text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create index if not exists idx_client_errors_status on public.client_errors (status, last_seen desc);
alter table public.client_errors enable row level security;
-- Nessuna policy di SELECT/INSERT diretta: si passa SOLO dalle funzioni qui sotto.

-- ── Segnalazioni utenti ─────────────────────────────────────────────────────
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  message     text not null,
  url         text,
  context     jsonb,
  severity    text not null default 'NORMALE',  -- BASSA | NORMALE | ALTA | BLOCCANTE
  status      text not null default 'NUOVO',     -- NUOVO | IN_LAVORAZIONE | RISOLTO | SCARTATO
  admin_notes text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bug_reports_status on public.bug_reports (status, created_at desc);
alter table public.bug_reports enable row level security;
drop policy if exists "bug_reports_insert_any" on public.bug_reports;
create policy "bug_reports_insert_any" on public.bug_reports
  for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists "bug_reports_select_own_or_staff" on public.bug_reports;
create policy "bug_reports_select_own_or_staff" on public.bug_reports
  for select using (user_id = auth.uid() or is_support_staff());

-- ── Log errore (upsert per fingerprint): chiamabile da chiunque ─────────────
create or replace function public.log_client_error(
  p_fingerprint text, p_message text, p_stack text default null,
  p_source text default 'JS', p_url text default null, p_release text default null,
  p_user_agent text default null, p_severity text default 'ERROR'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_fingerprint),'') = '' or coalesce(btrim(p_message),'') = '' then return; end if;
  insert into public.client_errors (fingerprint, message, stack, source, severity, url, release, last_user_id, last_user_agent)
  values (left(p_fingerprint,200), left(p_message,2000), left(p_stack,8000),
          coalesce(nullif(p_source,''),'JS'), coalesce(nullif(p_severity,''),'ERROR'),
          left(p_url,500), left(p_release,80), auth.uid(), left(p_user_agent,300))
  on conflict (fingerprint) do update set
    count = client_errors.count + 1,
    last_seen = now(),
    message = excluded.message,
    stack = excluded.stack,
    url = excluded.url,
    last_user_id = excluded.last_user_id,
    last_user_agent = excluded.last_user_agent,
    -- un errore già risolto che si ripresenta torna "NEW"
    status = case when client_errors.status in ('RESOLVED','IGNORED') then 'NEW' else client_errors.status end;
end$$;
grant execute on function public.log_client_error(text,text,text,text,text,text,text,text) to anon, authenticated;

-- ── Segnala un problema (utente) ────────────────────────────────────────────
create or replace function public.log_bug_report(
  p_message text, p_url text default null, p_context jsonb default null, p_severity text default 'NORMALE'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_message),'') = '' then raise exception 'message required'; end if;
  insert into public.bug_reports (user_id, message, url, context, severity)
  values (auth.uid(), left(p_message,4000), left(p_url,500), p_context, coalesce(nullif(p_severity,''),'NORMALE'))
  returning id into v_id;
  return v_id;
end$$;
grant execute on function public.log_bug_report(text,text,jsonb,text) to authenticated;

-- ── Letture/triage STAFF ────────────────────────────────────────────────────
create or replace function public.admin_errors_list(p_status text default null, p_limit int default 100)
returns setof public.client_errors language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select * from public.client_errors
    where p_status is null or p_status = '' or status = p_status
    order by (status='NEW') desc, last_seen desc limit greatest(1, least(p_limit, 200));
end$$;
grant execute on function public.admin_errors_list(text,int) to authenticated;

create or replace function public.admin_set_error_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update public.client_errors set status = p_status where id = p_id;
end$$;
grant execute on function public.admin_set_error_status(uuid,text) to authenticated;

create or replace function public.admin_bug_reports(p_status text default null, p_limit int default 100)
returns table (
  id uuid, message text, url text, severity text, status text, admin_notes text,
  created_at timestamptz, reporter text
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select b.id, b.message, b.url, b.severity, b.status, b.admin_notes, b.created_at,
           coalesce(p.business_name, p.full_name, u.email)::text as reporter
    from public.bug_reports b
    left join public.profiles p on p.id = b.user_id
    left join auth.users u on u.id = b.user_id
    where p_status is null or p_status = '' or b.status = p_status
    order by (b.status='NUOVO') desc, b.created_at desc limit greatest(1, least(p_limit, 200));
end$$;
grant execute on function public.admin_bug_reports(text,int) to authenticated;

create or replace function public.admin_set_bug_status(p_id uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update public.bug_reports set status = p_status,
         admin_notes = coalesce(p_notes, admin_notes) where id = p_id;
end$$;
grant execute on function public.admin_set_bug_status(uuid,text,text) to authenticated;

-- ── Estendo la panoramica con i contatori errori/segnalazioni ───────────────
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_guard();
  select jsonb_build_object(
    'users_total',          (select count(*) from profiles),
    'users_by_role',        (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role::text as role, count(*) n from profiles group by role) s),
    'staff_count',          (select count(*) from profiles where is_support_staff),
    'quotes_total',         (select count(*) from quotes),
    'quotes_by_status',     (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text as status, count(*) n from quotes group by status) s),
    'events_total',         (select count(*) from calendar_entries),
    'events_confirmed',     (select count(*) from calendar_entries where status = 'CONFERMATA'),
    'tickets_open',         (select count(*) from support_tickets where status <> 'CHIUSO'),
    'tickets_total',        (select count(*) from support_tickets),
    'funnel_active',        coalesce((select active from cron.job where jobname = 'funnel-daily'), false),
    'funnel_active_quotes', (select count(*) from quotes where status = 'INVIATO' and accepted_at is null and archived_at is null and coalesce(funnel_paused,false) = false and sent_at is not null),
    'errors_new',           (select count(*) from client_errors where status = 'NEW'),
    'errors_total',         (select count(*) from client_errors),
    'error_occurrences',    (select coalesce(sum(count),0) from client_errors where status in ('NEW','INVESTIGATING')),
    'bugs_new',             (select count(*) from bug_reports where status = 'NUOVO'),
    'bugs_total',           (select count(*) from bug_reports)
  ) into v;
  return v;
end$$;
grant execute on function public.admin_overview() to authenticated;
