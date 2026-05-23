-- ============================================================================
-- RPC pubbliche per flow invito link-only (no email):
-- 1. resolve_supplier_invite(token) -> {email, capostipite_name, subrole_hint, expires_at}
--    Pubblica (no auth): permette alla pagina /invito-fornitore di precompilare form.
-- 2. resolve_couple_invite(token) -> idem per coppia.
-- 3. claim_supplier_invite_after_signup() -> trigger AFTER UPDATE su auth.users
--    gia' presente; aggiungiamo variante che processa anche su INSERT con email_confirmed_at = NOW().
-- ============================================================================

create or replace function resolve_supplier_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_capo profiles%rowtype;
begin
  select * into v_invite from supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then
    return jsonb_build_object('error', 'invito non valido o scaduto');
  end if;

  select * into v_capo from profiles where id = v_invite.capostipite_id;

  return jsonb_build_object(
    'email', v_invite.email,
    'subrole_hint', v_invite.subrole_hint,
    'message', v_invite.message,
    'expires_at', v_invite.expires_at,
    'capo_name', coalesce(v_capo.business_name, v_capo.full_name)
  );
end$$;

grant execute on function resolve_supplier_invite(uuid) to anon, authenticated;

create or replace function resolve_couple_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member wedding_couple_members%rowtype;
  v_entry  calendar_entries%rowtype;
  v_owner  profiles%rowtype;
begin
  select * into v_member from wedding_couple_members
    where invite_token = p_token and user_id is null
    limit 1;
  if not found then
    return jsonb_build_object('error', 'invito non valido o gia` accettato');
  end if;

  select * into v_entry from calendar_entries where id = v_member.entry_id;
  if not found then
    return jsonb_build_object('error', 'matrimonio non trovato');
  end if;

  select * into v_owner from profiles where id = v_entry.owner_id;

  return jsonb_build_object(
    'email', v_member.email,
    'full_name', v_member.full_name,
    'role', v_member.role,
    'wedding_title', v_entry.title,
    'wedding_date', v_entry.date_from,
    'planner_name', coalesce(v_owner.business_name, v_owner.full_name)
  );
end$$;

grant execute on function resolve_couple_invite(uuid) to anon, authenticated;

-- RPC per accettare invito fornitore subito dopo signup (utente loggato).
create or replace function claim_supplier_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_user   auth.users%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into v_user from auth.users where id = auth.uid();
  if not found then return false; end if;

  select * into v_invite from supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return false; end if;

  -- Email match (case-insensitive)
  if lower(v_invite.email) <> lower(v_user.email) then return false; end if;

  -- Forza ruolo FORNITORE sul profile
  update profiles set role = 'FORNITORE',
                      subrole = coalesce(subrole, v_invite.subrole_hint)
    where id = auth.uid();

  -- Crea collaboration PENDING (idempotente)
  insert into collaborations (capostipite_id, fornitore_id, status)
  values (v_invite.capostipite_id, auth.uid(), 'PENDING')
  on conflict (capostipite_id, fornitore_id) do nothing;

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return true;
end$$;

grant execute on function claim_supplier_invite(uuid) to authenticated;
