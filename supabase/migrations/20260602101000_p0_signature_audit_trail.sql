-- ============================================================================
-- P0 — signature_audit_trail immutabile (firme preventivi + contratti)
-- ----------------------------------------------------------------------------
-- Registro legale append-only e immutabile. Popolato automaticamente da:
--   • INSERT su quote_acceptances (accettazione firmata del preventivo)
--   • UPDATE contracts → FIRMATO (firma del contratto)
-- Numero documento mascherato; hash del documento conservato per integrità.
-- ============================================================================

-- Masking riusabile del numero documento (anche per P0-E)
create or replace function public.mask_doc_number(p text)
returns text language sql immutable as $$
  select case
    when p is null or length(trim(p)) = 0 then null
    when length(trim(p)) <= 4 then repeat('*', greatest(0, length(trim(p))-1)) || right(trim(p),1)
    else repeat('*', length(trim(p))-4) || right(trim(p),4)
  end
$$;

create table if not exists public.signature_audit_trail (
  id             bigint generated always as identity primary key,
  document_type  text not null check (document_type in ('quote','contract')),
  document_id    uuid not null,
  signer_name    text,
  signer_email   text,
  doc_type       text,
  doc_number_masked text,
  ip_address     text,
  user_agent     text,
  document_hash  text,
  signed_at      timestamptz not null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (document_type, document_id, signed_at)
);
create index if not exists idx_sig_audit_doc on public.signature_audit_trail(document_type, document_id);

-- Immutabilità
drop trigger if exists trg_sig_audit_no_update on public.signature_audit_trail;
create trigger trg_sig_audit_no_update before update on public.signature_audit_trail
  for each row execute function public.block_mutation_immutable();
drop trigger if exists trg_sig_audit_no_delete on public.signature_audit_trail;
create trigger trg_sig_audit_no_delete before delete on public.signature_audit_trail
  for each row execute function public.block_mutation_immutable();

-- Lockdown
alter table public.signature_audit_trail enable row level security;
revoke all on public.signature_audit_trail from anon, authenticated, public;

-- Lettura: owner del documento o admin
create or replace function public.read_signature_audit(p_document_type text, p_document_id uuid)
returns setof public.signature_audit_trail
language plpgsql stable security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then return; end if;
  if p_document_type = 'quote' then
    select owner_id into v_owner from public.quotes where id = p_document_id;
  elsif p_document_type = 'contract' then
    select owner_id into v_owner from public.contracts where id = p_document_id;
  end if;
  if not (public.is_admin() or v_owner = v_uid) then return; end if;
  return query select * from public.signature_audit_trail
    where document_type = p_document_type and document_id = p_document_id order by signed_at;
end$$;
grant execute on function public.read_signature_audit(text, uuid) to authenticated;

-- Popolamento da quote_acceptances
create or replace function public.sig_audit_from_quote_acceptance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.signature_audit_trail(document_type, document_id, signer_name, signer_email,
    doc_type, doc_number_masked, ip_address, user_agent, document_hash, signed_at, metadata)
  values ('quote', new.quote_id, new.signer_name, new.signer_email,
    new.doc_type, public.mask_doc_number(new.doc_number), new.ip_address, new.user_agent,
    new.quote_pdf_hash, coalesce(new.accepted_at, now()),
    jsonb_build_object('quote_revision', new.quote_revision))
  on conflict (document_type, document_id, signed_at) do nothing;
  return new;
end$$;
drop trigger if exists trg_sig_from_quote_accept on public.quote_acceptances;
create trigger trg_sig_from_quote_accept after insert on public.quote_acceptances
  for each row execute function public.sig_audit_from_quote_acceptance();

-- Popolamento da contracts → FIRMATO
create or replace function public.sig_audit_from_contract_sign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') then
    insert into public.signature_audit_trail(document_type, document_id, signer_name, signer_email,
      doc_type, doc_number_masked, document_hash, signed_at, metadata)
    values ('contract', new.id,
      coalesce(new.signature_data->>'name', new.client_name), new.client_email,
      new.signature_data->>'doc_type',
      public.mask_doc_number(coalesce(new.signature_data->>'fiscal_code', new.client_fiscal_code)),
      new.signature_data->>'pdf_hash', coalesce(new.signed_at, now()),
      jsonb_build_object('offline', coalesce(new.signed_offline, false)))
    on conflict (document_type, document_id, signed_at) do nothing;
  end if;
  return new;
end$$;
drop trigger if exists trg_sig_from_contract_sign on public.contracts;
create trigger trg_sig_from_contract_sign after update of status on public.contracts
  for each row execute function public.sig_audit_from_contract_sign();

comment on table public.signature_audit_trail is
  'Registro legale immutabile delle firme (preventivi + contratti). Popolato da trigger; numero documento mascherato; hash documento per integrità.';
