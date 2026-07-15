-- LISTA D'ATTESA (pre-lancio): in beta la registrazione pubblica è sostituita da una
-- lista d'attesa. I professionisti lasciano i contatti; Giovanni invita chi vuole
-- (l'invito diretto /register resta). Insert solo via RPC SECURITY DEFINER (niente
-- write diretta anon sulla tabella). Lettura: solo staff/admin.

create table if not exists public.waitlist_signups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  activity_type text,                    -- WP | LOCATION | FORNITORE | ALTRO (libero)
  city          text,
  source        text,                    -- da dove si è iscritto (es. 'home', 'scopri')
  created_at    timestamptz not null default now()
);
-- unicità case-insensitive per email (un'espressione richiede un INDEX, non un constraint)
create unique index if not exists waitlist_email_uidx on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

-- Nessuna policy per anon/authenticated normali → default-deny (nessuna lettura pubblica).
drop policy if exists waitlist_staff_read on public.waitlist_signups;
create policy waitlist_staff_read on public.waitlist_signups for select
  using (public.is_support_staff() or public.is_admin());

-- Iscrizione pubblica: valida minimamente e inserisce (idempotente per email).
create or replace function public.waitlist_submit(
  p_name text, p_email text, p_activity text default null, p_city text default null, p_source text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('error','no_name'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('error','bad_email'); end if;
  insert into public.waitlist_signups(name, email, activity_type, city, source)
    values (trim(p_name), v_email, nullif(trim(coalesce(p_activity,'')),''), nullif(trim(coalesce(p_city,'')),''), nullif(trim(coalesce(p_source,'')),''))
  on conflict (lower(email)) do update set
    name = excluded.name,
    activity_type = coalesce(excluded.activity_type, public.waitlist_signups.activity_type),
    city = coalesce(excluded.city, public.waitlist_signups.city);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.waitlist_submit(text, text, text, text, text) to anon, authenticated;
