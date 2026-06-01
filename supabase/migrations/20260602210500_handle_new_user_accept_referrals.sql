-- ============================================================================
-- handle_new_auth_user: legge anche accept_referrals dai metadati di signup
-- (scelta esplicita in creazione profilo: voglio essere suggerito da altri
-- fornitori riconoscendo un credito).
-- ============================================================================

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
  v_accept      boolean;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';
  v_accept  := coalesce((new.raw_user_meta_data->>'accept_referrals')::boolean, false);

  if v_token_text is not null then
    select * into v_invite from supplier_invites
      where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
      limit 1;
    if found then
      v_role := 'FORNITORE';
      if v_subrole is null then v_subrole := v_invite.subrole_hint; end if;
    end if;
  end if;

  insert into public.profiles (id, role, subrole, full_name, onboarding_complete, accept_referrals)
  values (new.id, v_role, v_subrole, v_full, (v_role = 'CLIENT'), v_accept)
  on conflict (id) do update
    set role     = excluded.role,
        subrole  = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name),
        accept_referrals = excluded.accept_referrals;

  return new;
end$$;
