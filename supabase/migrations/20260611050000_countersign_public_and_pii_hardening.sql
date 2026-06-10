-- ============================================================================
-- Controfirma dalla pagina pubblica del contratto (per TUTTI i professionisti:
-- owner WP e supplier) + HARDENING PII del payload pubblico.
-- ----------------------------------------------------------------------------
-- Rischio chiuso: contract_get_by_token è SECURITY DEFINER + eseguibile da ANON;
-- esponeva a CHIUNQUE avesse il link:
--   - numero documento d'identità + codice fiscale del CLIENTE (prefill);
--   - P.IVA, codice fiscale, indirizzo, PEC del PROFESSIONISTA (owner = to_jsonb
--     dell'intero profilo) — campi che la pagina pubblica non usa nemmeno.
-- Ora: owner = solo branding; prefill sensibile solo PRIMA della firma (a firma
-- avvenuta il form non si mostra più → niente PII nel payload).
-- ============================================================================

create or replace function public.contract_get_by_token(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_c contracts%rowtype; v_owner record; v_acc quote_acceptances%rowtype; v_prefill jsonb;
begin
  select * into v_c from contracts where access_token = p_token;
  if v_c.id is null then return null; end if;

  -- SOLO branding del professionista (niente dati fiscali nel payload pubblico)
  select full_name, business_name, brand_logo_url, brand_primary_color
    into v_owner from profiles where id = v_c.owner_id;

  -- Prefill del modulo di firma: SOLO prima della firma (dopo, il form non esiste
  -- più → non serve e non si espone nulla).
  if v_c.signed_at is null and v_c.status in ('BOZZA','INVIATO') then
    if v_c.quote_id is not null then
      select * into v_acc from quote_acceptances where quote_id = v_c.quote_id order by accepted_at desc limit 1;
    end if;
    v_prefill := jsonb_build_object(
      'client_name',        coalesce(nullif(trim(v_c.client_name), ''), v_acc.signer_name),
      'client_fiscal_code', coalesce(nullif(trim(v_c.client_fiscal_code), ''), v_acc.client_fiscal_code),
      'doc_type',           v_acc.doc_type,
      'doc_number',         v_acc.doc_number,
      'doc_issued_by',      v_acc.doc_issued_by,
      'from_quote',         (v_acc.id is not null)
    );
  else
    v_prefill := jsonb_build_object('from_quote', false);
  end if;

  return jsonb_build_object(
    'id', v_c.id, 'title', v_c.title, 'client_name', v_c.client_name,
    'event_date', v_c.event_date, 'total_amount', v_c.total_amount, 'status', v_c.status,
    'sections', v_c.sections, 'signed_at', v_c.signed_at,
    'signer_name', coalesce(v_c.signature_data->>'name', v_c.client_name),
    'countersign_at', v_c.countersign_at,
    'countersign_name', coalesce(v_c.countersign_data->>'name', v_owner.business_name, v_owner.full_name),
    'owner', jsonb_build_object(
       'full_name', v_owner.full_name, 'business_name', v_owner.business_name,
       'brand_logo_url', v_owner.brand_logo_url, 'brand_primary_color', v_owner.brand_primary_color),
    'prefill', v_prefill
  );
end$function$;

-- ── Eleggibilità alla controfirma SENZA esporre owner_id/supplier_id all'anon ─
-- Ritorna can_countersign + contract_id SOLO al professionista autenticato che è
-- owner o supplier del contratto (e solo se FIRMATO e non ancora controfirmato).
-- Per anon / non-parte → { can_countersign:false } e basta.
create or replace function public.contract_countersign_context(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_c contracts%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('can_countersign', false); end if;
  select * into v_c from contracts where access_token = p_token;
  if v_c.id is null then return jsonb_build_object('can_countersign', false); end if;
  if (v_c.owner_id = v_uid or v_c.supplier_id = v_uid)
     and v_c.status = 'FIRMATO' and v_c.signed_at is not null and v_c.countersign_at is null then
    return jsonb_build_object('can_countersign', true, 'contract_id', v_c.id);
  end if;
  return jsonb_build_object('can_countersign', false);
end$function$;

grant execute on function public.contract_countersign_context(uuid) to anon, authenticated;

-- Difesa in profondità: la controfirma è solo per utenti autenticati.
revoke execute on function public.countersign_contract(uuid, text, text) from anon;
