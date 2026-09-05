-- ============================================================================
-- Fix dei bug reali confermati dai due collaudi "vasi comunicanti" del 05/09
-- (stress test a tappeto capostipite, metà 1: reclutamento/preventivo/markup/
-- blind; metà 2: contratto/addendum/ciclo vita evento/finanze rete). Ogni
-- verifica di "nessuna riga esistente viola il vincolo" è stata fatta prima
-- di applicare (query dirette in produzione), come per il giro di fix precedente.
-- ============================================================================

-- ── D-18 RIAPERTO: quotes_recalc_totals scalava il costo REALE delle voci
--    proprie (erogatore_e_capostipite, dove line_cost = line_client per
--    definizione: nessun ricarico) per il fattore di sconto cliente. Risultato:
--    uno sconto totale del 50% abbassava anche il "costo" mostrato (2500€ ->
--    2250€), gonfiando il margine apparente — esattamente ciò che la regola
--    D-18 originale (20260611030000) vietava. Fix: il costo reale non dipende
--    mai dallo sconto concesso al cliente, punto. Verificato dal vivo (§ audit).
create or replace function public.quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost_raw numeric; v_subtotal numeric; v_own_client numeric; v_cost_third numeric;
  v_client numeric; v_cost numeric; v_factor numeric; v_pct numeric; v_amt numeric;
  v_discounted numeric; v_owner uuid; v_date date; v_sur jsonb; v_sur_pct numeric;
  v_km numeric; v_dist jsonb; v_dist_amt numeric;
  v_sub_sel numeric; v_disc_sel numeric; v_client_sel numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0),
         coalesce(sum(line_client) filter (where client_decision = 'ACCETTATO'),0)
    into v_cost_raw, v_subtotal, v_own_client, v_sub_sel
    from public.quote_items where quote_id = p_quote_id;
  v_cost_third := v_cost_raw - v_own_client;

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0), owner_id, event_date, distance_km
    into v_pct, v_amt, v_owner, v_date, v_km
    from public.quotes where id = p_quote_id;

  -- prezzo cliente dopo lo SCONTO (base per il fattore di maggiorazione a valle)
  v_discounted := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_discounted < 0 then v_discounted := 0; end if;
  v_factor := case when v_subtotal > 0 then v_discounted / v_subtotal else 1 end;
  -- D-18: il costo (proprio + esterno) è quello REALE, mai scontato.
  v_cost := round(v_cost_third + v_own_client, 2);

  -- MAGGIORAZIONE % (weekend/stagione/date) sul prezzo scontato
  v_sur := public.quote_compute_surcharge(v_owner, v_date);
  v_sur_pct := coalesce((v_sur->>'percent')::numeric, 0);
  v_client := round(v_discounted * (1 + v_sur_pct / 100.0), 2);

  -- TRASFERTA (€/km oltre soglia): importo assoluto, puro markup lato cliente
  v_dist := public.quote_compute_distance_surcharge(v_owner, v_km);
  v_dist_amt := coalesce((v_dist->>'amount')::numeric, 0);
  v_client := round(v_client + v_dist_amt, 2);

  -- TOTALE SCELTO: stessa trasformazione ma sul subtotale delle voci accettate. 0 se nessuna scelta.
  if v_sub_sel <= 0 then
    v_client_sel := 0;
  else
    v_disc_sel := round(v_sub_sel * (1 - v_pct / 100.0) - coalesce(v_amt * v_sub_sel / nullif(v_subtotal, 0), 0), 2);
    if v_disc_sel < 0 then v_disc_sel := 0; end if;
    v_client_sel := round(round(v_disc_sel * (1 + v_sur_pct / 100.0), 2) + v_dist_amt, 2);
  end if;

  update public.quotes
     set subtotal_client   = v_subtotal,
         surcharge_percent  = v_sur_pct,
         surcharge_detail   = coalesce(v_sur->'detail', '[]'::jsonb),
         distance_surcharge = v_dist_amt,
         distance_detail    = coalesce(v_dist->'detail', '[]'::jsonb),
         total_cost         = v_cost,
         total_client       = v_client,
         total_client_selected = v_client_sel,
         margin_amount      = v_client - v_cost,
         margin_percent     = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at         = now()
   where id = p_quote_id;
end$$;

