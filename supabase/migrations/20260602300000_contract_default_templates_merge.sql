-- ============================================================================
-- MODELLI DI CONTRATTO DI DEFAULT + MERGE FIELDS.
-- Richiesta dogfood: servono modelli pronti che, alla generazione del contratto,
-- "acchiappino" da soli:
--   * l'anagrafica del FORNITORE o del CAPOSTIPITE (nome, P.IVA, CF, indirizzo…)
--   * i dati anagrafici del CLIENTE
--   * le SINGOLE VOCI del preventivo + il totale
-- I modelli usano segnaposto {{...}} che vengono sostituiti automaticamente al
-- momento della creazione del contratto (create_contract_from_clauses).
-- ----------------------------------------------------------------------------

-- 1) FILLER: sostituisce i segnaposto in un testo, attingendo da entry+quote+profili.
create or replace function public.contract_fill_text(
  p_text        text,
  p_entry_id    uuid,
  p_supplier_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entry  public.calendar_entries%rowtype;
  v_quote  public.quotes%rowtype;
  v_owner  public.profiles%rowtype;   -- capostipite = owner dell'evento
  v_sup    public.profiles%rowtype;   -- fornitore
  v_items  text;
  v_total  numeric := 0;
  t        text := coalesce(p_text, '');
  BL       constant text := '________';
begin
  if p_entry_id is null then return t; end if;
  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null then return t; end if;
  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;
  select * into v_owner from public.profiles where id = v_entry.owner_id;
  if p_supplier_id is not null then
    select * into v_sup from public.profiles where id = p_supplier_id;
  end if;

  -- Voci del preventivo (eventualmente filtrate sul fornitore del contratto) + totale.
  if v_entry.quote_id is not null then
    select
      string_agg(
        '• ' || coalesce(qi.name_snapshot, 'Voce')
        || case when coalesce(qi.quantity, 1) > 1 then ' ×' || qi.quantity::text else '' end
        || ' — € ' || to_char(coalesce(qi.line_client, 0) * coalesce(qi.quantity, 1), 'FM999G999G990D00'),
        E'\n' order by qi.sort_order),
      coalesce(sum(coalesce(qi.line_client, 0) * coalesce(qi.quantity, 1)), 0)
      into v_items, v_total
      from public.quote_items qi
     where qi.quote_id = v_entry.quote_id
       and (p_supplier_id is null or qi.supplier_id = p_supplier_id);
  end if;

  -- CLIENTE
  t := replace(t, '{{cliente_nome}}',  coalesce(nullif(trim(coalesce(v_quote.client_name, v_entry.client_name, '')), ''), BL));
  t := replace(t, '{{cliente_email}}', coalesce(nullif(trim(coalesce(v_quote.client_email, v_entry.client_email, '')), ''), BL));

  -- FORNITORE
  t := replace(t, '{{fornitore_nome}}',      coalesce(nullif(trim(coalesce(v_sup.business_name, v_sup.full_name, '')), ''), BL));
  t := replace(t, '{{fornitore_piva}}',      coalesce(nullif(trim(coalesce(v_sup.vat_number, '')), ''), BL));
  t := replace(t, '{{fornitore_cf}}',        coalesce(nullif(trim(coalesce(v_sup.fiscal_code, '')), ''), BL));
  t := replace(t, '{{fornitore_indirizzo}}', coalesce(nullif(trim(coalesce(v_sup.address, '') || case when v_sup.city is not null then ', ' || v_sup.city else '' end), ', '), BL));
  t := replace(t, '{{fornitore_telefono}}',  coalesce(nullif(trim(coalesce(v_sup.phone, '')), ''), BL));

  -- CAPOSTIPITE (owner evento: WP/Location)
  t := replace(t, '{{capostipite_nome}}',      coalesce(nullif(trim(coalesce(v_owner.business_name, v_owner.full_name, '')), ''), BL));
  t := replace(t, '{{capostipite_piva}}',      coalesce(nullif(trim(coalesce(v_owner.vat_number, '')), ''), BL));
  t := replace(t, '{{capostipite_cf}}',        coalesce(nullif(trim(coalesce(v_owner.fiscal_code, '')), ''), BL));
  t := replace(t, '{{capostipite_indirizzo}}', coalesce(nullif(trim(coalesce(v_owner.address, '') || case when v_owner.city is not null then ', ' || v_owner.city else '' end), ', '), BL));

  -- EVENTO
  t := replace(t, '{{evento_titolo}}', coalesce(nullif(trim(coalesce(v_entry.title, v_quote.title, '')), ''), BL));
  t := replace(t, '{{evento_data}}',   coalesce(to_char(coalesce(v_entry.date_from, v_quote.event_date), 'DD/MM/YYYY'), BL));
  t := replace(t, '{{evento_luogo}}',  coalesce(nullif(trim(coalesce(v_quote.event_location, '')), ''), BL));

  -- PREVENTIVO
  t := replace(t, '{{voci_preventivo}}',    coalesce(v_items, BL));
  t := replace(t, '{{preventivo_totale}}',  '€ ' || to_char(coalesce(nullif(v_quote.total_client, 0), v_total, 0), 'FM999G999G990D00'));

  return t;
end$$;

grant execute on function public.contract_fill_text(text, uuid, uuid) to authenticated;

-- 2) create_contract_from_clauses: applica il merge a titolo e a ogni sezione.
create or replace function public.create_contract_from_clauses(
  p_entry_id     uuid,
  p_party_kind   text,
  p_title        text,
  p_sections     jsonb,
  p_supplier_id  uuid default null
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_entry  calendar_entries%rowtype;
  v_quote  quotes%rowtype;
  v_new    contracts%rowtype;
  v_sections jsonb := '[]'::jsonb;
  v_s      jsonb;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if p_party_kind not in ('CLIENT_WP', 'SUPPLIER_WP', 'SUPPLIER_CLIENT') then
    raise exception 'invalid_party_kind: %', p_party_kind;
  end if;

  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null then raise exception 'entry_not_found'; end if;

  if v_entry.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
  then
    raise exception 'not_authorized';
  end if;

  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;

  -- MERGE: sostituisce i segnaposto {{...}} in heading e body di ogni sezione.
  for v_s in select * from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb))
  loop
    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'heading', public.contract_fill_text(v_s->>'heading', p_entry_id, p_supplier_id),
      'body',    public.contract_fill_text(v_s->>'body',    p_entry_id, p_supplier_id)
    ));
  end loop;

  insert into public.contracts (
    owner_id, quote_id, entry_id, supplier_id, party_kind,
    title, client_name, client_email,
    sections, access_token, status, total_amount
  ) values (
    v_uid,
    v_entry.quote_id,
    p_entry_id,
    p_supplier_id,
    p_party_kind::contract_party_kind,
    public.contract_fill_text(coalesce(nullif(trim(p_title), ''), v_entry.title || ' — Contratto'), p_entry_id, p_supplier_id),
    coalesce(v_quote.client_name, v_entry.client_name),
    v_quote.client_email,
    v_sections,
    gen_random_uuid(),
    'BOZZA'::contract_status,
    coalesce(v_quote.total_client, 0)
  )
  returning * into v_new;

  return v_new;
