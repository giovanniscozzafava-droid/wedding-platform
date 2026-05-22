-- ============================================================================
-- Fix: l'invito fornitore deve essere accettato SOLO quando email_confirmed_at
--      passa da null a not null (utente ha effettivamente cliccato il link).
-- Prima: handle_new_auth_user marcava ACCEPTED gia` sul plain insert,
--        permettendo a chiunque sapesse l'email destinataria di iniziare il flow.
-- ============================================================================

-- 1. Trigger INSERT semplificato: crea solo il profile, niente collaboration.
create or replace function handle_new_auth_user()
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
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';

  if v_token_text is not null then
    select * into v_invite from supplier_invites
      where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
      limit 1;
    if found then
      v_role := 'FORNITORE';
      if v_subrole is null then v_subrole := v_invite.subrole_hint; end if;
    end if;
  end if;

  insert into public.profiles (id, role, subrole, full_name)
  values (new.id, v_role, v_subrole, v_full)
  on conflict (id) do update
    set role     = excluded.role,
        subrole  = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name);

  -- NIENTE collaboration / ACCEPTED qui: si fa solo dopo conferma email.
  return new;
end$$;

-- 2. Nuovo trigger AFTER UPDATE: scatta quando email_confirmed_at diventa not null.
create or replace function process_supplier_invite_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite      supplier_invites%rowtype;
  v_token_text  text;
begin
  -- Solo quando email_confirmed_at passa da null a not null
  if old.email_confirmed_at is not null then return new; end if;
  if new.email_confirmed_at is null then return new; end if;

  v_token_text := new.raw_user_meta_data->>'invite_token';
  if v_token_text is null then return new; end if;

  select * into v_invite from supplier_invites
    where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return new; end if;

  -- Match anche su email per coerenza con security model
  if lower(v_invite.email) <> lower(new.email) then return new; end if;

  insert into collaborations (capostipite_id, fornitore_id, status)
  values (v_invite.capostipite_id, new.id, 'PENDING')
  on conflict (capostipite_id, fornitore_id) do nothing;

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return new;
end$$;

drop trigger if exists trg_supplier_invite_on_confirm on auth.users;
create trigger trg_supplier_invite_on_confirm
  after update on auth.users
  for each row execute function process_supplier_invite_on_confirm();