-- ── PREV-04 CORRETTO: il CHECK aggiunto il 05/09 dichiarava valido 0..1000,
--    ma quotes.default_markup_percent resta volutamente numeric(5,2) (nota
--    20260611030000: alter type bloccato da un trigger, fuori scope) —
--    quindi 1000 (il limite stesso dichiarato "valido") va in overflow
--    numerico invece di essere accettato o rifiutato con un errore pulito.
alter table quotes drop constraint if exists quotes_default_markup_pct_chk;
alter table quotes
  add constraint quotes_default_markup_pct_chk
  check (default_markup_percent >= 0 and default_markup_percent <= 999.99);

-- ── guest_count: nessun vincolo, accettava valori negativi o assurdi.
alter table quotes drop constraint if exists quotes_guest_count_chk;
alter table quotes
  add constraint quotes_guest_count_chk
  check (guest_count is null or (guest_count >= 0 and guest_count <= 100000));
alter table calendar_entries drop constraint if exists calendar_entries_guest_count_chk;
alter table calendar_entries
  add constraint calendar_entries_guest_count_chk
  check (guest_count is null or (guest_count >= 0 and guest_count <= 100000));

-- ── subrole: testo libero non filtrato, passava intatto (tag HTML inclusi)
--    attraverso quote_get_by_token (RPC pubblica anonima). Blocco alla radice.
alter table profiles drop constraint if exists profiles_subrole_no_html_chk;
alter table profiles
  add constraint profiles_subrole_no_html_chk
  check (subrole is null or subrole !~ '[<>]');

-- ── contract_payments.paid_amount: nessun controllo, accettava importi
--    assurdi (999999 su una rata da 72€) o negativi su una rata.
alter table contract_payments drop constraint if exists contract_payments_paid_amount_chk;
alter table contract_payments
  add constraint contract_payments_paid_amount_chk
  check (paid_amount is null or (paid_amount >= 0 and paid_amount <= amount));

-- ============================================================================
-- Addendum che si cannibalizzano a vicenda: _addendum_build e
-- _addendum_build_date_change riusavano indistintamente "l'ultimo BOZZA/
-- INVIATO", qualunque fosse il tipo. Un addendum di importo ancora in bozza
-- veniva azzerato (amount_delta=0, token invalidato) da un successivo
-- addendum di cambio data sullo stesso contratto, e viceversa. Fix: un tipo
-- esplicito, si riusa solo un addendum già dello stesso tipo.
-- ============================================================================
alter table contract_addendums add column if not exists kind text not null default 'AMOUNT';
alter table contract_addendums drop constraint if exists contract_addendums_kind_chk;
alter table contract_addendums
  add constraint contract_addendums_kind_chk check (kind in ('AMOUNT','DATE'));
update contract_addendums set kind = 'DATE' where date_change is not null and kind = 'AMOUNT';

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

  -- kind='AMOUNT': non tocca mai un addendum di cambio data ancora aperto.
  select id into v_add_id from public.contract_addendums
   where contract_id = v_contract.id and status in ('BOZZA','INVIATO') and kind = 'AMOUNT'
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set quote_id = p_quote_id, title='Addendum al contratto', body = v_body, amount_delta = v_delta,
           kind = 'AMOUNT', date_change = null,
           service_changes = jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
           access_token = gen_random_uuid(), access_token_expires_at = now() + interval '30 days',
           status='BOZZA', updated_at = now()
     where id = v_add_id returning access_token into v_token;
  else
    select coalesce(max(addendum_number),0)+1 into v_num from public.contract_addendums where contract_id = v_contract.id;
    insert into public.contract_addendums(contract_id, quote_id, addendum_number, status, kind, title, body,
      amount_delta, service_changes, created_by, access_token, access_token_expires_at)
    values (v_contract.id, p_quote_id, v_num, 'BOZZA', 'AMOUNT', 'Addendum al contratto', v_body, v_delta,
      jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
      v_owner, gen_random_uuid(), now() + interval '30 days')
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id, 'token', v_token, 'amount_delta', v_delta);
end$$;

