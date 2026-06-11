-- Stati OAuth per il collegamento Google Drive del professionista (CSRF + binding
-- allo user). Letti/scritti SOLO dall'edge (service_role); nessuna policy = nessun
-- accesso da anon/authenticated.
create table public.drive_oauth_states (
  state text primary key,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.drive_oauth_states enable row level security;
revoke all on public.drive_oauth_states from anon, authenticated;

-- I token Drive si conservano come base64 del ciphertext AES-GCM (text), più
-- comodo via REST/Edge del bytea (le colonne sono vuote: alter sicuro).
alter table public.drive_connections
  alter column access_token_enc  type text using access_token_enc::text,
  alter column refresh_token_enc type text using refresh_token_enc::text;
