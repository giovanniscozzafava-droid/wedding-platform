-- GDPR: registro dei consensi degli ospiti a finalità commerciali / ad essere
-- ricontattati. Conserviamo i dati (nome+email) di chi ACCETTA, con prova del consenso
-- (testo + timestamp). Scrittura solo lato server (edge guest-signup, service role).
create table if not exists public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  full_name text,
  entry_id uuid references public.calendar_entries(id) on delete set null,
  commercial boolean not null default false,   -- finalità commerciali
  recontact boolean not null default false,    -- può essere ricontattato
  consent_text text,                            -- versione del testo accettato (prova)
  source text not null default 'guest_gallery',
  granted_at timestamptz not null default now()
);
alter table public.marketing_consents enable row level security;

-- niente write diretta dai client; lettura: admin (gestione lista) o il diretto interessato.
drop policy if exists mc_admin_read on public.marketing_consents;
create policy mc_admin_read on public.marketing_consents for select using (public.is_admin());
drop policy if exists mc_self_read on public.marketing_consents;
create policy mc_self_read on public.marketing_consents for select using (user_id = auth.uid());

create index if not exists idx_marketing_consents_commercial on public.marketing_consents (commercial) where commercial;
create index if not exists idx_marketing_consents_entry on public.marketing_consents (entry_id);
