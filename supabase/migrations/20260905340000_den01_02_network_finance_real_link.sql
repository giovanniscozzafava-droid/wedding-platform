-- ============================================================================
-- DEN-01/DEN-02 (decisione presa da Giovanni: "2 A e fai test" — accendere il
-- cruscotto "Finanze rete", collegandolo prima ai libri contabili reali).
--
-- Prima: network_settlements (il conto capostipite<->fornitore) e
-- contract_payments/Fatture in Cloud (i soldi veri) erano due mondi separati,
-- nessuna FK/trigger li univa (DEN-01). Il cruscotto era spento (DEN-02).
--
-- Collegamento implementato SOLO per la direzione BUNDLE (capostipite deve al
-- fornitore, CAPOSTIPITE_OWES_SUPPLIER): è l'unica che ha già un vero
-- contratto+fattura dietro (il mini-contratto SUPPLIER_WP, intestato al
-- fornitore da stamattina). La direzione ITEMIZED (SUPPLIER_OWES_CAPOSTIPITE,
-- il fornitore deve il margine) non ha oggi un contratto/fattura equivalente
-- nello schema — richiederebbe costruire un flusso nuovo di fatturazione
-- fornitore->capostipite, fuori scope per questo giro: resta con la
-- marcatura manuale già esistente (mark_settlement_paid), invariata.
--
-- Meccanismo: quando si crea un mini-contratto SUPPLIER_WP, lo si collega al
-- settlement (quote_id+supplier_id) corrispondente. Quando le sue rate
-- (contract_payments) vengono segnate pagate — a mano o via riconciliazione
-- automatica Fatture in Cloud — il settlement collegato si aggiorna da solo,
-- con la stessa logica di stato di mark_settlement_paid (che resta
-- disponibile per i casi non collegati o per correzioni manuali).
-- ============================================================================

alter table public.network_settlements
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;
create index if not exists idx_network_settlements_contract on public.network_settlements(contract_id) where contract_id is not null;

-- --- create_supplier_contract: collega il settlement esistente al nuovo mini-contratto SUPPLIER_WP ---
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

  if not (v_entry.owner_id = auth.uid() or is_admin()) then
    if p_supplier_id <> auth.uid()
      or v_entry.quote_id is null
      or not exists (
        select 1 from quote_items qi
        where qi.quote_id = v_entry.quote_id and qi.supplier_id = p_supplier_id
      )
    then
      raise exception 'forbidden';
    end if;
  end if;

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

  select coalesce(total_client_selected, 0) > 0 into v_has_sel from quotes where id = v_entry.quote_id;
  select coalesce(sum(case when p_party_kind = 'SUPPLIER_WP' then qi.line_cost else qi.line_client end), 0)
    into v_amount
    from quote_items qi join calendar_entries ce on ce.quote_id = qi.quote_id
   where ce.id = p_entry_id and qi.supplier_id = p_supplier_id
     and (case when coalesce(v_has_sel,false) then qi.client_decision = 'ACCETTATO'
               else qi.client_decision <> 'RIFIUTATO' end);

  if p_party_kind = 'SUPPLIER_WP' then
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

  -- DEN-01: collega il settlement esistente (se c'è) a questo mini-contratto,
  -- così le sue rate potranno riconciliarlo in automatico.
  if p_party_kind = 'SUPPLIER_WP' and v_entry.quote_id is not null then
    update network_settlements
       set contract_id = v_row.id
     where quote_id = v_entry.quote_id
       and supplier_id = p_supplier_id
       and direction = 'CAPOSTIPITE_OWES_SUPPLIER'
       and contract_id is null;
  end if;

  return v_row;
end$$;

grant execute on function create_supplier_contract(uuid, uuid, text, uuid, text) to authenticated;

-- --- Riconciliazione automatica: contract_payments pagate -> network_settlements ---
create or replace function tg_reconcile_network_settlement_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settlement_id uuid;
  v_amount_due numeric(12,2);
  v_paid_sum numeric(12,2);
begin
  select id, amount_due into v_settlement_id, v_amount_due
    from network_settlements where contract_id = new.contract_id;
  if v_settlement_id is null then return new; end if;

  select coalesce(sum(coalesce(paid_amount, amount)), 0) into v_paid_sum
    from contract_payments where contract_id = new.contract_id and paid = true;

  update network_settlements
     set amount_paid = least(v_amount_due, v_paid_sum),
         status = case when v_paid_sum >= v_amount_due and v_amount_due > 0 then 'SALDATO'
                       when v_paid_sum > 0 then 'PARZIALE' else 'MATURATO' end,
         updated_at = now()
   where id = v_settlement_id;

  return new;
end$$;

drop trigger if exists trg_reconcile_network_settlement on contract_payments;
create trigger trg_reconcile_network_settlement
  after update of paid, paid_amount on contract_payments
  for each row execute function tg_reconcile_network_settlement_from_payments();

-- --- Cruscotto: espone anche contract_id (per un futuro badge "collegato a fattura") ---
create or replace function public.network_finance_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not public.feature_enabled('network_finance') then return jsonb_build_object('error','disabled'); end if;
  return jsonb_build_object(
    'ok', true,
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'quote_id', s.quote_id, 'entry_id', s.entry_id,
        'supplier_id', s.supplier_id,
        'supplier', coalesce(p.business_name, p.full_name),
        'direction', s.direction,
        'amount_due', s.amount_due, 'amount_paid', s.amount_paid,
        'residuo', round(s.amount_due - s.amount_paid, 2),
        'status', s.status,
        'contract_id', s.contract_id,
        'quote_title', q.title, 'event_date', q.event_date
      ) order by s.status, q.event_date nulls last)
      from public.network_settlements s
      join public.profiles p on p.id = s.supplier_id
      join public.quotes q on q.id = s.quote_id
      where s.capostipite_id = v_uid
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'da_pagare',       coalesce(sum(amount_due - amount_paid) filter (where direction = 'CAPOSTIPITE_OWES_SUPPLIER'), 0),
        'da_incassare',    coalesce(sum(amount_due - amount_paid) filter (where direction = 'SUPPLIER_OWES_CAPOSTIPITE'), 0),
        'maturato_totale', coalesce(sum(amount_due), 0),
        'saldato_totale',  coalesce(sum(amount_paid), 0)
      ) from public.network_settlements where capostipite_id = v_uid
    )
  );
end$$;
grant execute on function public.network_finance_overview() to authenticated;

-- --- Accensione del cruscotto ---
update public.feature_flags set enabled = true where key = 'network_finance';
