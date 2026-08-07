-- ============================================================================
-- R1 (decisione utente: "Solo l'accettato"): il contratto riflette SOLO le voci
-- accettate dal cliente, non l'offerta piena.
--
-- Il corrispettivo e gli acconti (30/40/30) usavano v_quote.total_client (totale
-- pieno). Ora usano il totale delle voci accettate: total_client_selected quando
-- il cliente ha fatto una selezione per-voce (>0), con fallback su total_client
-- per la firma intera (nessuna selezione per-voce => total_client_selected=0).
-- total_client_selected passa dallo stesso motore sconto/maggiorazione/trasferta,
-- quindi coincide col totale pieno quando tutte le voci sono accettate. Testo
-- legale invariato (estratto byte-per-byte da 20260526090000).
-- ============================================================================

create or replace function build_contract_sections(p_quote_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote        record;
  v_owner        record;
  v_event_date   text;
  v_total_str    text;
  v_total_words  text;
  v_provider_name text;
  v_provider_role text;
  v_provider_address text;
  v_provider_pec text;
  v_client_name  text;
  v_client_email text;
  v_today        text;
  v_event_label  text;
  v_event_article text;
  v_event_label_plural text;
  v_total        numeric;
begin
  select q.* into v_quote from quotes q where q.id = p_quote_id;
  if v_quote.id is null then return '[]'::jsonb; end if;

  select p.* into v_owner from profiles p where p.id = v_quote.owner_id;

  -- R1 "solo l'accettato": totale delle sole voci accettate (con fallback al
  -- totale pieno per la firma intera senza selezione per-voce).
  v_total := case when coalesce(v_quote.total_client_selected, 0) > 0
                  then v_quote.total_client_selected
                  else coalesce(v_quote.total_client, 0) end;

  v_event_date := coalesce(to_char(v_quote.event_date, 'DD/MM/YYYY'), '__/__/____');
  v_total_str := to_char(v_total, 'FM999G999G990D00');
  v_total_words := '(in lettere: ' || replace(v_total_str, '.', ',') || ' euro)';
  v_today := to_char(now() at time zone 'Europe/Rome', 'DD/MM/YYYY');

  -- Terminologia dinamica per event_kind
  case lower(coalesce(v_quote.event_kind, 'matrimonio'))
    when 'matrimonio' then v_event_label := 'matrimonio'; v_event_article := 'il'; v_event_label_plural := 'matrimoniali';
    when 'battesimo'  then v_event_label := 'battesimo';  v_event_article := 'il'; v_event_label_plural := 'di battesimo';
    when 'cresima'    then v_event_label := 'cresima';    v_event_article := 'la'; v_event_label_plural := 'di cresima';
    when 'comunione'  then v_event_label := 'comunione';  v_event_article := 'la'; v_event_label_plural := 'di prima comunione';
    when 'compleanno' then v_event_label := 'compleanno'; v_event_article := 'il'; v_event_label_plural := 'per compleanno';
    when 'anniversario' then v_event_label := 'anniversario'; v_event_article := 'l''';v_event_label_plural := 'di anniversario';
    when 'laurea'     then v_event_label := 'festa di laurea'; v_event_article := 'la'; v_event_label_plural := 'per festa di laurea';
    when 'corporate'  then v_event_label := 'evento aziendale'; v_event_article := 'l''';v_event_label_plural := 'aziendali';
    else v_event_label := coalesce(v_quote.event_kind, 'evento'); v_event_article := 'l''';v_event_label_plural := 'per evento';
  end case;

  v_provider_name := coalesce(nullif(trim(v_owner.business_name), ''), v_owner.full_name, 'Il Prestatore');
  v_provider_role := case v_owner.role
    when 'WEDDING_PLANNER' then 'Wedding Planner / Event Planner'
    when 'LOCATION' then 'Location di ricevimento'
    when 'FORNITORE' then coalesce(nullif(v_owner.subrole, ''), 'Fornitore di servizi')
    else 'Prestatore'
  end;
  v_provider_address := coalesce(nullif(concat_ws(' - ', v_owner.city, v_owner.country), ''), '[indirizzo da completare]');
  v_provider_pec := '[email PEC del Prestatore da inserire]';

  v_client_name := coalesce(nullif(trim(v_quote.client_name), ''), '[Cliente da identificare]');
  v_client_email := coalesce(nullif(trim(v_quote.client_email), ''), '[email del Cliente]');

  return jsonb_build_array(
    jsonb_build_object(
      'heading', 'Premesse',
      'type', 'PREMESSE',
      'body', concat(
        'Con la presente scrittura privata, sottoscritta in ', v_today, ', stipulata in conformità al combinato disposto degli artt. 1321 e seguenti del Codice Civile italiano,', E'\n\n',
        'TRA', E'\n',
        v_provider_name, ' (di seguito anche il "Prestatore" o "Parte fornitrice"), ', v_provider_role, ', con sede in ', v_provider_address, ', PEC: ', v_provider_pec, ',', E'\n\n',
        'E', E'\n',
        v_client_name, ' (di seguito anche il "Committente" o "Parte committente"), domiciliato/a ai fini del presente contratto presso ', v_client_email, ',', E'\n\n',
        'Premesso che:', E'\n',
        'a) il Committente intende organizzare ', v_event_article, ' ', v_event_label, ' (di seguito "Evento") in data ', v_event_date, ', e ha contattato il Prestatore al fine di acquistare i servizi descritti nel preventivo n. ', coalesce(v_quote.id::text, '__'), ' rev. ', v_quote.revision::text, ' a esso allegato e qui integralmente richiamato (di seguito "Preventivo");', E'\n',
        'b) il Prestatore opera professionalmente nel settore dei servizi per eventi ', v_event_label_plural, ' e affini, dichiarando di possedere le competenze, le autorizzazioni e le coperture assicurative necessarie all''esecuzione delle prestazioni;', E'\n',
        'c) le Parti hanno raggiunto piena intesa sul contenuto del servizio, sul corrispettivo e sui termini di esecuzione;', E'\n\n',
        'tutto ciò premesso, costituente parte integrante del presente accordo, le Parti convengono e stipulano quanto segue.'
      )
    ),

    jsonb_build_object(
      'heading', 'Art. 1 — Oggetto',
      'type', 'OGGETTO',
      'body', concat(
        '1.1 Il Prestatore si obbliga a eseguire, a regola d''arte e con la diligenza professionale richiesta dall''art. 1176, comma 2, del Codice Civile, le prestazioni dettagliatamente elencate nel Preventivo allegato, parte integrante e sostanziale del presente contratto.', E'\n\n',
        '1.2 Le prestazioni saranno erogate in occasione dell''Evento (', v_event_label, ') previsto per il giorno ', v_event_date, '. Eventuali variazioni della data dovranno essere concordate per iscritto tra le Parti e potranno comportare adeguamenti del corrispettivo.', E'\n\n',
        '1.3 Le prestazioni accessorie non espressamente indicate nel Preventivo si intendono escluse e potranno essere richieste in via aggiuntiva mediante apposita pattuizione scritta.'
      )
    ),

    jsonb_build_object(
      'heading', 'Art. 2 — Corrispettivo e modalità di pagamento',
      'type', 'CORRISPETTIVO',
      'body', concat(
        '2.1 Il corrispettivo totale pattuito per le prestazioni di cui all''Art. 1 è fissato in € ', v_total_str, ' ', v_total_words, ', importo da intendersi al lordo o al netto dell''IVA secondo quanto specificato nel Preventivo.', E'\n\n',
        '2.2 Il pagamento sarà corrisposto dal Committente al Prestatore secondo le seguenti modalità:', E'\n',
        '   a) acconto del 30% pari a € ', to_char(coalesce(v_total * 0.30, 0), 'FM999G999G990D00'), ' al momento della sottoscrizione del presente contratto, a titolo di caparra confirmatoria ai sensi dell''art. 1385 c.c.;', E'\n',
        '   b) ulteriore 40% pari a € ', to_char(coalesce(v_total * 0.40, 0), 'FM999G999G990D00'), ' entro 60 (sessanta) giorni precedenti la data dell''Evento;', E'\n',
        '   c) saldo del restante 30% pari a € ', to_char(coalesce(v_total * 0.30, 0), 'FM999G999G990D00'), ' entro 7 (sette) giorni precedenti la data dell''Evento.', E'\n\n',
        '2.3 Tutti i pagamenti saranno effettuati mediante bonifico bancario sull''IBAN che il Prestatore comunicherà per iscritto al Committente. È esclusa la corresponsione in contanti per importi superiori ai limiti di legge.', E'\n\n',
        '2.4 In caso di ritardato pagamento, sull''importo dovuto matureranno gli interessi moratori nella misura prevista dal D.lgs. 231/2002 e ss.mm.ii.'
      )
    ),

    jsonb_build_object(
      'heading', 'Art. 3 — Termine e luogo di esecuzione',
      'type', 'TERMINE',
      'body', concat(
        '3.1 Le prestazioni saranno eseguite il giorno ', v_event_date, ' presso il luogo dell''Evento concordato tra le Parti e indicato nel Preventivo.', E'\n\n',
        '3.2 Gli orari di inizio e fine prestazione, ove non altrimenti indicati nel Preventivo, saranno comunicati e concordati per iscritto entro i 30 (trenta) giorni precedenti l''Evento.', E'\n\n',
        '3.3 Il termine di esecuzione si intende essenziale ai sensi e per gli effetti dell''art. 1457 c.c., salvi i casi di forza maggiore di cui al successivo Art. 7.'
      )
    ),

    jsonb_build_object(
      'heading', 'Art. 4 — Obblighi del Prestatore',
      'type', 'OBBLIGHI_PRESTATORE',
      'body', '4.1 Il Prestatore si impegna a: (a) eseguire le prestazioni con la massima diligenza professionale e nel rispetto delle disposizioni normative applicabili; (b) impiegare personale qualificato e mezzi adeguati alle finalità del servizio; (c) garantire la copertura assicurativa di responsabilità civile per i danni eventualmente cagionati a persone o cose nell''esecuzione del contratto; (d) rispettare le tempistiche e gli accordi comunicativi con il Committente; (e) non utilizzare materiale fotografico o videografico per finalità promozionali senza il consenso espresso del Committente (v. Art. 11).'
    ),

    jsonb_build_object(
      'heading', 'Art. 5 — Obblighi del Committente',
      'type', 'OBBLIGHI_COMMITTENTE',
      'body', '5.1 Il Committente si impegna a: (a) corrispondere il corrispettivo nei termini di cui all''Art. 2; (b) fornire al Prestatore, con congruo anticipo, tutte le informazioni necessarie alla corretta esecuzione delle prestazioni (numero invitati definitivo, allergie, esigenze speciali, planimetria del luogo, eventuali permessi); (c) garantire l''accesso del Prestatore al luogo dell''Evento, ivi compreso il personale tecnico di supporto e la fornitura di servizi essenziali (corrente elettrica, acqua, eventuale parcheggio); (d) astenersi da comportamenti che possano impedire o rendere maggiormente onerosa l''esecuzione del contratto.'
    ),

    jsonb_build_object(
      'heading', 'Art. 6 — Variazioni e modifiche',
      'type', 'VARIAZIONI',
      'body', '6.1 Eventuali variazioni rispetto a quanto previsto nel Preventivo (numero invitati, voci aggiuntive, sostituzioni di servizio) dovranno essere richieste dal Committente per iscritto e accettate dal Prestatore. Le variazioni comporteranno l''adeguamento del corrispettivo secondo le condizioni economiche vigenti. 6.2 Le variazioni del numero di invitati superiori al ±10% rispetto a quanto indicato nel Preventivo dovranno essere comunicate al Prestatore entro 30 (trenta) giorni precedenti l''Evento.'
    ),

    jsonb_build_object(
      'heading', 'Art. 7 — Recesso, cancellazione e forza maggiore',
      'type', 'RECESSO',
      'body', concat(
        '7.1 In caso di recesso del Committente, ai sensi dell''art. 1373 c.c., saranno applicate le seguenti penali a copertura forfettaria dei costi sostenuti dal Prestatore:', E'\n',
        '   a) recesso oltre i 180 giorni dall''Evento: trattenuta dell''acconto versato (30%);', E'\n',
        '   b) recesso tra 180 e 90 giorni: trattenuta del 50%;', E'\n',
        '   c) recesso tra 90 e 30 giorni: trattenuta del 75%;', E'\n',
        '   d) recesso entro 30 giorni: trattenuta integrale.', E'\n\n',
        '7.2 Le penali operano in funzione liquidatoria del danno, salva la prova di un danno maggiore.', E'\n\n',
        '7.3 In caso di forza maggiore o caso fortuito (a titolo esemplificativo: calamità naturali, provvedimenti dell''Autorità, pandemia, lutto in famiglia di primo grado), tale da rendere impossibile l''esecuzione dell''Evento, le Parti concorderanno in buona fede la traslazione dell''Evento ad altra data senza applicazione di penali, fatti salvi i costi già documentatamente sostenuti dal Prestatore.', E'\n\n',
        '7.4 Il Prestatore può recedere dal contratto per gravi e giustificati motivi, restituendo al Committente quanto eventualmente percepito a titolo di acconto.'
      )
    ),

    jsonb_build_object('heading','Art. 8 — Responsabilità e limitazioni','type','RESPONSABILITA','body','8.1 Il Prestatore risponde dei danni cagionati nell''esecuzione del contratto secondo i principi di cui agli artt. 1218 e 1223 c.c. La responsabilità è limitata, salvo dolo o colpa grave, al corrispettivo pattuito. 8.2 Il Prestatore non risponde dei danni cagionati da terzi non riconducibili alla propria sfera di controllo, né di quelli derivanti da informazioni inesatte o omesse fornite dal Committente.'),
    jsonb_build_object('heading','Art. 9 — Cessione del contratto','type','CESSIONE','body','9.1 Il presente contratto non può essere ceduto, in tutto o in parte, senza il preventivo consenso scritto dell''altra Parte. Resta salva la facoltà del Prestatore di avvalersi di sub-fornitori per l''esecuzione di prestazioni accessorie, ferma restando la propria responsabilità nei confronti del Committente.'),
    jsonb_build_object('heading','Art. 10 — Trattamento dei dati personali (GDPR)','type','GDPR','body','10.1 Le Parti dichiarano di aver preso visione della rispettiva informativa sul trattamento dei dati personali resa ai sensi degli artt. 13 e 14 del Reg. UE 2016/679 (GDPR). 10.2 Il Prestatore tratta i dati personali del Committente e degli invitati nel rispetto della normativa applicabile, esclusivamente per le finalità connesse all''esecuzione del presente contratto. 10.3 Il Committente garantisce di aver acquisito, ove necessario, il consenso degli invitati al trattamento dei loro dati.'),
    jsonb_build_object('heading','Art. 11 — Diritti di immagine','type','IMMAGINE','body','11.1 Eventuali fotografie e video realizzati dal Prestatore durante l''Evento sono di proprietà del Prestatore quanto ai diritti d''autore. Il Committente acquisisce, salvo diversa pattuizione scritta, un diritto d''uso personale e non commerciale del materiale consegnato. 11.2 Il Prestatore potrà utilizzare il materiale per finalità promozionali solo previo consenso espresso e scritto del Committente, revocabile in qualsiasi momento.'),
    jsonb_build_object('heading','Art. 12 — Riservatezza','type','RISERVATEZZA','body','12.1 Le Parti si impegnano a mantenere riservato il contenuto del presente contratto, dei suoi allegati e di ogni informazione confidenziale acquisita nell''esecuzione del rapporto, salvi gli obblighi di legge.'),
    jsonb_build_object('heading','Art. 13 — Comunicazioni e foro competente','type','FORO','body','13.1 Tutte le comunicazioni inerenti il presente contratto saranno effettuate a mezzo PEC o raccomandata A/R, ovvero email con conferma di lettura, agli indirizzi indicati in premessa. 13.2 Per ogni controversia derivante dall''interpretazione o esecuzione del presente contratto sarà territorialmente competente, in via esclusiva, il Foro del luogo di residenza o di domicilio elettivo del Committente, ai sensi dell''art. 33, comma 2, lett. u), del D.lgs. 206/2005 (Codice del Consumo), qualora applicabile.'),
    jsonb_build_object('heading','Art. 14 — Firma elettronica e validità','type','FIRMA_ELETTRONICA','body','14.1 Le Parti dichiarano di accettare la sottoscrizione del presente contratto mediante firma elettronica semplice (FES) ai sensi dell''art. 20, comma 1-bis, del D.lgs. 7 marzo 2005, n. 82 (CAD), riconoscendole pieno valore probatorio. 14.2 La piattaforma Planfully (Fuyue Srl) registra l''hash crittografico del documento, l''identificativo univoco del firmatario, l''indirizzo IP, lo user-agent, la data e l''ora di sottoscrizione.'),
    jsonb_build_object('heading','Art. 15 — Clausole vessatorie (artt. 1341-1342 c.c.)','type','VESSATORIE','body','15.1 Le Parti dichiarano di aver letto, compreso e specificamente approvato, ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., le clausole contenenti previsioni a favore del Prestatore: Art. 3.3 (essenzialità termine), Art. 7.1-7.2 (penali recesso), Art. 8.1 (limitazione responsabilità), Art. 9 (divieto cessione), Art. 13.2 (foro competente).')
  );
end$$;

grant execute on function build_contract_sections(uuid) to authenticated;


-- R1: total_amount del contratto = totale accettato (stessa logica).
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
  v_priv   calendar_entries_private%rowtype;   -- PII (client_name/email) separate dal 20260610010000
  v_quote  quotes%rowtype;
  v_acc    quote_acceptances%rowtype;
  v_prev   contracts%rowtype;
  v_new    contracts%rowtype;
  v_ready  jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  if p_party_kind not in ('CLIENT_WP', 'SUPPLIER_WP', 'SUPPLIER_CLIENT') then
    raise exception 'invalid_party_kind: %', p_party_kind;
  end if;

  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null then
    raise exception 'entry_not_found';
  end if;

  if v_entry.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
  then
    raise exception 'not_authorized';
  end if;

  select * into v_priv from public.calendar_entries_private where entry_id = p_entry_id;

  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;

  if p_party_kind = 'CLIENT_WP' and v_entry.quote_id is not null then
    v_ready := public.quote_budget_readiness(v_entry.quote_id);
    if coalesce((v_ready->>'ready_for_contract')::boolean, false) = false then
      raise exception 'budget_not_ready: %', coalesce(v_ready->>'reason', 'Budget non ancora approvato');
    end if;
  end if;

  -- ── PRE-IMPORT dati fiscali cliente ───────────────────────────────────────
  if v_entry.quote_id is not null then
    select * into v_acc from public.quote_acceptances
      where quote_id = v_entry.quote_id
      order by accepted_at desc nulls last limit 1;
  end if;
  -- contratto già presente sull'evento (stesso cerchio) con fiscale valorizzato
  select * into v_prev from public.contracts
    where entry_id = p_entry_id
      and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
    order by created_at desc limit 1;
  -- fallback: un contratto precedente del pro con lo stesso cliente (per email)
  if v_prev.id is null and v_quote.client_email is not null then
    select * into v_prev from public.contracts
      where owner_id = v_uid and lower(client_email) = lower(v_quote.client_email)
        and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
      order by created_at desc limit 1;
  end if;

  insert into public.contracts (
    owner_id, quote_id, entry_id, supplier_id, party_kind,
    title, client_name, client_email,
    client_fiscal_code, client_vat_number, client_business_name,
    client_address, client_city, client_zip, client_province, client_country,
    client_sdi_code, client_pec_email,
    sections, access_token, status, total_amount
  ) values (
    v_uid,
    v_entry.quote_id,
    p_entry_id,
    p_supplier_id,
    p_party_kind::contract_party_kind,
    coalesce(nullif(trim(p_title), ''), v_entry.title || ' — Contratto'),
    coalesce(v_quote.client_name, v_priv.client_name),
    coalesce(v_quote.client_email, v_priv.client_email),
    coalesce(v_acc.client_fiscal_code,    v_prev.client_fiscal_code),
    coalesce(v_acc.client_vat_number,     v_prev.client_vat_number),
    coalesce(v_acc.client_business_name,  v_prev.client_business_name),
    coalesce(v_acc.client_address,        v_prev.client_address),
    coalesce(v_acc.client_city,           v_prev.client_city),
    coalesce(v_acc.client_zip,            v_prev.client_zip),
    coalesce(v_acc.client_province,       v_prev.client_province),
    coalesce(v_acc.client_country,        v_prev.client_country),
    coalesce(v_acc.client_sdi_code,       v_prev.client_sdi_code),
    coalesce(v_acc.client_pec_email,      v_prev.client_pec_email),
    coalesce(p_sections, '[]'::jsonb),
    gen_random_uuid(),
    'BOZZA'::contract_status,
    case when coalesce(v_quote.total_client_selected, 0) > 0
         then v_quote.total_client_selected
         else coalesce(v_quote.total_client, 0) end
  )
  returning * into v_new;

  return v_new;
end$$;

revoke all on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) from public;
grant execute on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) to authenticated;
