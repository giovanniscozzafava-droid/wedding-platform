-- ============================================================================
-- HOTFIX: contracts con status='FIRMATO' ma signed_at IS NULL o
-- signature_data IS NULL — 10/11 record in prod. Implicazioni legali:
-- contratti FIRMATO senza signature_data non hanno valore probatorio.
--
-- Cause: audit E2E con service-role hanno bypassato `contract_sign_by_token`
-- e inserito direttamente status='FIRMATO' senza popolare i campi.
--
-- Fix in 3 step:
--  1. Backfill: per contracts FIRMATO senza signed_at, set signed_at = updated_at
--     (best-effort temporale) + signature_data placeholder con flag legacy.
--  2. CHECK constraint: status='FIRMATO' DEVE avere signed_at e signature_data
--     non-null (defense in depth — qualsiasi UPDATE diretto fallirà).
--  3. Audit log: i record legacy mantengono signature_data.legacy=true così
--     si distinguono da firme reali.
-- ============================================================================

-- 1. Backfill audit di sicurezza prima
create table if not exists contracts_legacy_audit (
  id uuid,
  original_signed_at timestamptz,
  original_signature_data jsonb,
  updated_at timestamptz,
  patched_at timestamptz default now(),
  patched_signature_data jsonb
);
alter table contracts_legacy_audit disable row level security;

insert into contracts_legacy_audit (id, original_signed_at, original_signature_data, updated_at, patched_signature_data)
select id, signed_at, signature_data, updated_at,
       jsonb_build_object(
         'legacy', true,
         'note', 'Backfilled from audit residue — original sign flow bypassed',
         'patched_at', now()
       )
  from contracts
 where status = 'FIRMATO'
   and (signed_at is null or signature_data is null);

update contracts
   set signed_at = coalesce(signed_at, updated_at, now()),
       signature_data = coalesce(
         signature_data,
         jsonb_build_object(
           'legacy', true,
           'note', 'Backfilled from audit residue',
           'name', coalesce(client_name, 'N/D'),
           'at', coalesce(signed_at, updated_at, now())::text
         )
       )
 where status = 'FIRMATO'
   and (signed_at is null or signature_data is null);

-- 2. CHECK constraint defense in depth
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_firmato_requires_signature'
  ) then
    alter table contracts
      add constraint contracts_firmato_requires_signature
        check (
          status <> 'FIRMATO'
          or (signed_at is not null and signature_data is not null)
        );
  end if;
end$$;

comment on constraint contracts_firmato_requires_signature on contracts is
  'Defense in depth: ogni contracts.status=FIRMATO deve avere signed_at e signature_data popolati. Impedisce UPDATE diretti che bypassano contract_sign_by_token().';

-- ============================================================================
-- Bonus fix N-MEDIUM: quotes.status=ACCETTATO con accepted_at IS NULL (8/24)
-- ============================================================================
update quotes
   set accepted_at = coalesce(accepted_at, updated_at, now())
 where status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
   and accepted_at is null;

-- CHECK constraint anche su quotes
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_accettato_requires_accepted_at'
  ) then
    alter table quotes
      add constraint quotes_accettato_requires_accepted_at
        check (
          status not in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
          or accepted_at is not null
        );
  end if;
end$$;

-- ============================================================================
-- Bonus fix N-MEDIUM: 6 tabelle con updated_at ma senza trigger set_updated_at
-- ============================================================================
do $$
declare
  t text;
  tabs text[] := array['market_prices', 'service_presets', 'finance_offers',
                       'finance_applications', 'insurance_offers', 'insurance_policies'];
begin
  foreach t in array tabs loop
    -- check exists
    if exists (select 1 from information_schema.tables where table_name = t and table_schema = 'public') then
      execute format('drop trigger if exists trg_%I_updated_at on %I', t, t);
      execute format('create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
    end if;
  end loop;
end$$;

-- ============================================================================
-- Bonus fix N-LOW: event-documents bucket mime restrictions
-- ============================================================================
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'event-documents'
   and allowed_mime_types is null;
