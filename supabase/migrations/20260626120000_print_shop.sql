-- Negozio stampe (beta, request-based: nessun pagamento/prezzo, il fotografo segue la richiesta).
-- Il modulo commerciale completo (Stripe/ordini) resta dietro il gate del PRP-4.

-- Cosa il fotografo mette in mostra ai clienti.
create table if not exists public.print_shop_settings (
  professional_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  products text[] not null default array['stampa','tela','cornice'],
  intro text,
  updated_at timestamptz not null default now()
);
alter table public.print_shop_settings enable row level security;
drop policy if exists pss_own on public.print_shop_settings;
create policy pss_own on public.print_shop_settings
  for all using (professional_id = auth.uid() or (auth.jwt() ->> 'role') = 'service_role')
  with check (professional_id = auth.uid() or (auth.jwt() ->> 'role') = 'service_role');

-- Richieste di stampa dei clienti (beta: il fotografo le evade fuori piattaforma).
create table if not exists public.print_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid,
  photo_drive_id text,
  photo_thumb text,
  product_key text not null,
  format_key text not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  note text,
  status text not null default 'NUOVA',
  created_at timestamptz not null default now()
);
create index if not exists print_req_pro on public.print_requests (professional_id, created_at desc);
alter table public.print_requests enable row level security;
drop policy if exists preq_own on public.print_requests;
create policy preq_own on public.print_requests
  for select using (professional_id = auth.uid() or (auth.jwt() ->> 'role') = 'service_role');
drop policy if exists preq_own_upd on public.print_requests;
create policy preq_own_upd on public.print_requests
  for update using (professional_id = auth.uid()) with check (professional_id = auth.uid());

-- Config pubblica per la pagina/sheet cliente, by slug del fotografo.
create or replace function public.print_shop_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_pid uuid; s public.print_shop_settings%rowtype; v_name text;
begin
  select id into v_pid from public.profiles where slug = p_slug;
  if v_pid is null then return jsonb_build_object('error','not_found'); end if;
  select * into s from public.print_shop_settings where professional_id = v_pid and enabled;
  if not found then return jsonb_build_object('enabled', false); end if;
  select coalesce(business_name, full_name, 'Il fotografo') into v_name from public.profiles where id = v_pid;
  return jsonb_build_object('enabled', true, 'products', to_jsonb(s.products), 'intro', s.intro, 'pro_name', v_name);
end$$;
grant execute on function public.print_shop_public(text) to anon, authenticated;

-- Config pubblica risolta dall'evento (la galleria conosce entry_id; il fotografo = owner galleria).
create or replace function public.print_shop_for_entry(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_pid uuid; s public.print_shop_settings%rowtype; v_name text;
begin
  select owner_id into v_pid from public.event_galleries where entry_id = p_entry;
  if v_pid is null then return jsonb_build_object('enabled', false); end if;
  select * into s from public.print_shop_settings where professional_id = v_pid and enabled;
  if not found then return jsonb_build_object('enabled', false); end if;
  select coalesce(business_name, full_name, 'Il fotografo') into v_name from public.profiles where id = v_pid;
  return jsonb_build_object('enabled', true, 'products', to_jsonb(s.products), 'intro', s.intro, 'pro_name', v_name);
end$$;
grant execute on function public.print_shop_for_entry(uuid) to anon, authenticated;
