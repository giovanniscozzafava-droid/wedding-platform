-- REGRESSIONE SICUREZZA (stessa classe di quote_get_by_token): contract_get_by_token è SECURITY
-- DEFINER + eseguibile da ANON e leggeva il contratto con `where access_token = p_token` SENZA
-- controllare la REVOCA. contract_sign_by_token (scrittura) controlla `token_revoked_at is null`, ma
-- la lettura no → un link di contratto REVOCATO dal professionista restava leggibile (contratto =
-- nome cliente, data, importo, testo integrale delle clausole, nome firmatario). Aggiungiamo il
-- check di revoca al lookup. (Non tocchiamo la scadenza per non rompere la vista "firmato" dopo la
-- firma; il resto della funzione — hardening PII del payload, prefill solo pre-firma — resta identico.)

create or replace function public.contract_get_by_token(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_c contracts%rowtype; v_owner record; v_acc quote_acceptances%rowtype; v_prefill jsonb;
begin
  select * into v_c from contracts where access_token = p_token and token_revoked_at is null;
  if v_c.id is null then return null; end if;

  select full_name, business_name, brand_logo_url, brand_primary_color
    into v_owner from profiles where id = v_c.owner_id;

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
