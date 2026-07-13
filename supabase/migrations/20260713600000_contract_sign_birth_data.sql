-- Firma cliente: il cliente verifica/corregge i suoi dati (inclusi data e luogo di nascita, dedotti dal
-- codice fiscale lato client) e alla firma questi entrano NEL contratto come blocco "Dati del Committente
-- (verificato in fase di firma)". contract_sign_full guadagna 2 parametri (p_birth_date, p_birth_place) e
-- (ri)genera quel blocco deterministicamente dai dati confermati, così le correzioni si riflettono nel testo.
drop function if exists public.contract_sign_full(uuid, text, text, text, text, text, text, boolean, boolean);

create or replace function public.contract_sign_full(
  p_token uuid, p_signer_name text, p_signer_fiscal text,
  p_doc_type text default null, p_doc_number text default null, p_doc_issued_by text default null,
  p_signature_data_url text default null, p_consent_terms boolean default false, p_consent_privacy boolean default false,
  p_birth_date date default null, p_birth_place text default null)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid; v_quote uuid; v_acc quote_acceptances%rowtype;
  v_status contract_status; v_revoked timestamptz; v_expires timestamptz; v_sections_src jsonb;
  v_name text; v_fiscal text; v_dtype text; v_dnum text; v_dissued text;
  v_bdate date; v_bplace text; v_doclabel text; v_block_body text; v_sections jsonb;
  c_heading constant text := 'Dati del Committente (verificato in fase di firma)';
begin
  if not (coalesce(p_consent_terms, false) and coalesce(p_consent_privacy, false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signature_data_url), '') = '' then
    raise exception 'signature_required';
  end if;

  select quote_id, status, token_revoked_at, access_token_expires_at, sections
    into v_quote, v_status, v_revoked, v_expires, v_sections_src
    from public.contracts where access_token = p_token;
  if not found then return false; end if;
  if v_revoked is not null then raise exception 'token_revoked'; end if;
  if v_expires is not null and v_expires < now() then raise exception 'token_expired'; end if;
  if v_status = 'FIRMATO' then return true; end if;   -- idempotente

  if v_quote is not null then
    select * into v_acc from public.quote_acceptances where quote_id = v_quote order by accepted_at desc limit 1;
  end if;

  v_name    := coalesce(nullif(trim(p_signer_name), ''),    v_acc.signer_name);
  v_fiscal  := coalesce(nullif(trim(p_signer_fiscal), ''),  v_acc.client_fiscal_code);
  v_dtype   := coalesce(nullif(trim(p_doc_type), ''),       v_acc.doc_type);
  v_dnum    := coalesce(nullif(trim(p_doc_number), ''),     v_acc.doc_number);
  v_dissued := coalesce(nullif(trim(p_doc_issued_by), ''),  v_acc.doc_issued_by);
  v_bdate   := p_birth_date;
  v_bplace  := nullif(trim(p_birth_place), '');
  if coalesce(trim(v_name), '') = '' then raise exception 'signer_name_required'; end if;

  -- Etichetta leggibile del documento
  v_doclabel := case v_dtype
    when 'CARTA_IDENTITA' then 'Carta d''identità' when 'PATENTE' then 'Patente'
    when 'PASSAPORTO' then 'Passaporto' else v_dtype end;

  -- Blocco dati committente confermati (deterministico dai dati verificati dal cliente)
  v_block_body := 'Nome e cognome: ' || coalesce(v_name, '—');
  if coalesce(v_fiscal, '') <> '' then v_block_body := v_block_body || E'\n' || 'Codice fiscale: ' || v_fiscal; end if;
  if v_bdate is not null then v_block_body := v_block_body || E'\n' || 'Data di nascita: ' || to_char(v_bdate, 'DD/MM/YYYY'); end if;
  if coalesce(v_bplace, '') <> '' then v_block_body := v_block_body || E'\n' || 'Luogo di nascita: ' || v_bplace; end if;
  if coalesce(v_doclabel, '') <> '' then
    v_block_body := v_block_body || E'\n' || 'Documento: ' || v_doclabel
      || case when coalesce(v_dnum, '') <> '' then ' n. ' || v_dnum else '' end
      || case when coalesce(v_dissued, '') <> '' then ', rilasciato da ' || v_dissued else '' end;
  end if;

  -- Rimuovi un eventuale blocco precedente e ri-appendi quello aggiornato
  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_sections
    from jsonb_array_elements(coalesce(v_sections_src, '[]'::jsonb)) s
    where s->>'heading' is distinct from c_heading;
  v_sections := v_sections || jsonb_build_array(jsonb_build_object('heading', c_heading, 'type', 'CLAUSULE', 'body', v_block_body));

  update public.contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         client_fiscal_code = coalesce(nullif(trim(v_fiscal), ''), client_fiscal_code),
         sections = v_sections,
         signature_data = coalesce(signature_data, '{}'::jsonb) || jsonb_build_object(
            'name', v_name, 'fiscal_code', v_fiscal, 'doc_type', v_dtype,
            'doc_number', v_dnum, 'doc_issued_by', v_dissued,
            'birth_date', case when v_bdate is not null then to_char(v_bdate,'YYYY-MM-DD') else null end,
            'birth_place', v_bplace,
            'signature_image', p_signature_data_url,
            'consent_terms', p_consent_terms, 'consent_privacy', p_consent_privacy, 'at', now())
   where access_token = p_token and status in ('BOZZA', 'INVIATO')
   returning id into v_id;

  return v_id is not null;
