-- ============================================================================
-- PROVA LOOK (Beta) — due strumenti, un motore.
--   · Parrucchiere  → prova ACCONCIATURA (kind='hair')   → cambia solo i capelli
--   · Truccatore    → prova TRUCCO       (kind='makeup') → cambia solo il trucco
-- Il fornitore carica la foto della cliente, compone 1..N look da un catalogo
-- estendibile (categorie×opzioni + preset + testo libero), l'AI genera le proposte
-- (edge function look-generate → Higgsfield, addebito sul wallet AI fb_ai_*), il
-- fornitore CURA le migliori e invia un link con token: la cliente le vede (sola lettura).
-- ============================================================================

-- 1) CATALOGO look: voci componibili. owner_id null = preset di SISTEMA (visibili a tutti);
--    owner_id valorizzato = voci personali del fornitore. Estendibile all'infinito senza codice.
create table if not exists public.look_styles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,   -- null = sistema
  kind text not null check (kind in ('hair','makeup')),
  category text not null,               -- makeup: occhi|labbra|incarnato|blush|ciglia|occasione|intensita|preset · hair: acconciatura|colore|preset
  label text not null,                  -- etichetta mostrata (es. "Smoky bronzo")
  prompt_fragment text not null,        -- frammento iniettato nel prompt di generazione
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists look_styles_kind_idx on public.look_styles(kind, category, sort);
create index if not exists look_styles_owner_idx on public.look_styles(owner_id) where owner_id is not null;

-- 2) SESSIONE: una per prova (fornitore + cliente). Token per la vista cliente.
create table if not exists public.look_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,  -- il fornitore
  kind text not null check (kind in ('hair','makeup')),
  client_label text,                    -- nome cliente (facoltativo)
  entry_id uuid references public.calendar_entries(id) on delete set null,  -- evento collegato (facoltativo)
  selfie_path text,                     -- path storage della foto cliente
  selfie_url text,                      -- url pubblico della foto
  share_token uuid not null unique default gen_random_uuid(),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SENT','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists look_sessions_owner_idx on public.look_sessions(owner_id, created_at desc);

-- 3) PROPOSTE: immagini generate. Il fornitore cura (KEPT/DISCARDED); le KEPT si inviano.
create table if not exists public.look_proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.look_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text,                           -- etichetta del look (es. "Smoky + chignon")
  prompt text,                          -- prompt composto usato per generare
  spec jsonb,                           -- opzioni scelte (per riprodurre/ritoccare)
  image_url text,                       -- url pubblico dell'immagine generata
  status text not null default 'DRAFT' check (status in ('DRAFT','KEPT','DISCARDED')),
  client_favorite boolean not null default false,  -- la cliente indica la preferita
  created_at timestamptz not null default now()
);
create index if not exists look_proposals_session_idx on public.look_proposals(session_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.look_styles enable row level security;
alter table public.look_sessions enable row level security;
alter table public.look_proposals enable row level security;

-- Catalogo: sistema (owner null) leggibile da tutti gli autenticati; le proprie voci CRUD dal proprietario.
drop policy if exists look_styles_read on public.look_styles;
create policy look_styles_read on public.look_styles for select to authenticated
  using (owner_id is null or owner_id = auth.uid() or is_admin());
drop policy if exists look_styles_write on public.look_styles;
create policy look_styles_write on public.look_styles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Sessioni/proposte: solo il fornitore proprietario (la vista cliente passa dalle RPC anon-by-token).
drop policy if exists look_sessions_owner on public.look_sessions;
create policy look_sessions_owner on public.look_sessions for all to authenticated
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid());
drop policy if exists look_proposals_owner on public.look_proposals;
create policy look_proposals_owner on public.look_proposals for all to authenticated
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid());

