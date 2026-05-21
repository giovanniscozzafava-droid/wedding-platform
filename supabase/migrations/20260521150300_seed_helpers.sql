-- ============================================================================
-- Helper riservato al seed: crea utente auth + identity in modo idempotente.
-- Definito come migration (NON dentro seed.sql) perche` il parser del seed
-- Supabase CLI 2.x spezza male i delimitatori $$ multiriga.
-- ============================================================================
create or replace function seed_user(
  p_id       uuid,
  p_email    text,
  p_password text,
  p_meta     jsonb
) returns void
language plpgsql security definer set search_path = auth, public, extensions as $$
declare
  v_hashed text;
begin
  v_hashed := extensions.crypt(p_password, extensions.gen_salt('bf'));

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    v_hashed, now(),
    '{"provider":"email","providers":["email"]}'::jsonb, p_meta,
    now(), now(),
    '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email', p_id::text,
    now(), now(), now()
  ) on conflict do nothing;
end$$;
