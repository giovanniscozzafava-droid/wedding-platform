-- ============================================================================
-- FIX (denaro di rete capostipite <-> fornitore, richiesto da Giovanni 05/09):
-- "fornitore e capostipite devono tracciare i loro pagamenti e fatturazioni,
--  come farebbe un professionista nei confronti di un cliente."
--
-- Il mini-contratto SUPPLIER_WP (capostipite<->fornitore, sul costo pattuito)
-- aveva owner_id = capostipite. Ma è il FORNITORE il creditore (deve ricevere
-- il costo): con owner_id sbagliato, il motore rate+fattura gia' costruito
-- per il singolo professionista (contract_payments, Fatture in Cloud) non
-- puo' funzionare, perche' legge sempre l'owner_id del contratto per sapere
-- CHI fattura e con quale rateizzazione (pay_deposit_pct/pay_second_pct).
--
-- Fix: per SUPPLIER_WP, owner_id = fornitore (come per ogni altro contratto:
-- chi e' owner e' chi incassa), e i dati "cliente" del contratto diventano
-- quelli fiscali del CAPOSTIPITE (non piu' quelli della coppia, che qui non
-- e' parte: e' un rapporto interno capostipite<->fornitore). Cosi' ogni
-- fornitore puo' collegare la propria Fatture in Cloud e scegliere la propria
-- rateizzazione per fatturare il capostipite, esattamente come farebbe con un
-- cliente qualsiasi.
--
-- SUPPLIER_CLIENT resta invariato: owner_id = fornitore (gia' cosi'), dati
-- cliente = la coppia (gia' corretto, il fornitore fattura davvero la coppia).
-- ============================================================================

create or replace function create_supplier_contract(
  p_entry_id uuid, p_supplier_id uuid, p_party_kind text,
  p_template_id uuid default null, p_title text default null)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry calendar_entries%rowtype;
  v_priv  calendar_entries_private%rowtype;
  v_supplier profiles%rowtype;
  v_capo  profiles%rowtype;
  v_capo_email text;
  v_sections jsonb;
  v_title text;
  v_amount numeric(12,2);
  v_owner uuid;
  v_client_name text;
  v_client_email text;
  v_fiscal_code text;
  v_vat_number text;
  v_business_name text;
  v_address text;
  v_city text;
  v_zip text;
  v_province text;
  v_country text;
  v_sdi_code text;
  v_pec_email text;
  v_passage boolean;
  v_has_sel boolean;
  v_acc  quote_acceptances%rowtype;
  v_prev contracts%rowtype;
  v_row contracts%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not (p_party_kind in ('SUPPLIER_WP', 'SUPPLIER_CLIENT')) then raise exception 'invalid_party_kind'; end if;

  select * into v_entry from calendar_entries where id = p_entry_id;
  if v_entry.id is null then raise exception 'entry_not_found'; end if;
  select * into v_priv from calendar_entries_private where entry_id = p_entry_id;
  select * into v_supplier from profiles where id = p_supplier_id;
  if v_supplier.id is null then raise exception 'supplier_not_found'; end if;

  if v_entry.owner_id <> auth.uid() and p_supplier_id <> auth.uid() and not is_admin()
    then raise exception 'forbidden'; end if;

  -- Creditore = owner del contratto (come ovunque nel gestionale): in
  -- entrambi i casi e' il fornitore che deve ricevere il pagamento.
  v_owner := p_supplier_id;

  if p_template_id is not null then
    select sections, title into v_sections, v_title
      from supplier_contract_templates where id = p_template_id and fornitore_id = p_supplier_id;
    if v_sections is null then raise exception 'template_not_found_for_supplier'; end if;
  else
    v_sections := jsonb_build_array(
      jsonb_build_object('heading', 'Oggetto', 'body',
        case when p_party_kind = 'SUPPLIER_WP'
          then 'Il fornitore si impegna a fornire il servizio concordato per l''evento del ' || coalesce(to_char(v_entry.date_from, 'DD/MM/YYYY'), 'data da definire') || ', su mandato del wedding planner.'
          else 'Il fornitore si impegna a fornire il servizio concordato direttamente al committente per l''evento del ' || coalesce(to_char(v_entry.date_from, 'DD/MM/YYYY'), 'data da definire') || '.'
        end),
      jsonb_build_object('heading', 'Corrispettivo', 'body',
        'L''importo dovuto sarà quello definito nel preventivo allegato. Saldo entro la data dell''evento salvo diversa pattuizione.'),
      jsonb_build_object('heading', 'Obblighi del fornitore', 'body',
        'Garantire qualità professionale del servizio, puntualità, rispetto degli accordi presi.'),
      jsonb_build_object('heading', 'Recesso', 'body',
        'In caso di recesso oltre 90 giorni dall''evento, viene trattenuto il 30% dell''acconto. Entro 90 giorni, il 100%.')
    );
    v_title := coalesce(p_title, 'Contratto ' || case when p_party_kind = 'SUPPLIER_WP' then 'fornitore-WP' else 'fornitore-cliente' end);
  end if;

  -- Importo per il fornitore. SUPPLIER_WP -> COSTO (line_cost); SUPPLIER_CLIENT
  -- -> prezzo cliente (line_client). Solo voci vendute (fallback firma intera).
  select coalesce(total_client_selected, 0) > 0 into v_has_sel from quotes where id = v_entry.quote_id;
  select coalesce(sum(case when p_party_kind = 'SUPPLIER_WP' then qi.line_cost else qi.line_client end), 0)
    into v_amount
    from quote_items qi join calendar_entries ce on ce.quote_id = qi.quote_id
   where ce.id = p_entry_id and qi.supplier_id = p_supplier_id
     and (case when coalesce(v_has_sel,false) then qi.client_decision = 'ACCETTATO'
               else qi.client_decision <> 'RIFIUTATO' end);

  if p_party_kind = 'SUPPLIER_WP' then
    -- "Cliente" del mini-contratto = il capostipite stesso: rapporto interno
    -- capostipite<->fornitore, la coppia non è parte e i suoi dati non
    -- c'entrano qui (a differenza di prima, che li riusava per errore).
    select * into v_capo from profiles where id = v_entry.owner_id;
    select email into v_capo_email from auth.users where id = v_entry.owner_id;
    v_client_name    := coalesce(v_capo.business_name, v_capo.full_name);
    v_client_email   := v_capo_email;
    v_fiscal_code    := v_capo.fiscal_code;
    v_vat_number     := v_capo.vat_number;
    v_business_name  := coalesce(v_capo.business_legal_name, v_capo.business_name);
    v_address        := v_capo.address;
    v_city           := v_capo.city;
    v_zip            := v_capo.zip;
    v_province       := v_capo.province;
    v_country        := v_capo.country;
    v_sdi_code       := v_capo.sdi_code;
    v_pec_email      := v_capo.pec_email;
  else
    -- SUPPLIER_CLIENT: invariato, il fornitore fattura davvero la coppia.
    v_client_name  := coalesce(v_priv.client_name,  (select client_name  from quotes where id = v_entry.quote_id));
    v_client_email := coalesce(v_priv.client_email, (select client_email from quotes where id = v_entry.quote_id));

    v_passage := public.event_supplier_data_passage(p_entry_id, p_supplier_id);
    if v_passage and v_entry.quote_id is not null then
      select * into v_acc from quote_acceptances where quote_id = v_entry.quote_id order by accepted_at desc nulls last limit 1;
    end if;
    if v_passage then
      select * into v_prev from contracts
        where entry_id = p_entry_id and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
        order by created_at desc limit 1;
    end if;

    v_fiscal_code    := coalesce(v_acc.client_fiscal_code,   v_prev.client_fiscal_code);
    v_vat_number     := coalesce(v_acc.client_vat_number,    v_prev.client_vat_number);
    v_business_name  := coalesce(v_acc.client_business_name, v_prev.client_business_name);
    v_address        := coalesce(v_acc.client_address,       v_prev.client_address);
    v_city           := coalesce(v_acc.client_city,          v_prev.client_city);
    v_zip            := coalesce(v_acc.client_zip,           v_prev.client_zip);
    v_province       := coalesce(v_acc.client_province,      v_prev.client_province);
    v_country        := coalesce(v_acc.client_country,       v_prev.client_country);
    v_sdi_code       := coalesce(v_acc.client_sdi_code,      v_prev.client_sdi_code);
    v_pec_email      := coalesce(v_acc.client_pec_email,     v_prev.client_pec_email);
  end if;

  insert into contracts (
    owner_id, supplier_id, quote_id, entry_id, title,
    client_name, client_email, event_date, total_amount,
    client_fiscal_code, client_vat_number, client_business_name,
    client_address, client_city, client_zip, client_province, client_country,
    client_sdi_code, client_pec_email,
    sections, status, party_kind, template_id, access_token
  ) values (
    v_owner, p_supplier_id, v_entry.quote_id, p_entry_id, coalesce(p_title, v_title),
    v_client_name, v_client_email, v_entry.date_from, v_amount,
    v_fiscal_code, v_vat_number, v_business_name,
    v_address, v_city, v_zip, v_province, v_country,
    v_sdi_code, v_pec_email,
    v_sections, 'BOZZA', p_party_kind::contract_party_kind, p_template_id, gen_random_uuid()
  ) returning * into v_row;

  return v_row;
end$$;

grant execute on function create_supplier_contract(uuid, uuid, text, uuid, text) to authenticated;

-- Il capostipite (owner dell'evento) deve poter vedere/gestire anche i
-- contratti di rete di cui NON e' piu' owner_id (i SUPPLIER_WP, ora intestati
-- al fornitore). list_contracts_for_entry() è già security definer e non ne
-- risente, ma un accesso diretto alla tabella (RLS) ne aveva bisogno.
drop policy if exists "contracts_select_capostipite" on contracts;
create policy "contracts_select_capostipite" on contracts for select using (
  entry_id is not null and exists (
    select 1 from calendar_entries ce where ce.id = contracts.entry_id and ce.owner_id = auth.uid()
  )
);
