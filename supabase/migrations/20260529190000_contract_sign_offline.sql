-- ============================================================================
-- Fase C — Contratto firmabile di persona (offline)
-- ============================================================================
-- Stesso modus operandi del preventivo: il contratto puo' essere firmato
-- online (token + signature canvas) OPPURE di persona col cliente, e il WP
-- carica il PDF cartaceo scannerizzato + segna i dati del firmatario.
--
-- Aggiunge colonne tracking offline + RPC sign_contract_offline.
-- Riusa contract_status.FIRMATO (no nuovi stati).
-- ============================================================================

alter table public.contracts
  add column if not exists signed_offline             boolean not null default false,
  add column if not exists signed_offline_at          timestamptz,
  add column if not exists signed_offline_pdf_url     text,
  add column if not exists signed_offline_signer_name text,
  add column if not exists signed_offline_notes       text;

comment on column public.contracts.signed_offline is
  'true se il contratto e'' stato firmato di persona col cliente (no flow online).';
comment on column public.contracts.signed_offline_pdf_url is
  'URL del PDF cartaceo scannerizzato (storage o link esterno).';

create or replace function public.sign_contract_offline(
  p_contract_id    uuid,
  p_signer_name    text,
  p_signer_fiscal  text default null,
  p_pdf_url        text default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_contract contracts%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('error','auth_required');
  end if;

  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null then
    return jsonb_build_object('error','contract_not_found');
  end if;

  -- Solo owner (WP) o ADMIN possono firmare offline a nome del cliente.
  if v_contract.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
  then
    return jsonb_build_object('error','not_authorized');
  end if;

  if v_contract.status = 'FIRMATO'::contract_status then
    return jsonb_build_object('error','already_signed');
  end if;

  if v_contract.status = 'ANNULLATO'::contract_status then
    return jsonb_build_object('error','annullato');
  end if;

  if coalesce(trim(p_signer_name), '') = '' then
    return jsonb_build_object('error','signer_name_required');
  end if;

  update public.contracts
     set status                       = 'FIRMATO'::contract_status,
         signed_at                    = coalesce(signed_at, now()),
         signed_offline               = true,
         signed_offline_at            = now(),
         signed_offline_pdf_url       = p_pdf_url,
         signed_offline_signer_name   = trim(p_signer_name),
         signed_offline_notes         = p_notes,
         signature_data               = coalesce(signature_data, jsonb_build_object(
            'name', trim(p_signer_name),
            'fiscal_code', upper(coalesce(p_signer_fiscal, '')),
            'mode', 'offline',
            'at', now()
         ))
   where id = p_contract_id
     and status in ('BOZZA'::contract_status, 'INVIATO'::contract_status);

  if not found then
    return jsonb_build_object('error','transition_not_allowed');
  end if;

  return jsonb_build_object('ok', true, 'mode', 'offline');
end$$;

revoke all on function public.sign_contract_offline(uuid, text, text, text, text) from public;
grant execute on function public.sign_contract_offline(uuid, text, text, text, text) to authenticated;

comment on function public.sign_contract_offline(uuid, text, text, text, text) is
  'Fase C workflow: marca contratto FIRMATO di persona (no flow online). Solo owner/ADMIN, status BOZZA/INVIATO ammessi. Salva snapshot signer + PDF cartaceo opzionale.';
