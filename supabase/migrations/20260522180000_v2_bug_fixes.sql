-- ============================================================================
-- Bug fixes audit v2:
-- 1. couple_accept_invite: verifica email per evitare token-hijacking
-- 2. supplier_invites: unique constraint solo su PENDING (partial index)
-- 3. handle_new_auth_user: aggiorna role su profile esistente se invito valido
-- 4. email case normalization su supplier_invites
-- ============================================================================

-- 1. SECURITY: couple_accept_invite verifica che email coincida -------------
create or replace function couple_accept_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member  wedding_couple_members%rowtype;
  v_email   text;
begin
  if auth.uid() is null then return false; end if;

  -- Email dell'auth user corrente
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return false; end if;

  select * into v_member from wedding_couple_members
    where invite_token = p_token and user_id is null
    limit 1;
  if not found then return false; end if;

  -- Verifica match email (case-insensitive)
  if lower(v_member.email) <> lower(v_email) then
    return false;
  end if;

  update wedding_couple_members
    set user_id = auth.uid(), accepted_at = now()
    where id = v_member.id;

  return true;
end$$;

-- 2. supplier_invites: rimuovi vecchio unique, aggiungi partial index -------
alter table supplier_invites drop constraint if exists supplier_invites_email_capostipite_id_status_key;
create unique index if not exists uq_supplier_invites_pending
  on supplier_invites (lower(email), capostipite_id)
  where status = 'PENDING';

-- 3. handle_new_auth_user: aggiorna role se profile già esiste con invito ---
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

  -- Insert oppure update se profile già esiste (caso ricorrente: re-invito)
  insert into public.profiles (id, role, subrole, full_name)
  values (new.id, v_role, v_subrole, v_full)
  on conflict (id) do update
    set role     = excluded.role,
        subrole  = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name);

  if v_invite.id is not null then
    insert into collaborations (capostipite_id, fornitore_id, status)
    values (v_invite.capostipite_id, new.id, 'PENDING')
    on conflict (capostipite_id, fornitore_id) do nothing;

    update supplier_invites
      set status = 'ACCEPTED', accepted_at = now()
      where id = v_invite.id;
  end if;

  return new;
end$$;

-- 4. Normalizza email lowercase su supplier_invites via trigger -------------
create or replace function supplier_invites_normalize_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end$$;

drop trigger if exists trg_supplier_invites_lowercase on supplier_invites;
create trigger trg_supplier_invites_lowercase
  before insert or update on supplier_invites
  for each row execute function supplier_invites_normalize_email();

-- 5. Backfill: normalizza le righe esistenti
update supplier_invites set email = lower(trim(email)) where email <> lower(trim(email));

-- 6. Backfill onboarding_complete=true per profili esistenti che hanno gia` attivita`.
--    Senza questo, il nuovo gate /onboarding redirige TUTTI gli utenti seed/storici.
--    Criterio: profile e` "completo" se ha business_name OPPURE
--    se e` proprietario di calendar_entries / quotes / ha collaborations ACTIVE
--    OPPURE se e` un COUPLE membro accettato.
update profiles set onboarding_complete = true
where onboarding_complete = false and (
  business_name is not null
  or exists (select 1 from calendar_entries where owner_id = profiles.id)
  or exists (select 1 from quotes where owner_id = profiles.id)
  or exists (select 1 from collaborations where capostipite_id = profiles.id or fornitore_id = profiles.id)
  or exists (select 1 from wedding_couple_members where user_id = profiles.id and accepted_at is not null)
);
