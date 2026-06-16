-- ============================================================================
-- 1) CONSENSO AL PASSAGGIO DATI quando il cliente accetta un collega suggerito:
--    oltre alla firma leggera, la coppia può acconsentire a passare i propri dati
--    (fiscali) al fornitore, per facilitare preventivo e contratto.
-- 2) RIPARA create_supplier_contract (usava calendar_entries.client_name/email,
--    droppate dalla 20260610010000) e PRE-IMPORTA il fiscale cliente — gated dal
--    consenso per i contratti fornitore↔cliente.
-- 3) MOODBOARD CONDIVISO: con più fornitori nel cerchio, tutti vedono/aggiungono.
-- ============================================================================

-- 1) consenso ------------------------------------------------------------------
alter table public.event_circle_suggestions
  add column if not exists data_passage boolean not null default false;

create or replace function public.respond_circle_suggestion(
  p_suggestion uuid, p_accept boolean, p_signed_name text default null, p_data_passage boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid;
begin
  select entry_id, supplier_id into v_entry, v_sup
    from public.event_circle_suggestions where id = p_suggestion and status = 'PENDING';
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_accept then
    if coalesce(btrim(p_signed_name), '') = '' then return jsonb_build_object('error', 'signature_required'); end if;
    begin
      insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, v_sup, 'fornitore', true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    exception when others then
      return jsonb_build_object('error', sqlerrm);
    end;
    update public.event_circle_suggestions
       set status = 'ACCEPTED', signed_by = auth.uid(), signed_name = p_signed_name, signed_at = now(),
           data_passage = coalesce(p_data_passage, false)
     where id = p_suggestion;
  else
    update public.event_circle_suggestions set status = 'REJECTED' where id = p_suggestion;
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_circle_suggestion(uuid, boolean, text, boolean) to authenticated;

-- helper: la coppia ha autorizzato il passaggio dati a questo fornitore per l'evento?
create or replace function public.event_supplier_data_passage(p_entry uuid, p_supplier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_circle_suggestions s
    where s.entry_id = p_entry and s.supplier_id = p_supplier
      and s.status = 'ACCEPTED' and s.data_passage = true
  );
$$;
grant execute on function public.event_supplier_data_passage(uuid, uuid) to authenticated;

-- aggiorna anche la lista per gli sposi: mostra se è richiesto il passaggio dati (sempre proposto).
-- (la UI mostrerà la checkbox; qui non serve cambiare list_circle_suggestions.)

-- 2) create_supplier_contract: fix PII + pre-import fiscale gated ---------------
create or replace function create_supplier_contract(
  p_entry_id    uuid,
  p_supplier_id uuid,
  p_party_kind  text,
  p_template_id uuid default null,
  p_title       text default null
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry calendar_entries%rowtype;
  v_priv  calendar_entries_private%rowtype;
  v_supplier profiles%rowtype;
  v_sections jsonb;
  v_title text;
  v_amount numeric(12,2);
  v_owner uuid;
  v_client_name text;
  v_client_email text;
  v_passage boolean;
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

  if p_party_kind = 'SUPPLIER_WP' then v_owner := v_entry.owner_id; else v_owner := p_supplier_id; end if;

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

  select coalesce(sum(line_client), 0) into v_amount
    from quote_items qi join calendar_entries ce on ce.quote_id = qi.quote_id
   where ce.id = p_entry_id and qi.supplier_id = p_supplier_id;

  v_client_name  := coalesce(v_priv.client_name,  (select client_name  from quotes where id = v_entry.quote_id));
  v_client_email := coalesce(v_priv.client_email, (select client_email from quotes where id = v_entry.quote_id));

  -- PRE-IMPORT fiscale cliente: col WP (owner = WP) è il suo stesso cliente → libero;
  -- col CLIENTE (owner = fornitore) SOLO se la coppia ha autorizzato il passaggio dati.
  v_passage := (p_party_kind = 'SUPPLIER_WP') or public.event_supplier_data_passage(p_entry_id, p_supplier_id);
  if v_passage and v_entry.quote_id is not null then
    select * into v_acc from quote_acceptances where quote_id = v_entry.quote_id order by accepted_at desc nulls last limit 1;
  end if;
  if v_passage then
    select * into v_prev from contracts
      where entry_id = p_entry_id and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
      order by created_at desc limit 1;
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
    coalesce(v_acc.client_fiscal_code,   v_prev.client_fiscal_code),
    coalesce(v_acc.client_vat_number,    v_prev.client_vat_number),
    coalesce(v_acc.client_business_name, v_prev.client_business_name),
    coalesce(v_acc.client_address,       v_prev.client_address),
    coalesce(v_acc.client_city,          v_prev.client_city),
    coalesce(v_acc.client_zip,           v_prev.client_zip),
    coalesce(v_acc.client_province,      v_prev.client_province),
    coalesce(v_acc.client_country,       v_prev.client_country),
    coalesce(v_acc.client_sdi_code,      v_prev.client_sdi_code),
    coalesce(v_acc.client_pec_email,     v_prev.client_pec_email),
    v_sections, 'BOZZA', p_party_kind::contract_party_kind, p_template_id, gen_random_uuid()
  ) returning * into v_row;

  return v_row;
end$$;
grant execute on function create_supplier_contract(uuid, uuid, text, uuid, text) to authenticated;

-- 3) MOODBOARD CONDIVISO: tutti i membri del cerchio (owner, coppia, fornitori) vedono e modificano.
do $$
begin
  if to_regclass('public.mood_boards') is not null then
    execute 'drop policy if exists "mood_boards_circle" on public.mood_boards';
    execute 'create policy "mood_boards_circle" on public.mood_boards for all using (public._photo_circle_member(entry_id)) with check (public._photo_circle_member(entry_id))';
  end if;
end $$;