create or replace function public._addendum_build_date_change(
  p_contract_id uuid, p_old_date date, p_new_date date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_contract record; v_add_id uuid; v_token uuid; v_num int; v_body text;
begin
  select id, title, entry_id, quote_id, owner_id into v_contract
    from public.contracts where id = p_contract_id and status = 'FIRMATO';
  if v_contract.id is null then return jsonb_build_object('created', false, 'reason','no_signed_contract'); end if;
  if p_old_date is not distinct from p_new_date or p_new_date is null then
    return jsonb_build_object('created', false, 'reason','no_change');
  end if;

  v_body :=
    'Con il presente atto integrativo le parti concordano lo spostamento della data dell''evento oggetto del contratto "'
    || coalesce(v_contract.title,'Contratto') || '".' || chr(10) || chr(10)
    || 'Data precedente: ' || coalesce(to_char(p_old_date, 'DD/MM/YYYY'), 'non specificata') || '.' || chr(10)
    || 'Nuova data concordata: ' || to_char(p_new_date, 'DD/MM/YYYY') || '.' || chr(10) || chr(10)
    || 'Resta fermo e invariato ogni altro patto e condizione del contratto originario, incluso il corrispettivo.';

  -- kind='DATE': non tocca mai un addendum di importo ancora aperto.
  select id into v_add_id from public.contract_addendums
   where contract_id = p_contract_id and status in ('BOZZA','INVIATO') and kind = 'DATE'
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set title = 'Addendum al contratto — cambio data',
           body = v_body,
           kind = 'DATE',
           amount_delta = 0,
           date_change = p_new_date,
           access_token = gen_random_uuid(),
           access_token_expires_at = now() + interval '30 days',
           status = 'BOZZA',
           updated_at = now()
     where id = v_add_id
     returning access_token into v_token;
  else
    select coalesce(max(addendum_number),0)+1 into v_num
      from public.contract_addendums where contract_id = p_contract_id;
    insert into public.contract_addendums(
      contract_id, quote_id, entry_id, addendum_number, status, kind, title, body,
      amount_delta, date_change, created_by, access_token, access_token_expires_at
    ) values (
      p_contract_id, v_contract.quote_id, v_contract.entry_id, v_num, 'BOZZA', 'DATE',
      'Addendum al contratto — cambio data', v_body,
      0, p_new_date, v_contract.owner_id, gen_random_uuid(), now() + interval '30 days'
    )
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id, 'token', v_token);
end$$;

-- ============================================================================
-- riprogramma_evento non trovava MAI il contratto principale sul percorso di
-- creazione reale più comune (QuoteEditorPage::handleCreateContract, corretto
-- in questo stesso giro per popolare entry_id anche lui): filtrava solo su
-- entry_id, che restava NULL. Risultato: niente aggiornamento data, niente
-- addendum, e il fornitore risultava doppiamente occupato (vecchia+nuova
-- data) perché il suo supplier_appointments restava ancorato alla vecchia
-- data — la stessa classe di bug che CICLO-01 doveva chiudere, riapparsa per
-- questo percorso parallelo. Fix a due livelli: (1) backfill dei 36 contratti
-- reali già orfani di entry_id (via quote_id -> calendar_entries, nessun
-- quote_id in produzione ha più di una calendar_entries, verificato); (2) la
-- funzione ora aggancia anche i contratti con entry_id NULL ma stesso
-- quote_id, come rete di sicurezza per qualunque altro percorso dimenticato.
-- ============================================================================
update public.contracts c
   set entry_id = ce.id
  from public.calendar_entries ce
 where c.entry_id is null
   and c.quote_id is not null
   and ce.quote_id = c.quote_id;

