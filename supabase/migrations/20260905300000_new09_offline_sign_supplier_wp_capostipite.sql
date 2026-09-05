-- ============================================================================
-- NEW-09 (regressione del fix di stamattina sull'intestazione del mini-
-- contratto SUPPLIER_WP): "Firma di persona" resta visibile in "Contratti
-- rete" anche per i contratti SUPPLIER_WP, ma da quando owner_id è il
-- fornitore (non più il capostipite), sign_contract_offline rifiutava il
-- capostipite con 'not_authorized' — bottone morto per quel caso specifico.
-- Fix: per un contratto SUPPLIER_WP, anche il capostipite (owner dell'evento)
-- può firmarlo di persona, non solo il fornitore/owner_id.
-- ============================================================================

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

  -- Owner del contratto, ADMIN, oppure — per un mini-contratto SUPPLIER_WP —
  -- anche il capostipite (owner dell'evento collegato): è parte legittima di
  -- quel contratto anche se non ne è owner_id (il creditore è il fornitore).
  if v_contract.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
     and not (
       v_contract.party_kind = 'SUPPLIER_WP'
       and exists (
         select 1 from public.calendar_entries ce
          where ce.id = v_contract.entry_id and ce.owner_id = v_uid
       )
     )
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
