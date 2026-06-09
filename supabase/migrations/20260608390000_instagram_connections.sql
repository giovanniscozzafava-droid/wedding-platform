-- ============================================================================
-- Integrazione Instagram (Instagram API with Instagram Login). Ogni
-- professionista collega il proprio account IG Business/Creator e da lì
-- importa i post per generare articoli. Token gestito server-side (edge).
-- ============================================================================
create table if not exists public.instagram_connections (
  profile_id      uuid primary key references public.profiles(id) on delete cascade,
  ig_user_id      text,
  username        text,
  access_token    text not null,        -- long-lived (60gg), gestito solo lato edge
  token_expires_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.instagram_connections enable row level security;
-- Nessuna lettura client diretta del token: il client usa la RPC my_instagram().
drop policy if exists "ig_conn_admin" on public.instagram_connections;
create policy "ig_conn_admin" on public.instagram_connections for all
  using (is_admin()) with check (is_admin());

-- Stato OAuth temporaneo (lega il redirect di IG al professionista)
create table if not exists public.instagram_oauth_states (
  state      text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.instagram_oauth_states enable row level security; -- solo edge (service role)

-- Stato connessione per la UI (senza esporre il token)
create or replace function public.my_instagram()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.instagram_connections where profile_id = auth.uid())
    then (select jsonb_build_object('connected', true, 'username', username,
                 'expires_at', token_expires_at) from public.instagram_connections where profile_id = auth.uid())
    else jsonb_build_object('connected', false) end;
$$;
grant execute on function public.my_instagram() to authenticated;

create or replace function public.disconnect_instagram()
returns jsonb language sql volatile security definer set search_path = public as $$
  delete from public.instagram_connections where profile_id = auth.uid();
  select jsonb_build_object('ok', true);
$$;
grant execute on function public.disconnect_instagram() to authenticated;
