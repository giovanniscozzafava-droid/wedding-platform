-- ============================================================================
-- WP/Location invita un altro WP/Location nel network
-- ============================================================================
-- Riusa la tabella supplier_invites aggiungendo target_role. Quando target_role
-- e' WEDDING_PLANNER o LOCATION, l'utente che accetta NON diventa fornitore
-- e NON crea una collaboration: crea invece una riga in `referrals` (referrer
-- = chi invita, referee = chi accetta), che alimenta il referral system
-- esistente per generare rewards.
--
-- Minimal slice (opzione C):
--  1) altera supplier_invites
--  2) aggiorna handle_new_auth_user per gestire target_role
--  3) nuova RPC wp_invite_capostipite() che inserisce l'invito + ritorna riga
--
-- Nessuna modifica all'Edge function invite-supplier: per ora il link e'
-- generato lato client e copiato manualmente (la slice non tocca email).
-- ============================================================================

-- 1) Colonna target_role
alter table public.supplier_invites
  add column if not exists target_role text not null default 'FORNITORE'
    check (target_role in ('FORNITORE','WEDDING_PLANNER','LOCATION'));

create index if not exists idx_supplier_invites_target_role
  on public.supplier_invites(target_role);

-- 2) Aggiorna handle_new_auth_user per onorare target_role
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role        user_role;
  v_subrole     text;
  v_full        text;
  v_invite      supplier_invites%rowtype;
  v_token_text  text;
  v_invite_role user_role;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';

  -- Se metadata contiene invite_token valido per supplier_invites,
  -- forza role secondo target_role dell'invito (default FORNITORE per backcompat).
  if v_token_text is not null then
    select * into v_invite from public.supplier_invites
      where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
      limit 1;
    if found then
      v_invite_role := v_invite.target_role::user_role;
      v_role := v_invite_role;
      if v_subrole is null and v_invite.subrole_hint is not null then
        v_subrole := v_invite.subrole_hint;
      end if;
    end if;
  end if;

  insert into public.profiles (id, role, subrole, full_name)
  values (new.id, v_role, v_subrole, v_full)
  on conflict (id) do nothing;

  -- Branching post-creazione invito
  if v_invite.id is not null then
    if v_invite.target_role = 'FORNITORE' then
      -- Comportamento storico: crea collaboration PENDING capostipite ↔ fornitore
      insert into public.collaborations (capostipite_id, fornitore_id, status)
      values (v_invite.capostipite_id, new.id, 'PENDING')
      on conflict (capostipite_id, fornitore_id) do nothing;
    else
      -- WP/LOCATION invitata da altra WP/LOCATION: crea referral per rewards
      insert into public.referrals (referrer_id, referee_id, referee_role, source)
      values (v_invite.capostipite_id, new.id, v_invite_role, 'wp_invite_link')
      on conflict (referee_id) do nothing;
    end if;

    update public.supplier_invites
      set status = 'ACCEPTED', accepted_at = now()
      where id = v_invite.id;
  end if;

  return new;
end$$;

-- 3) RPC: WP/Location invita un altro WP/Location
-- Ritorna la riga di supplier_invites con token utilizzabile per costruire il link.
create or replace function public.wp_invite_capostipite(
  p_email text,
  p_target_role text default 'WEDDING_PLANNER',
  p_message text default null,
  p_subrole_hint text default null
)
returns supplier_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_existing    supplier_invites%rowtype;
  v_new         supplier_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  -- Verifica che il chiamante sia un capostipite (WP/Location)
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    raise exception 'only_capostipite_can_invite';
  end if;

  -- target_role permesso (no FORNITORE qui, usa invite-supplier)
  if p_target_role not in ('WEDDING_PLANNER','LOCATION') then
    raise exception 'invalid_target_role';
  end if;

  -- Idempotenza: se gia' esiste invito PENDING dallo stesso owner per stessa email
  select * into v_existing from public.supplier_invites
    where email = lower(p_email)
      and capostipite_id = auth.uid()
      and status = 'PENDING'
      and expires_at > now()
    limit 1;
  if v_existing.id is not null then
    return v_existing;
  end if;

  insert into public.supplier_invites (
    email, capostipite_id, target_role, subrole_hint, message
  ) values (
    lower(p_email), auth.uid(), p_target_role, p_subrole_hint, p_message
  )
  returning * into v_new;

  return v_new;
end$$;

revoke all on function public.wp_invite_capostipite(text, text, text, text) from public;
grant execute on function public.wp_invite_capostipite(text, text, text, text) to authenticated;

comment on function public.wp_invite_capostipite(text, text, text, text) is
  'WP/Location invita un altro capostipite. Crea row in supplier_invites con target_role. '
  'L''accettazione (handle_new_auth_user) creera'' un referral per generare rewards.';

-- 3b) RPC pubblica: risolve invito capostipite via token (anon-callable, per la pagina accept)
create or replace function public.resolve_capostipite_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_capo profiles%rowtype;
begin
  select * into v_invite from public.supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
      and target_role in ('WEDDING_PLANNER','LOCATION')
    limit 1;
  if not found then
    return jsonb_build_object('error', 'invito non valido o scaduto');
  end if;

  select * into v_capo from public.profiles where id = v_invite.capostipite_id;

  return jsonb_build_object(
    'email', v_invite.email,
    'target_role', v_invite.target_role,
    'subrole_hint', v_invite.subrole_hint,
    'message', v_invite.message,
    'expires_at', v_invite.expires_at,
    'capo_name', coalesce(v_capo.business_name, v_capo.full_name)
  );
end$$;

grant execute on function public.resolve_capostipite_invite(uuid) to anon, authenticated;

-- 4) Adatta accept_supplier_invite per coprire anche WP target
-- (idempotente; se gia' definita la sovrascriviamo)
create or replace function public.accept_supplier_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite supplier_invites%rowtype;
begin
  if auth.uid() is null then return false; end if;

  select * into v_invite from public.supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return false; end if;

  if v_invite.target_role = 'FORNITORE' then
    insert into public.collaborations (capostipite_id, fornitore_id, status)
    values (v_invite.capostipite_id, auth.uid(), 'PENDING')
    on conflict (capostipite_id, fornitore_id) do nothing;
  else
    insert into public.referrals (referrer_id, referee_id, referee_role, source)
    values (v_invite.capostipite_id, auth.uid(), v_invite.target_role::user_role, 'wp_invite_link')
    on conflict (referee_id) do nothing;
  end if;

  update public.supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return true;
end$$;
