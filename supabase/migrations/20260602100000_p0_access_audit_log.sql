-- ============================================================================
-- P0 — Audit accessi centralizzato e immutabile
-- ----------------------------------------------------------------------------
-- Tabella append-only che traccia letture/scritture sensibili (lead, quote,
-- contratti, pagamenti, documenti, firme). Nessun accesso diretto da
-- anon/authenticated: si scrive solo via la funzione SECURITY DEFINER
-- log_access(). Trigger anti-UPDATE/DELETE garantiscono l'immutabilità.
-- Chiude le 6 voci RLS-audit P0 (un'unica infrastruttura riusabile).
-- ============================================================================

create table if not exists public.access_audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  actor_email  text,
  actor_role   text,
  table_name   text not null,
  record_id    text,
  action       text not null check (action in ('READ','WRITE','SIGN','TOKEN_USE','EXPORT','DELETE')),
  ip_address   text,
  user_agent   text,
  metadata     jsonb not null default '{}'::jsonb,
  at           timestamptz not null default now()
);

create index if not exists idx_access_audit_table_record on public.access_audit_log(table_name, record_id);
create index if not exists idx_access_audit_actor on public.access_audit_log(actor_id, at desc);
create index if not exists idx_access_audit_at on public.access_audit_log(at desc);

-- Immutabilità: niente UPDATE/DELETE (nemmeno service_role via SQL normale).
create or replace function public.block_mutation_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'immutable_table: % non ammette % ', tg_table_name, tg_op;
end$$;

drop trigger if exists trg_access_audit_no_update on public.access_audit_log;
create trigger trg_access_audit_no_update before update on public.access_audit_log
  for each row execute function public.block_mutation_immutable();
drop trigger if exists trg_access_audit_no_delete on public.access_audit_log;
create trigger trg_access_audit_no_delete before delete on public.access_audit_log
  for each row execute function public.block_mutation_immutable();

-- Lockdown: nessun accesso diretto.
alter table public.access_audit_log enable row level security;
revoke all on public.access_audit_log from anon, authenticated, public;
-- Nessuna policy permissiva → di default tutto negato per anon/authenticated.
-- Gli ADMIN leggono via RPC dedicata (sotto).

-- Logger riusabile (SECURITY DEFINER: scrive bypassando i grant revocati).
create or replace function public.log_access(
  p_table     text,
  p_record_id text,
  p_action    text,
  p_metadata  jsonb default '{}'::jsonb,
  p_ip        text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_role text;
begin
  begin
    v_email := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  exception when others then v_email := null; end;
  if v_uid is not null then
    select role::text into v_role from public.profiles where id = v_uid;
  end if;
  insert into public.access_audit_log(actor_id, actor_email, actor_role, table_name, record_id, action, ip_address, user_agent, metadata)
  values (v_uid, nullif(v_email,''), v_role, p_table, p_record_id, upper(p_action), p_ip, p_user_agent, coalesce(p_metadata,'{}'::jsonb));
end$$;

grant execute on function public.log_access(text, text, text, jsonb, text, text) to authenticated, anon;

-- Lettura riservata agli ADMIN.
create or replace function public.admin_read_access_audit(p_table text default null, p_limit int default 200)
returns setof public.access_audit_log
language sql
stable
security definer
set search_path = public
as $$
  select * from public.access_audit_log
   where public.is_admin()
     and (p_table is null or table_name = p_table)
   order by at desc
   limit greatest(1, least(p_limit, 1000));
$$;

grant execute on function public.admin_read_access_audit(text, int) to authenticated;

comment on table public.access_audit_log is
  'Audit accessi/azioni sensibili, append-only e immutabile (trigger anti-UPDATE/DELETE). Scrittura solo via log_access(); lettura solo admin via admin_read_access_audit().';
