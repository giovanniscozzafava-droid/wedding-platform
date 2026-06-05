-- ============================================================================
-- AUDIT LOG azioni admin/staff (chi-cosa-quando). Indispensabile con un team,
-- e traccia in particolare le impersonation ("Accedi come utente").
-- ----------------------------------------------------------------------------

create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,            -- IMPERSONATE | DELETE_USER | SET_PLAN | ...
  target_id   uuid,
  target_label text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
-- accesso solo via funzioni

-- helper interno: registra un evento di audit per l'utente corrente.
create or replace function public.admin_audit_log(p_action text, p_target_id uuid default null, p_target_label text default null, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_audit (actor_id, actor_email, action, target_id, target_label, meta)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_target_id, p_target_label, p_meta);
end$$;
grant execute on function public.admin_audit_log(text,uuid,text,jsonb) to authenticated;

create or replace function public.admin_audit_list(p_limit int default 100)
returns setof public.admin_audit language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select * from public.admin_audit order by created_at desc limit greatest(1, least(p_limit, 300));
end$$;
grant execute on function public.admin_audit_list(int) to authenticated;