end$function$;
revoke all on function public.contract_sign_full(uuid, text, text, text, text, text, text, boolean, boolean, date, text) from public;
grant execute on function public.contract_sign_full(uuid, text, text, text, text, text, text, boolean, boolean, date, text) to anon, authenticated;

-- TEST e2e (non-fatale, self-cleaning): firma con data/luogo nascita → contratto FIRMATO + blocco committente.
do $$
declare v_owner uuid; v_qid uuid; v_cid uuid; v_tok uuid := gen_random_uuid(); v_ok boolean;
        v_status text; v_has_block boolean;
begin
  select q.owner_id, q.id into v_owner, v_qid from public.quotes q
    where q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')
      and not exists (select 1 from public.contracts c where c.quote_id = q.id)
    order by q.created_at desc limit 1;
  if v_owner is null then raise notice 'TEST FIRMA-NASCITA: nessun preventivo idoneo, salto (funzione comunque creata)'; return; end if;
  begin
    insert into public.contracts (owner_id, quote_id, title, client_name, total_amount, status, access_token, sections)
      values (v_owner, v_qid, '__TEST_NASCITA__', 'Mario Rossi', 1000, 'INVIATO', v_tok,
              '[{"heading":"Premesse","body":"...","type":"CLAUSULE"}]'::jsonb)
      returning id into v_cid;
    v_ok := public.contract_sign_full(v_tok, 'Mario Rossi', 'RSSMRA80A01H501U', 'CARTA_IDENTITA', 'AB123',
              'Comune di Roma', 'data:image/png;base64,AAAA', true, true, date '1980-01-01', 'Roma (RM)');
    select status into v_status from public.contracts where id = v_cid;
    select exists(select 1 from jsonb_array_elements(sections) s
                  where s->>'heading' = 'Dati del Committente (verificato in fase di firma)'
                    and s->>'body' like '%Roma (RM)%' and s->>'body' like '%01/01/1980%')
      into v_has_block from public.contracts where id = v_cid;
    delete from public.contracts where id = v_cid;
    if v_ok and v_status = 'FIRMATO' and v_has_block then
      raise notice 'TEST FIRMA-NASCITA: OK — FIRMATO + blocco committente con data e luogo nascita';
    else
      raise notice 'TEST FIRMA-NASCITA: ESITO INATTESO ok=% status=% block=%', v_ok, v_status, v_has_block;
    end if;
  exception when others then
    if v_cid is not null then delete from public.contracts where id = v_cid; end if;
    raise notice 'TEST FIRMA-NASCITA: salto (%).', SQLERRM;
  end;
end $$;