-- ── RPC: crea/gestisci sessione (fornitore) ─────────────────────────────────
-- Solo fornitori parrucchiere/truccatore (o admin). Il kind deve combaciare col mestiere.
create or replace function public.look_session_create(p_kind text, p_client_label text, p_entry uuid default null)
returns public.look_sessions language plpgsql security definer set search_path = public as $$
declare v_sub text; v_row public.look_sessions;
begin
  if p_kind not in ('hair','makeup') then raise exception 'bad_kind'; end if;
  select subrole into v_sub from public.profiles where id = auth.uid();
  if not (is_admin()
          or (p_kind = 'hair' and v_sub = 'parrucchiere')
          or (p_kind = 'makeup' and v_sub = 'make_up')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.look_sessions(owner_id, kind, client_label, entry_id)
    values (auth.uid(), p_kind, nullif(p_client_label,''), p_entry)
    returning * into v_row;
  return v_row;
end$$;
grant execute on function public.look_session_create(text, text, uuid) to authenticated;

-- Imposta/aggiorna la foto della cliente sulla sessione (path+url già caricati su storage dal client).
create or replace function public.look_session_set_selfie(p_session uuid, p_path text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.look_sessions set selfie_path = p_path, selfie_url = p_url, updated_at = now()
   where id = p_session and owner_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end$$;
grant execute on function public.look_session_set_selfie(uuid, text, text) to authenticated;

-- Cura una proposta (KEPT/DISCARDED) e/o segna la sessione come inviata.
create or replace function public.look_proposal_set_status(p_proposal uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('DRAFT','KEPT','DISCARDED') then raise exception 'bad_status'; end if;
  update public.look_proposals set status = p_status
   where id = p_proposal and owner_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end$$;
grant execute on function public.look_proposal_set_status(uuid, text) to authenticated;

create or replace function public.look_session_send(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok uuid; v_kept int;
begin
  select share_token into v_tok from public.look_sessions where id = p_session and owner_id = auth.uid();
  if v_tok is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_kept from public.look_proposals where session_id = p_session and status = 'KEPT';
  if v_kept = 0 then return jsonb_build_object('error','no_kept'); end if;
  update public.look_sessions set status = 'SENT', updated_at = now() where id = p_session;
  return jsonb_build_object('ok', true, 'token', v_tok, 'kept', v_kept);
end$$;
grant execute on function public.look_session_send(uuid) to authenticated;

-- ── RPC ANON: vista cliente per token (sola lettura delle proposte KEPT) ─────
create or replace function public.look_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s record; v_p record; v_studio text; v_logo text; v_color text; v_props jsonb;
begin
  if p_token is null then return jsonb_build_object('error','no_token'); end if;
  select * into v_s from public.look_sessions where share_token = p_token limit 1;
  if v_s.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_s.status <> 'SENT' then return jsonb_build_object('error','not_ready'); end if;
  select coalesce(nullif(business_name,''), full_name), brand_logo_url, brand_primary_color
    into v_studio, v_logo, v_color from public.profiles where id = v_s.owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'title', p.title, 'image_url', p.image_url, 'favorite', p.client_favorite)
           order by p.created_at), '[]'::jsonb)
    into v_props
  from public.look_proposals p where p.session_id = v_s.id and p.status = 'KEPT';

  return jsonb_build_object(
    'ok', true,
    'kind', v_s.kind,
    'client_label', v_s.client_label,
    'studio', v_studio, 'logo', v_logo, 'color', v_color,
    'proposals', v_props);
end$$;
grant execute on function public.look_get_by_token(uuid) to anon, authenticated;

-- La cliente segna la sua proposta preferita (una sola). Anon per token.
create or replace function public.look_set_favorite(p_token uuid, p_proposal uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s uuid;
begin
  select id into v_s from public.look_sessions where share_token = p_token and status = 'SENT' limit 1;
  if v_s is null then return jsonb_build_object('error','not_found'); end if;
  if not exists (select 1 from public.look_proposals where id = p_proposal and session_id = v_s and status = 'KEPT') then
    return jsonb_build_object('error','bad_proposal');
  end if;
  update public.look_proposals set client_favorite = false where session_id = v_s;
  update public.look_proposals set client_favorite = true where id = p_proposal;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.look_set_favorite(uuid, uuid) to anon, authenticated;