end$$;

revoke all on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) from public;
grant execute on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) to authenticated;

-- 3) clone_suggested_contract_template: fallback al modello generico 'default'
--    quando non esiste un modello per il subrole del fornitore.
create or replace function public.clone_suggested_contract_template(p_subrole text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sub text; v_tpl public.suggested_contract_templates%rowtype; v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(p_subrole, subrole) into v_sub from public.profiles where id = v_uid;
  select * into v_tpl from public.suggested_contract_templates where subrole = v_sub;
  if v_tpl.id is null then
    select * into v_tpl from public.suggested_contract_templates where subrole = 'default';
  end if;
  if v_tpl.id is null then return jsonb_build_object('error','no_template_available'); end if;
  insert into public.supplier_contract_templates(fornitore_id, title, category, sections, is_default)
  values (v_uid, v_tpl.title, coalesce(v_sub, 'default'), v_tpl.sections, false)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'template_id', v_id, 'legal_disclaimer', v_tpl.legal_disclaimer);
end$$;
grant execute on function public.clone_suggested_contract_template(text) to authenticated;

-- 4) SEED modelli di default (con merge token). Idempotente su subrole.
insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
values
(
  'default',
  'Contratto di prestazione di servizi',
  jsonb_build_array(
    jsonb_build_object('heading','Parti',
      'body', E'Il presente contratto è stipulato tra:\nFORNITORE: {{fornitore_nome}} — P.IVA {{fornitore_piva}} — C.F. {{fornitore_cf}} — {{fornitore_indirizzo}} — tel. {{fornitore_telefono}};\ne\nCOMMITTENTE: {{cliente_nome}} — email {{cliente_email}}.'),
    jsonb_build_object('heading','Oggetto',
      'body', E'Il Fornitore si impegna a erogare i servizi per l''evento "{{evento_titolo}}" del {{evento_data}}, presso {{evento_luogo}}, come dettagliato nelle voci seguenti:\n{{voci_preventivo}}'),
    jsonb_build_object('heading','Corrispettivo',
      'body', E'Il corrispettivo complessivo è di {{preventivo_totale}} (IVA inclusa salvo diversa indicazione). Modalità: acconto alla firma, saldo entro la data dell''evento.'),
    jsonb_build_object('heading','Obblighi del Fornitore',
      'body', 'Eseguire la prestazione a regola d''arte, con puntualità e nel rispetto degli accordi e delle tempistiche concordate.'),
    jsonb_build_object('heading','Recesso e penali',
      'body', 'In caso di recesso del Committente oltre 90 giorni dall''evento è trattenuto l''acconto (30%); entro 90 giorni è dovuto il 100% del corrispettivo.'),
    jsonb_build_object('heading','Privacy',
      'body', 'Le parti trattano i dati personali ai sensi del Reg. UE 2016/679 esclusivamente per l''esecuzione del presente contratto.')
  ),
  'Modello fornito a scopo organizzativo: non costituisce consulenza legale. Verifica i contenuti con un professionista prima della firma.'
),
(
  'fotografo',
  'Contratto servizio fotografico',
  jsonb_build_array(
    jsonb_build_object('heading','Parti',
      'body', E'FORNITORE (fotografo): {{fornitore_nome}} — P.IVA {{fornitore_piva}} — C.F. {{fornitore_cf}} — {{fornitore_indirizzo}};\nCOMMITTENTE: {{cliente_nome}} — {{cliente_email}}.'),
    jsonb_build_object('heading','Oggetto',
      'body', E'Servizio fotografico per "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}). Prestazioni incluse:\n{{voci_preventivo}}'),
    jsonb_build_object('heading','Consegna e diritti',
      'body', 'Le immagini saranno consegnate nei tempi concordati. Il Fornitore conserva i diritti d''autore; il Committente riceve licenza d''uso personale. Eventuale uso promozionale del Fornitore previo consenso.'),
    jsonb_build_object('heading','Corrispettivo',
      'body', 'Corrispettivo complessivo: {{preventivo_totale}}. Acconto alla firma, saldo entro l''evento.'),
    jsonb_build_object('heading','Recesso',
      'body', 'Recesso oltre 90gg: trattenuto acconto 30%. Entro 90gg: 100%.')
  ),
  'Modello a scopo organizzativo, non è consulenza legale. Fai verificare i diritti d''autore e la licenza d''uso a un professionista.'
),
(
  'catering',
  'Contratto servizio catering',
  jsonb_build_array(
    jsonb_build_object('heading','Parti',
      'body', E'FORNITORE (catering): {{fornitore_nome}} — P.IVA {{fornitore_piva}} — {{fornitore_indirizzo}};\nCOMMITTENTE: {{cliente_nome}} — {{cliente_email}}.'),
    jsonb_build_object('heading','Oggetto',
      'body', E'Servizio di ristorazione per "{{evento_titolo}}" del {{evento_data}} presso {{evento_luogo}}. Voci:\n{{voci_preventivo}}'),
    jsonb_build_object('heading','Numero ospiti e conferme',
      'body', 'Il numero definitivo di ospiti va confermato almeno 7 giorni prima. Allergie/intolleranze comunicate per iscritto.'),
    jsonb_build_object('heading','Corrispettivo',
      'body', 'Corrispettivo complessivo: {{preventivo_totale}}. Acconto alla firma, saldo entro l''evento.'),
    jsonb_build_object('heading','Recesso',
      'body', 'Recesso oltre 90gg: trattenuto acconto 30%. Entro 90gg: 100%.')
  ),
  'Modello a scopo organizzativo, non è consulenza legale.'
),
(
  'location',
  'Contratto di utilizzo location',
  jsonb_build_array(
    jsonb_build_object('heading','Parti',
      'body', E'GESTORE LOCATION: {{capostipite_nome}} — P.IVA {{capostipite_piva}} — {{capostipite_indirizzo}};\nCOMMITTENTE: {{cliente_nome}} — {{cliente_email}}.'),
    jsonb_build_object('heading','Oggetto',
      'body', E'Concessione degli spazi per "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}). Servizi inclusi:\n{{voci_preventivo}}'),
    jsonb_build_object('heading','Capienza e regole',
      'body', 'Rispetto della capienza massima, degli orari e delle norme di sicurezza della struttura. Eventuali danni a carico del Committente.'),
    jsonb_build_object('heading','Corrispettivo',
      'body', 'Corrispettivo complessivo: {{preventivo_totale}}. Acconto alla firma, saldo entro l''evento.'),
    jsonb_build_object('heading','Recesso',
      'body', 'Recesso oltre 90gg: trattenuto acconto 30%. Entro 90gg: 100%.')
  ),
  'Modello a scopo organizzativo, non è consulenza legale.'
),
(
  'musica',
  'Contratto servizio musicale / intrattenimento',
  jsonb_build_array(
    jsonb_build_object('heading','Parti',
      'body', E'FORNITORE: {{fornitore_nome}} — P.IVA {{fornitore_piva}} — {{fornitore_indirizzo}};\nCOMMITTENTE: {{cliente_nome}} — {{cliente_email}}.'),
    jsonb_build_object('heading','Oggetto',
      'body', E'Servizio musicale/intrattenimento per "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}). Voci:\n{{voci_preventivo}}'),
    jsonb_build_object('heading','Tecnica e tempi',
      'body', 'Il Fornitore garantisce impianto idoneo agli spazi e rispetto degli orari concordati e dei limiti acustici della location.'),
    jsonb_build_object('heading','Corrispettivo',
      'body', 'Corrispettivo complessivo: {{preventivo_totale}}. Acconto alla firma, saldo entro l''evento.'),
    jsonb_build_object('heading','Recesso',
      'body', 'Recesso oltre 90gg: trattenuto acconto 30%. Entro 90gg: 100%.')
  ),
  'Modello a scopo organizzativo, non è consulenza legale. Verifica eventuali adempimenti SIAE.'
)
on conflict (subrole) do update set
  title = excluded.title,
  sections = excluded.sections,
  legal_disclaimer = excluded.legal_disclaimer,
  updated_at = now();
