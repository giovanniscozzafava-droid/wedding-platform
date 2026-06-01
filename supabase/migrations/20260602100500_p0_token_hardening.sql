-- ============================================================================
-- P0 — Hardening token di azione (quotes + contracts)
-- ----------------------------------------------------------------------------
--  • token_hash (sha256 del token) → confronto per hash, niente plaintext-only
--  • token_revoked_at / token_consumed_at → revoca e monouso espliciti
--  • backfill hash su righe esistenti
--  • trigger di sync hash quando il token cambia
--  • rotate_access_token() → rigenera token (invalida il vecchio link)
--  • action_token_status() → stato del token (valid/revoked/expired/not_found)
--  • retrofit accept/reject/sign: rifiutano token revocati o scaduti + log
-- Strategia dual-read: si confronta ancora su access_token (plaintext) finché i
-- link già inviati scadono; il guard revoked/expired è additivo e non rompe i
-- link legittimi non scaduti.
-- ============================================================================

alter table public.quotes
  add column if not exists token_hash text,
  add column if not exists token_revoked_at timestamptz,
  add column if not exists token_consumed_at timestamptz;
alter table public.contracts
  add column if not exists token_hash text,
  add column if not exists token_revoked_at timestamptz,
  add column if not exists token_consumed_at timestamptz;

-- Backfill hash
update public.quotes
   set token_hash = encode(extensions.digest(access_token::text, 'sha256'), 'hex')
 where access_token is not null and token_hash is null;
update public.contracts
   set token_hash = encode(extensions.digest(access_token::text, 'sha256'), 'hex')
 where access_token is not null and token_hash is null;

-- Sync hash quando il token cambia (rotazione/insert)
create or replace function public.sync_token_hash()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.access_token is not null then
    new.token_hash := encode(extensions.digest(new.access_token::text, 'sha256'), 'hex');
  else
    new.token_hash := null;
  end if;
  return new;
end$$;

drop trigger if exists trg_quotes_token_hash on public.quotes;
create trigger trg_quotes_token_hash before insert or update of access_token on public.quotes
  for each row execute function public.sync_token_hash();
drop trigger if exists trg_contracts_token_hash on public.contracts;
create trigger trg_contracts_token_hash before insert or update of access_token on public.contracts
  for each row execute function public.sync_token_hash();

