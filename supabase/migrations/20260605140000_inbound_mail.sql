-- ============================================================================
-- POSTA IN ENTRATA (Resend Inbound) — casella condivisa gestita dentro l'app.
-- Le email per *@planfully.it arrivano via webhook → salvate qui → lette/risposte
-- dal pannello admin. Niente Outlook.
-- ----------------------------------------------------------------------------

create table if not exists public.inbound_emails (
  id          uuid primary key default gen_random_uuid(),
  resend_id   text unique,
  from_addr   text,
  to_addr     text,
  subject     text,
  text        text,
  html        text,
  headers     jsonb,
  message_id  text,
  reply_to    text,
  status      text not null default 'UNREAD' check (status in ('UNREAD','READ','ARCHIVED')),
  assigned_to uuid references auth.users(id) on delete set null,
  received_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_inbound_status on public.inbound_emails (status, received_at desc);
alter table public.inbound_emails enable row level security;
-- accesso solo via funzioni admin (nessuna policy diretta)

create or replace function public.admin_inbox_list(p_status text default null, p_limit int default 100)
returns table (id uuid, from_addr text, to_addr text, subject text, status text, received_at timestamptz, snippet text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select e.id, e.from_addr, e.to_addr, e.subject, e.status, coalesce(e.received_at, e.created_at),
           left(coalesce(e.text, regexp_replace(coalesce(e.html,''), '<[^>]+>', ' ', 'g')), 140) as snippet
    from inbound_emails e
    where p_status is null or p_status = '' or e.status = p_status
    order by (e.status='UNREAD') desc, coalesce(e.received_at,e.created_at) desc
    limit greatest(1, least(p_limit, 200));
end$$;
grant execute on function public.admin_inbox_list(text,int) to authenticated;

create or replace function public.admin_inbox_get(p_id uuid)
returns setof public.inbound_emails language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update inbound_emails set status='READ' where id=p_id and status='UNREAD';
  return query select * from inbound_emails where id=p_id;
end$$;
grant execute on function public.admin_inbox_get(uuid) to authenticated;

create or replace function public.admin_set_inbox_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update inbound_emails set status=p_status where id=p_id;
end$$;
grant execute on function public.admin_set_inbox_status(uuid,text) to authenticated;

-- contatore non letti nella panoramica
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_guard();
  select jsonb_build_object(
    'users_total',(select count(*) from profiles),
    'users_by_role',(select coalesce(jsonb_object_agg(role,n),'{}'::jsonb) from (select role::text as role,count(*) n from profiles group by role) s),
    'staff_count',(select count(*) from profiles where is_support_staff),
    'quotes_total',(select count(*) from quotes),
    'quotes_by_status',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status::text as status,count(*) n from quotes group by status) s),
    'events_total',(select count(*) from calendar_entries),
    'events_confirmed',(select count(*) from calendar_entries where status='CONFERMATA'),
    'tickets_open',(select count(*) from support_tickets where status<>'CHIUSO'),
    'tickets_total',(select count(*) from support_tickets),
    'funnel_active',coalesce((select active from cron.job where jobname='funnel-daily'),false),
    'funnel_active_quotes',(select count(*) from quotes where status='INVIATO' and accepted_at is null and archived_at is null and coalesce(funnel_paused,false)=false and sent_at is not null),
    'errors_new',(select count(*) from client_errors where status='NEW'),
    'errors_total',(select count(*) from client_errors),
    'error_occurrences',(select coalesce(sum(count),0) from client_errors where status in ('NEW','INVESTIGATING')),
    'bugs_new',(select count(*) from bug_reports where status='NUOVO'),
    'bugs_total',(select count(*) from bug_reports),
    'inbox_unread',(select count(*) from inbound_emails where status='UNREAD')
  ) into v;
  return v;
end$$;
grant execute on function public.admin_overview() to authenticated;