create or replace function public.riprogramma_evento(
  p_entry_id   uuid,
  p_nuova_data date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry            record;
  v_old_from         date;
  v_old_to           date;
  v_new_to           date;
  v_durata_giorni    int;
  v_cambio_id        uuid;
  v_fornitori_count  int := 0;
  v_fornitore        uuid;
  v_signed_contract  record;
  v_addendum_ids     uuid[] := array[]::uuid[];
  v_add_result       jsonb;
begin
  select id, owner_id, title, date_from, date_to, quote_id, evento_stato
    into v_entry
    from public.calendar_entries
   where id = p_entry_id
   for update;
  if not found then
    raise exception 'Evento % non trovato', p_entry_id using errcode = '42P01';
  end if;

  if not (v_entry.owner_id = auth.uid() or public.is_admin()) then
    raise exception 'Non autorizzato a riprogrammare questo evento' using errcode = '42501';
  end if;

  if v_entry.evento_stato in ('SVOLTO','ANNULLATO') then
    raise exception 'Impossibile riprogrammare un evento %', v_entry.evento_stato using errcode = '22023';
  end if;

  if p_nuova_data is null then
    raise exception 'Nuova data non valida' using errcode = '22023';
  end if;

  v_old_from := v_entry.date_from;
  v_old_to   := v_entry.date_to;
  v_durata_giorni := greatest(coalesce(v_old_to, v_old_from) - v_old_from, 0);
  v_new_to := p_nuova_data + v_durata_giorni;

  update public.calendar_entries
     set date_from = p_nuova_data,
         date_to   = v_new_to,
         updated_at = now()
   where id = p_entry_id;

  if v_entry.quote_id is not null and v_old_from is not null then
    delete from public.supplier_availability sa
     where sa.date = v_old_from
       and sa.status in ('BUSY','TENTATIVE')
       and sa.fornitore_id in (
         select distinct qi.supplier_id
           from public.quote_items qi
          where qi.quote_id = v_entry.quote_id
            and qi.supplier_id is not null
       );
  end if;

  if v_entry.quote_id is not null then
    update public.quotes
       set event_date = p_nuova_data,
           updated_at = now()
     where id = v_entry.quote_id;
  end if;

  -- Bugfix: aggancia anche i contratti con entry_id NULL ma stesso quote_id
  -- (percorso di creazione che non lo popolava, ora corretto anche a monte).
  update public.contracts
     set event_date = p_nuova_data,
         updated_at = now()
   where entry_id = p_entry_id
      or (entry_id is null and v_entry.quote_id is not null and quote_id = v_entry.quote_id);

  -- CICLO-09: un contratto già FIRMATO che cambia data genera un addendum
  -- (documento + nuova firma), invece di un aggiornamento silenzioso.
  if v_old_from is not null and v_old_from <> p_nuova_data then
    for v_signed_contract in
      select id from public.contracts
       where status = 'FIRMATO'
         and (entry_id = p_entry_id
              or (entry_id is null and v_entry.quote_id is not null and quote_id = v_entry.quote_id))
    loop
      v_add_result := public._addendum_build_date_change(v_signed_contract.id, v_old_from, p_nuova_data);
      if coalesce((v_add_result->>'created')::boolean, false) then
        v_addendum_ids := v_addendum_ids || (v_add_result->>'addendum_id')::uuid;
      end if;
    end loop;
  end if;

  if v_entry.quote_id is not null then
    for v_fornitore in
      select distinct qi.supplier_id
        from public.quote_items qi
       where qi.quote_id = v_entry.quote_id
         and qi.supplier_id is not null
    loop
      insert into public.notifiche(
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
        owner_della_mossa, stato, priorita
      ) values (
        v_fornitore, p_entry_id, 'RICONFERMA_DATA_EVENTO',
        'Riconferma disponibilita` per la nuova data',
        'L''evento "' || coalesce(v_entry.title, '') || '" e` stato riprogrammato al '
          || to_char(p_nuova_data, 'DD/MM/YYYY') || '. Conferma la tua disponibilita`.',
        '/supplier/availability?date=' || p_nuova_data::text,
        v_entry.owner_id, 'PENDING', 9
      )
      on conflict (destinatario_id, evento_id, tipo) do update
        set titolo = excluded.titolo,
            descrizione = excluded.descrizione,
            link_action = excluded.link_action,
            owner_della_mossa = excluded.owner_della_mossa,
            priorita = excluded.priorita,
            stato = 'PENDING',
            letto_il = null;
      v_fornitori_count := v_fornitori_count + 1;
    end loop;
  end if;

  insert into public.notifiche(
    destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
    owner_della_mossa, stato, priorita
  ) values (
    v_entry.owner_id, p_entry_id, 'EVENTO_RIPROGRAMMATO',
    'Evento riprogrammato',
    'Hai spostato "' || coalesce(v_entry.title, '') || '" al '
      || to_char(p_nuova_data, 'DD/MM/YYYY') || '. Notifica inviata a '
      || v_fornitori_count::text || ' fornitori per riconferma.',
    '/wedding/' || p_entry_id::text,
    v_entry.owner_id, 'PENDING', 7
  )
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione,
        link_action = excluded.link_action,
        priorita = excluded.priorita,
        stato = 'PENDING',
        letto_il = null;

  insert into public.eventi_cambiamento(entry_id, tipo, payload, eseguito_da, stato)
  values (
    p_entry_id, 'RIPROGRAMMA',
    jsonb_build_object(
      'old_date_from', v_old_from,
      'old_date_to', v_old_to,
      'new_date_from', p_nuova_data,
      'new_date_to', v_new_to,
      'fornitori_da_riconfermare', v_fornitori_count,
      'addendum_ids', to_jsonb(v_addendum_ids)
    ),
    auth.uid(),
    'COMPLETATO'
  )
  returning id into v_cambio_id;

  return jsonb_build_object(
    'ok', true,
    'cambio_id', v_cambio_id,
    'old_date_from', v_old_from,
    'new_date_from', p_nuova_data,
    'fornitori_da_riconfermare', v_fornitori_count,
    'addendum_ids', to_jsonb(v_addendum_ids)
  );
end;
$$;

comment on function public.riprogramma_evento(uuid, date) is
  'Sposta un evento a una nuova data, libera la disponibilita` fornitori vecchia, aggiorna quotes/contracts (anche quelli senza entry_id ma con lo stesso quote_id), genera un addendum per ogni contratto già FIRMATO collegato, e notifica i fornitori per riconferma. Authz: owner WP o admin.';

revoke all on function public.riprogramma_evento(uuid, date) from public;
grant execute on function public.riprogramma_evento(uuid, date) to authenticated;

-- ============================================================================
-- mark_settlement_paid (marcatura manuale) e il trigger di riconciliazione
-- automatica (DEN-01, oggi) potevano contraddirsi: su un settlement collegato
-- a un mini-contratto, un aggiustamento manuale veniva silenziosamente
-- sovrascritto/perso alla prima rata successiva modificata (il trigger
-- ricalcola sempre da zero la somma delle rate). Fix: una volta collegato,
-- il settlement si muove SOLO dalle rate del contratto — la marcatura manuale
-- resta per i soli conti non ancora collegati, coerente con quanto la UI
-- (FinanzeRetePage) già racconta all'utente.
-- ============================================================================
create or replace function public.mark_settlement_paid(p_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.network_settlements%rowtype;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_row from public.network_settlements where id = p_id;
  if v_row.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_row.capostipite_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('error','bad_amount'); end if;
  if v_row.contract_id is not null then
    return jsonb_build_object('error','linked_to_contract',
      'hint','Questo conto è collegato a un mini-contratto: si aggiorna da solo quando registri gli incassi sulle sue rate.');
  end if;

  update public.network_settlements
     set amount_paid = least(amount_due, amount_paid + p_amount),
         status = case when amount_paid + p_amount >= amount_due then 'SALDATO'
                       when amount_paid + p_amount > 0 then 'PARZIALE' else 'MATURATO' end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end$$;

-- ============================================================================
-- capostipite_add_supplier: due bug trovati dal collaudo.
-- (a) p_supplier_id inesistente: v_sup_role restava NULL e "NULL NOT IN (...)"
--     non è mai vero in PL/pgSQL, quindi il controllo di ruolo veniva superato
--     silenziosamente e l'insert falliva più sotto con un errore grezzo di FK
--     (23503) invece di un errore pulito.
-- (b) Un fornitore che aveva GIA' chiesto lui di entrare (collaboration
--     PENDING fornitore-iniziata) veniva resettato a PENDING capostipite-
--     iniziata invece di essere accettato: il capostipite che "aggiunge" un
--     fornitore che lo aveva già invitato sta ovviamente accettando quella
--     richiesta, non aprendone una nuova da zero.
-- ============================================================================
create or replace function capostipite_add_supplier(p_supplier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capo uuid := auth.uid();
  v_role user_role;
  v_sup_role user_role;
  v_capo_profile record;
  v_fornitore_profile record;
  v_existing collaborations%rowtype;
  v_new collaborations%rowtype;
begin
  if v_capo is null then
    return jsonb_build_object('error','auth_required');
  end if;

  select role into v_role from profiles where id = v_capo;
  if v_role not in ('WEDDING_PLANNER','LOCATION') then
    return jsonb_build_object('error','only_capostipite');
  end if;

  select role into v_sup_role from profiles where id = p_supplier_id;
  if v_sup_role is null then
    return jsonb_build_object('error','not_found');
  end if;

  if v_role = 'WEDDING_PLANNER' then
    if v_sup_role not in ('FORNITORE','LOCATION') then
      return jsonb_build_object('error','target_not_supplier');
    end if;
  else  -- LOCATION
    if v_sup_role is distinct from 'FORNITORE' then
      return jsonb_build_object('error','target_not_supplier');
    end if;
  end if;

  select * into v_existing from collaborations
   where capostipite_id = v_capo and fornitore_id = p_supplier_id;

  if v_existing.id is not null then
    if v_existing.status = 'ACTIVE' then
      return jsonb_build_object('ok', true, 'already_active', true, 'collaboration_id', v_existing.id);
    end if;
    if v_existing.status = 'PENDING' and v_existing.initiated_by = 'CAPOSTIPITE' then
      return jsonb_build_object('ok', true, 'already_pending', true, 'collaboration_id', v_existing.id);
    end if;
    if v_existing.status = 'PENDING' and v_existing.initiated_by = 'FORNITORE' then
      update collaborations
         set status = 'ACTIVE', accepted_at = now(), revoked_at = null, updated_at = now()
       where id = v_existing.id
       returning * into v_new;

      select * into v_fornitore_profile from profiles where id = p_supplier_id;
      select * into v_capo_profile from profiles where id = v_capo;
      insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
      values (p_supplier_id, 'CAPOSTIPITE_HA_ACCETTATO', 'Richiesta accettata',
        coalesce(v_capo_profile.business_name, v_capo_profile.full_name, 'Il referente evento') ||
          ' ha accettato la tua richiesta: ora fai parte della sua rete.',
        '/capostipiti', v_capo, 'PENDING', 5)
      on conflict (destinatario_id, evento_id, tipo) do update
        set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

      return jsonb_build_object('ok', true, 'collaboration_id', v_new.id, 'accepted_existing_request', true);
    end if;
    update collaborations
       set status = 'PENDING', initiated_by = 'CAPOSTIPITE', invited_at = now(),
           accepted_at = null, revoked_at = null
     where id = v_existing.id
     returning * into v_new;
  else
    insert into collaborations (capostipite_id, fornitore_id, status, initiated_by, invited_at)
    values (v_capo, p_supplier_id, 'PENDING', 'CAPOSTIPITE', now())
    returning * into v_new;
  end if;

  select * into v_capo_profile from profiles where id = v_capo;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_supplier_id, 'INVITO_RETE_CAPOSTIPITE', 'Sei stato invitato in una rete',
    coalesce(v_capo_profile.business_name, v_capo_profile.full_name, 'Un referente evento') ||
      ' vuole aggiungerti alla sua rete fornitori. Accetta per iniziare a ricevere preventivi.',
    '/capostipiti', v_capo, 'PENDING', 6)
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

  return jsonb_build_object('ok', true, 'collaboration_id', v_new.id, 'pending', true);
end$$;

-- ============================================================================
-- GER-05 era irraggiungibile dal flusso reale: approve_candidacy sa gestire
-- una LOCATION che si candida a un WP fin da stamattina, ma request_follow
-- non ha mai messo in PENDING un follow LOCATION->WP (solo FORNITORE->WP/
-- LOCATION): la candidatura risultava sempre auto-APPROVED, quindi il ramo
-- LOCATION di approve_candidacy non aveva mai una riga PENDING da trovare.
-- ============================================================================
create or replace function request_follow(p_target uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_me_role text;
  v_status follow_status;
  v_row follows%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_target = auth.uid() then raise exception 'cannot_follow_self'; end if;

  select role::text into v_target_role from profiles where id = p_target;
  select role::text into v_me_role     from profiles where id = auth.uid();
  if v_target_role is null then raise exception 'target_not_found'; end if;

  -- Logica approvazione:
  --  fornitore → WP/LOCATION : richiesta PENDING (servirà approval)
  --  LOCATION  → WP          : idem (stessa gerarchia di reclutamento)
  --  altri casi: APPROVED automatico
  if (v_me_role = 'FORNITORE' and v_target_role in ('WEDDING_PLANNER', 'LOCATION'))
     or (v_me_role = 'LOCATION' and v_target_role = 'WEDDING_PLANNER') then
    v_status := 'PENDING';
  else
    v_status := 'APPROVED';
  end if;

  insert into follows (follower_id, followed_id, status, decided_at)
  values (auth.uid(), p_target, v_status, case when v_status = 'APPROVED' then now() else null end)
  on conflict (follower_id, followed_id) do update
    set status = case
                   when follows.status = 'REJECTED' then excluded.status
                   else follows.status
                 end,
        decided_at = case when excluded.status = 'APPROVED' and follows.decided_at is null then now() else follows.decided_at end
  returning * into v_row;
  return v_row;
end$$;