-- Stato del token (per UI/diagnostica)
create or replace function public.action_token_status(p_kind text, p_token uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rev timestamptz; v_exp timestamptz; v_found boolean := false;
begin
  if p_kind = 'quote' then
    select token_revoked_at, access_token_expires_at, true into v_rev, v_exp, v_found
      from public.quotes where access_token = p_token;
  elsif p_kind = 'contract' then
    select token_revoked_at, access_token_expires_at, true into v_rev, v_exp, v_found
      from public.contracts where access_token = p_token;
  else
    return 'invalid_kind';
  end if;
  if not coalesce(v_found,false) then return 'not_found'; end if;
  if v_rev is not null then return 'revoked'; end if;
  if v_exp is not null and v_exp <= now() then return 'expired'; end if;
  return 'valid';
end$$;
grant execute on function public.action_token_status(text, uuid) to anon, authenticated;

-- Rotazione token (solo owner del preventivo/contratto o admin)
create or replace function public.rotate_access_token(p_kind text, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_new uuid := gen_random_uuid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_kind = 'quote' then
    select owner_id into v_owner from public.quotes where id = p_id;
    if v_owner is null then return jsonb_build_object('error','not_found'); end if;
    if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
    update public.quotes
       set access_token = v_new, token_revoked_at = null, token_consumed_at = null,
           access_token_expires_at = now() + interval '14 days'
     where id = p_id;
  elsif p_kind = 'contract' then
    select owner_id into v_owner from public.contracts where id = p_id;
    if v_owner is null then return jsonb_build_object('error','not_found'); end if;
    if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
    update public.contracts
       set access_token = v_new, token_revoked_at = null, token_consumed_at = null,
           access_token_expires_at = now() + interval '7 days'
     where id = p_id;
  else
    return jsonb_build_object('error','invalid_kind');
  end if;
  perform public.log_access(p_kind || 's', p_id::text, 'WRITE', jsonb_build_object('op','rotate_token'));
  return jsonb_build_object('ok', true, 'new_token', v_new);
end$$;
grant execute on function public.rotate_access_token(text, uuid) to authenticated;

-- Revoca esplicita (es. trattativa chiusa) — owner/admin
create or replace function public.revoke_access_token(p_kind text, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_kind = 'quote' then
    select owner_id into v_owner from public.quotes where id = p_id;
  elsif p_kind = 'contract' then
    select owner_id into v_owner from public.contracts where id = p_id;
  else return jsonb_build_object('error','invalid_kind'); end if;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  if p_kind = 'quote' then update public.quotes set token_revoked_at = now() where id = p_id;
  else update public.contracts set token_revoked_at = now() where id = p_id; end if;
  perform public.log_access(p_kind || 's', p_id::text, 'WRITE', jsonb_build_object('op','revoke_token'));
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.revoke_access_token(text, uuid) to authenticated;

-- ── Retrofit dispositive: rifiutano token revocati o scaduti ────────────────
create or replace function quote_accept_by_token(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  update quotes
     set status = 'ACCETTATO',
         accepted_at = coalesce(accepted_at, now()),
         token_consumed_at = coalesce(token_consumed_at, now()),
         client_response_log = client_response_log || jsonb_build_object('event','accepted','at',now())
   where access_token = p_token
     and status in ('INVIATO','ACCETTATO')
     and token_revoked_at is null
     and (access_token_expires_at is null or access_token_expires_at > now())
   returning id into v_id;
  if v_id is not null then
    update calendar_entries set status = 'OPZIONATA', updated_at = now()
     where quote_id = v_id and status in ('IN_TRATTATIVA','OPZIONATA');
    perform public.log_access('quotes', v_id::text, 'TOKEN_USE', jsonb_build_object('op','accept'));
  end if;
  return v_id is not null;
end$$;
revoke all on function quote_accept_by_token(uuid) from public;
grant execute on function quote_accept_by_token(uuid) to anon, authenticated;

create or replace function quote_reject_by_token(p_token uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  update quotes
     set status = 'RIFIUTATO',
         rejected_at = coalesce(rejected_at, now()),
         rejection_reason = coalesce(p_reason,''),
         token_revoked_at = coalesce(token_revoked_at, now()),
         client_response_log = client_response_log || jsonb_build_object('event','rejected','at',now(),'reason',coalesce(p_reason,''))
   where access_token = p_token
     and status in ('INVIATO','RIFIUTATO')
     and token_revoked_at is null
     and (access_token_expires_at is null or access_token_expires_at > now())
   returning id into v_id;
  if v_id is not null then
    update calendar_entries set status = 'CANCELLATA', updated_at = now() where quote_id = v_id;
    perform public.log_access('quotes', v_id::text, 'TOKEN_USE', jsonb_build_object('op','reject'));
  end if;
  return v_id is not null;
end$$;
revoke all on function quote_reject_by_token(uuid, text) from public;
grant execute on function quote_reject_by_token(uuid, text) to anon, authenticated;

create or replace function contract_sign_by_token(p_token uuid, p_signer_name text, p_signer_fiscal text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  -- Idempotenza: già FIRMATO con stesso signer.
  select id into v_id from contracts
   where access_token = p_token and status = 'FIRMATO'
     and signature_data ->> 'fiscal_code' = p_signer_fiscal;
  if v_id is not null then return true; end if;

  update contracts
     set status = 'FIRMATO', signed_at = now(),
         token_consumed_at = coalesce(token_consumed_at, now()),
         signature_data = jsonb_build_object('name', p_signer_name, 'fiscal_code', p_signer_fiscal, 'at', now())
   where access_token = p_token
     and status in ('BOZZA','INVIATO')
     and token_revoked_at is null
     and (access_token_expires_at is null or access_token_expires_at > now())
   returning id into v_id;
  if v_id is not null then
    perform public.log_access('contracts', v_id::text, 'SIGN', jsonb_build_object('signer', p_signer_name));
  end if;
  return v_id is not null;
end$$;
revoke all on function contract_sign_by_token(uuid, text, text) from public;
grant execute on function contract_sign_by_token(uuid, text, text) to anon, authenticated;

comment on function public.rotate_access_token(text, uuid) is 'Rigenera il token di un preventivo/contratto (invalida il vecchio link). Owner o admin.';
