-- ============================================================================
-- Legal #1 (ALTO): _addendum_build calcolava il "nuovo corrispettivo" come somma
-- GREZZA dei line_client accettati (v_sub_sel), mentre v_base = contract.total_amount
-- è il totale del MOTORE (total_client_selected: sconto% globale + sconto€ pro-quota
-- + maggiorazione + trasferta). Le due basi erano diverse → delta sbagliato: con uno
-- sconto totale del 10% l'addendum "annullava" lo sconto (+delta fantasma), con la
-- trasferta lo azzerava. Fix: v_new_total dal motore (total_client_selected, fallback
-- total_client), coerente con v_base. v_items resta l'elenco voci accettate/rifiutate.
-- ============================================================================

create or replace function public._addendum_build(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_contract record; v_base numeric; v_new_total numeric; v_delta numeric;
  v_items jsonb; v_add_id uuid; v_token uuid; v_num int; v_body text; v_date_fmt text;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('created', false, 'reason','not_found'); end if;

  select id, total_amount, created_at, title into v_contract
    from public.contracts where quote_id = p_quote_id and status = 'FIRMATO'
    order by signed_at desc nulls last, created_at desc limit 1;
  if v_contract.id is null then return jsonb_build_object('created', false, 'reason','no_signed_contract'); end if;

  v_base := coalesce(v_contract.total_amount,0)
          + coalesce((select sum(amount_delta) from public.contract_addendums
                       where contract_id = v_contract.id and status='FIRMATO'),0);

  -- #1: nuovo totale dal MOTORE (stessa base di v_base/contract.total_amount).
  select case when coalesce(total_client_selected,0) > 0 then total_client_selected else total_client end
    into v_new_total from public.quotes where id = p_quote_id;

  select coalesce(jsonb_agg(jsonb_build_object('name', name_snapshot, 'qty', quantity,
           'line_client', line_client, 'decision', client_decision)
           order by sort_order, created_at) filter (where client_decision in ('ACCETTATO','RIFIUTATO')), '[]'::jsonb)
    into v_items
    from public.quote_items where quote_id = p_quote_id;

  v_delta := v_new_total - v_base;
  if abs(v_delta) < 0.01 then return jsonb_build_object('created', false, 'reason','no_change'); end if;

  v_date_fmt := to_char(v_contract.created_at, 'DD/MM/YYYY');
  v_body :=
    'Con il presente atto integrativo le parti concordano la modifica dell''oggetto e del corrispettivo del contratto "'
    || coalesce(v_contract.title,'Contratto') || '" del ' || v_date_fmt || '.' || chr(10) || chr(10)
    || 'Nuovo corrispettivo complessivo concordato: € ' || public.fmt_eur_it(v_new_total) || '.' || chr(10)
    || 'Variazione rispetto al precedente accordo: € ' || public.fmt_eur_it(v_delta) || '.' || chr(10) || chr(10)
    || 'Resta fermo e invariato ogni altro patto e condizione del contratto originario.';

  select id into v_add_id from public.contract_addendums
   where contract_id = v_contract.id and status in ('BOZZA','INVIATO')
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set quote_id = p_quote_id, title='Addendum al contratto', body = v_body, amount_delta = v_delta,
           service_changes = jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
           access_token = gen_random_uuid(), access_token_expires_at = now() + interval '30 days',
           status='BOZZA', updated_at = now()
     where id = v_add_id returning access_token into v_token;
  else
    select coalesce(max(addendum_number),0)+1 into v_num from public.contract_addendums where contract_id = v_contract.id;
    insert into public.contract_addendums(contract_id, quote_id, addendum_number, status, title, body,
      amount_delta, service_changes, created_by, access_token, access_token_expires_at)
    values (v_contract.id, p_quote_id, v_num, 'BOZZA', 'Addendum al contratto', v_body, v_delta,
      jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
      v_owner, gen_random_uuid(), now() + interval '30 days')
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id, 'token', v_token, 'amount_delta', v_delta);
end$$;
