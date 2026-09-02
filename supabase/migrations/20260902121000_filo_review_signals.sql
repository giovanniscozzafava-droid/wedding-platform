-- Filo legge anche le recensioni: consiglia di chiederla dopo l'evento (una volta
-- sola, poi tace) e riporta quando il cliente ha cliccato per andare a recensire.
-- Il corpo di filo_brief è quello di 20260902090000 + N10 e C9b.

drop function if exists public.filo_brief();
create or replace function public.filo_brief()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_sig jsonb := '[]'::jsonb;
  v_out jsonb := '[]'::jsonb;
  s jsonb; st record;
  r record;
  v_logo text; v_services int; v_role text; v_net int;
  v_sent_this int; v_sent_last int; v_acc90 int; v_sent90 int; v_rate int;
  v_pending_val numeric(14,2); v_fatt_month numeric(14,2);
  v_quotes int; v_sent_or_won int;
  v_sez text; v_n int; v_opened uuid[] := '{}';
  o_visite int; o_aperture int; o_risposte int; o_cuori int; o_lead int; o_incassi int;
  v_has_review_links boolean := false;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select role, brand_logo_url,
         nullif(trim(coalesce(review_url_google,'')),'') is not null or nullif(trim(coalesce(review_url_matrimonio,'')),'') is not null
    into v_role, v_logo, v_has_review_links from public.profiles where id = v_uid;

  -- ═══════════════ NOTIZIE: cosa è successo (kind = 'news') ═══════════════

  -- N1) Il cliente è entrato nel suo evento (48h). Una notizia per evento, con dove e quanto.
  for r in
    select ce.id as entry_id, ce.title,
           count(*) as n, max(v.last_seen_at) as ultima
      from couple_visits v
      join calendar_entries ce on ce.id = v.entry_id
     where v.started_at > now() - interval '48 hours'
       and extract(epoch from (v.last_seen_at - v.started_at)) >= 5
       and (ce.owner_id = v_uid
            or exists (select 1 from event_galleries g where g.entry_id = ce.id and g.owner_id = v_uid))
     group by ce.id, ce.title
     order by max(v.last_seen_at) desc limit 3
  loop
    select string_agg(filo_durata(sec) || ' ' || filo_sezione(sez), ', ' order by sec desc) into v_sez
      from (select section sez, sum(extract(epoch from (last_seen_at - started_at)))::int sec
              from couple_visits
             where entry_id = r.entry_id and started_at > now() - interval '48 hours'
               and extract(epoch from (last_seen_at - started_at)) >= 5
             group by section) x;
    v_sig := v_sig || jsonb_build_object('key','visit:'||r.entry_id,'kind','news','priority',1,'area','Evento',
      'title', coalesce(r.title,'Evento') || ': il cliente è entrato',
      'body', case when r.n = 1 then 'Una visita' else r.n || ' visite' end || ' nelle ultime 48 ore: '
              || coalesce(v_sez,'') || '. L''ultima ' || filo_ago(r.ultima) || '.',
      'link','/weddings/'||r.entry_id, 'state', to_char(r.ultima,'YYYYMMDDHH24MI'), 'snooze', 1);
  end loop;

  -- N2) Ha aperto il preventivo (24h). Diverso dal "cliente caldo": qui è il fatto di oggi.
  for r in
    select id, coalesce(nullif(client_name,''),'Il cliente') cn, open_count, last_opened_at
      from quotes where owner_id = v_uid and status::text = 'INVIATO' and not coalesce(is_test,false)
       and last_opened_at > now() - interval '24 hours'
     order by last_opened_at desc limit 3
  loop
    v_opened := v_opened || r.id;
    v_sig := v_sig || jsonb_build_object('key','opened:'||r.id,'kind','news','priority',1,'area','Preventivi',
      'title', r.cn || ' ha aperto il preventivo',
      'body', 'Aperto ' || filo_ago(r.last_opened_at)
              || case when r.open_count > 1 then ' (' || r.open_count || ' volte in tutto)' else '' end
              || '. Se vuoi sentirlo, questo è il momento.',
      'link','/quotes/'||r.id, 'state', to_char(r.last_opened_at,'YYYYMMDDHH24MI'), 'snooze', 1);
  end loop;

  -- N3) Risposte all'ultimatum (72h): cosa ha detto, cosa ho fatto io, cosa manca.
  for r in
    select u.id uid, u.quote_id, u.responded_at, u.still_interested, u.reason::text reason, u.price_related,
           u.discount_applied, u.discount_percent, u.discount_email_at, u.note,
           coalesce(nullif(q.client_name,''),'Il cliente') cn, q.total_discount_percent
      from quote_ultimatums u join quotes q on q.id = u.quote_id
     where u.owner_id = v_uid and u.responded_at > now() - interval '72 hours'
       and not coalesce(q.is_test,false)
       and not exists (select 1 from supplier_clients sc where sc.id = q.direct_client_id and sc.is_test)
     order by u.responded_at desc limit 4
  loop
    v_sig := v_sig || jsonb_build_object('key','ultimatum:'||r.uid,'kind','news','priority',1,'area','Ultimatum',
      'title', r.cn || case when r.still_interested then ': tiene la data'
                            when r.discount_applied then ': era il prezzo'
                            else ' ha rinunciato' end,
      'body', case
        when r.still_interested then 'Ha risposto ' || filo_ago(r.responded_at) || ': vuole ancora la data. Chiama e chiudi.'
        when r.discount_applied then
          'Ha risposto ' || filo_ago(r.responded_at)
          || case when r.reason = 'ALTRO_FORNITORE' then ': un altro gli ha fatto meno' else ': costa troppo' end
          || '. Ho applicato un ulteriore ' || filo_pct(r.discount_percent) || '% (totale scontato del '
          || filo_pct(r.total_discount_percent) || '%)'
          || case when r.discount_email_at is null
                  then ', ma la mail col nuovo totale non è partita: apri il preventivo e mandagliela.'
                  else ' e gli ho mandato il nuovo totale. Se non risponde entro 7 giorni, congelo.' end
        else 'Motivo: ' || case r.reason when 'PREZZO' then 'prezzo' when 'ALTRO_FORNITORE' then 'ha scelto un altro professionista'
                                         when 'DATA' then 'la data è cambiata' when 'RINVIATO' then 'evento rinviato'
                                         when 'NON_PIU' then 'non si fa più' else 'altro' end
             || coalesce(' («' || left(r.note, 80) || '»)', '')
             || '. Ho congelato il preventivo e fermato le automazioni verso questo cliente.' end,
      'link','/quotes/'||r.quote_id, 'state', to_char(r.responded_at,'YYYYMMDDHH24MI') || coalesce(r.discount_email_at::text,''), 'snooze', 3);
  end loop;

  -- N4) Ultimatum muto da 4-7 giorni: sta per essere congelato, te lo dico prima.
  for r in
    select u.quote_id, floor(extract(epoch from (now()-u.sent_at))/86400)::int gg,
           coalesce(nullif(q.client_name,''),'Il cliente') cn
      from quote_ultimatums u join quotes q on q.id = u.quote_id
     where u.owner_id = v_uid and u.responded_at is null
       and u.sent_at between now() - interval '7 days' and now() - interval '4 days'
       and q.status::text = 'INVIATO' and not coalesce(q.funnel_paused,false) and not coalesce(q.is_test,false)
     order by u.sent_at asc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','ult_muto:'||r.quote_id,'kind','news','priority',2,'area','Ultimatum',
      'title', r.cn || ' non risponde all''ultimatum',
      'body', 'Mandato ' || r.gg || ' giorni fa, nessun clic. Tra ' || (7 - r.gg) || case when 7 - r.gg = 1 then ' giorno' else ' giorni' end
              || ' congelo il preventivo e smetto di scrivergli. Se vuoi provare a voce, è ora.',
      'link','/quotes/'||r.quote_id, 'state', r.gg::text, 'snooze', 2);
  end loop;

  -- N5) Congelato per silenzio (72h): l'ho fatto io col cron, te lo dico in faccia.
  for r in
    select q.id, coalesce(nullif(q.client_name,''),'Il cliente') cn, q.updated_at
      from quotes q
     where q.owner_id = v_uid and coalesce(q.funnel_paused,false) and q.status::text = 'INVIATO'
       and q.updated_at > now() - interval '72 hours' and not coalesce(q.is_test,false)
       and exists (select 1 from quote_ultimatums u where u.quote_id = q.id and u.responded_at is null
                    and u.sent_at < now() - interval '7 days')
     order by q.updated_at desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','frozen:'||r.id,'kind','news','priority',2,'area','Preventivi',
      'title', r.cn || ': preventivo congelato',
      'body', 'Sette giorni senza risposta all''ultimatum: ho smesso di scrivergli. Il preventivo resta valido; lo riprendi tu se si fa vivo.',
      'link','/quotes/'||r.id, 'state', r.updated_at::date::text, 'snooze', 30);
  end loop;

  -- N6) Cuori degli sposi sulle foto (48h): ogni cuore è una scelta per l'album.
  for r in
    select ce.id entry_id, ce.title, count(*) n, max(l.created_at) ultima
      from gallery_media_likes l
      join gallery_media m on m.id = l.media_id
      join calendar_entries ce on ce.id = m.entry_id
      join wedding_couple_members wm on wm.entry_id = ce.id and wm.user_id = l.user_id
     where l.created_at > now() - interval '48 hours'
       and (ce.owner_id = v_uid
            or exists (select 1 from event_galleries g where g.entry_id = ce.id and g.owner_id = v_uid))
     group by ce.id, ce.title order by max(l.created_at) desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','likes:'||r.entry_id,'kind','news','priority',1,'area','Foto',
      'title', coalesce(r.title,'Gli sposi') || ': ' || r.n || case when r.n = 1 then ' cuore' else ' cuori' end || ' sulle foto',
      'body', 'L''ultimo ' || filo_ago(r.ultima) || '. Ogni cuore entra nella selezione dell''album: stanno scegliendo.',
      'link','/weddings/'||r.entry_id||'?tab=foto', 'state', r.n::text, 'snooze', 1);
  end loop;

  -- N7) Selezione consegnata (7 giorni): tocca a te impaginare.
  for r in
    select s.gallery_id, s.submitted_at, ce.id entry_id, ce.title,
           (select count(*) from gallery_media m where m.gallery_id = s.gallery_id and coalesce(m.pick_couple,false)) n
      from gallery_selection s
      join event_galleries g on g.id = s.gallery_id
      join calendar_entries ce on ce.id = g.entry_id
     where s.status = 'SUBMITTED' and s.submitted_at > now() - interval '7 days'
       and (g.owner_id = v_uid or ce.owner_id = v_uid)
     order by s.submitted_at desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','selection:'||r.gallery_id,'kind','news','priority',1,'area','Album',
      'title', coalesce(r.title,'Gli sposi') || ': selezione consegnata',
      'body', r.n || ' foto scelte, consegnate ' || filo_ago(r.submitted_at) || '. Adesso l''album lo impagini tu.',
      'link','/weddings/'||r.entry_id||'?tab=foto', 'state', to_char(r.submitted_at,'YYYYMMDDHH24MI'), 'snooze', 7);
  end loop;

  -- N8) Rate del contratto in scadenza o scadute: registra l'incasso quando arriva.
  for r in
    select cp.id, cp.label, cp.amount, cp.due_date, c.entry_id,
           coalesce(nullif(c.client_name,''), nullif(c.title,''), 'un cliente') cn,
           (cp.due_date - current_date) gg
      from contract_payments cp join contracts c on c.id = cp.contract_id
     where cp.owner_id = v_uid and not coalesce(cp.paid,false)
       and cp.due_date is not null and cp.due_date <= current_date + 3
     order by cp.due_date asc limit 4
  loop
    v_sig := v_sig || jsonb_build_object('key','pay:'||r.id,'kind','news','priority', case when r.gg < 0 then 1 else 2 end,
      'area','Incassi',
      'title', coalesce(r.label,'Rata') || ' di ' || r.cn || ': ' || filo_eur(r.amount),
      'body', case when r.gg < 0 then 'Scaduta da ' || abs(r.gg) || case when abs(r.gg)=1 then ' giorno' else ' giorni' end || '.'
                   when r.gg = 0 then 'Scade oggi.'
                   else 'Scade tra ' || r.gg || case when r.gg=1 then ' giorno' else ' giorni' end || '.' end
              || ' Quando arriva, registra l''incasso nel contratto (data, metodo, fattura).',
      'link', case when r.entry_id is not null then '/weddings/'||r.entry_id||'?tab=contract' else '/my-contracts' end,
      'state', r.due_date::text, 'snooze', 3);
  end loop;

  -- N9) Richieste nuove (72h): chi risponde per primo di solito vince.
  for r in
    select id, coalesce(nullif(client_name,''),'qualcuno') cn, event_kind, event_date, event_location, created_at
      from lead_requests where wp_id = v_uid and status = 'NEW' and created_at > now() - interval '72 hours'
     order by created_at desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','lead:'||r.id,'kind','news','priority',1,'area','Richieste',
      'title', 'Nuova richiesta da ' || r.cn,
      'body', coalesce(initcap(r.event_kind) || ' ', '') || coalesce('il ' || to_char(r.event_date,'DD/MM/YYYY') || ' ', '')
              || coalesce('a ' || r.event_location || ' ', '') || '— arrivata ' || filo_ago(r.created_at)
              || '. Chi risponde entro un''ora di solito vince.',
      'link','/leads', 'state', to_char(r.created_at,'YYYYMMDDHH24MI'), 'snooze', 1);
  end loop;

  -- N10) Il cliente è andato a recensirti (7 giorni): la recensione vera sta fuori,
  --      il click è l'unica traccia. Vale la pena andare a controllare.
  for r in
    select ce.id as entry_id, ce.title, max(rc.clicked_at) as ultima,
           string_agg(distinct case rc.platform when 'google' then 'Google' else 'Matrimonio.com' end, ' e ') as dove
      from review_clicks rc join calendar_entries ce on ce.id = rc.entry_id
     where rc.professional_id = v_uid and rc.clicked_at > now() - interval '7 days'
     group by ce.id, ce.title order by max(rc.clicked_at) desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','review_click:'||r.entry_id,'kind','news','priority',1,'area','Recensioni',
      'title', coalesce(r.title,'Evento') || ': il cliente è andato a recensirti',
      'body', 'Ha aperto la tua pagina su ' || r.dove || ' ' || filo_ago(r.ultima) || '. Vai a vedere se la recensione è arrivata e ringrazia.',
      'link','/weddings/'||r.entry_id, 'state', to_char(r.ultima,'YYYYMMDDHH24MI'), 'snooze', 3);
  end loop;

  -- ═══════════════ CONSIGLI: stato del business (kind = 'consiglio') ═══════════════
  select count(*) into v_quotes from public.quotes where owner_id = v_uid and not coalesce(is_test,false);

  if v_quotes = 0 then
    v_sig := v_sig || jsonb_build_object('key','no_quotes','kind','consiglio','priority',1,'area','Preventivi',
      'title','Fai il tuo primo preventivo',
      'body','È da qui che parte tutto. Lo costruisci in due minuti, te lo monto io pulito e lo mandi.',
      'link','/quotes', 'state', null, 'snooze', 3);
  else
    select count(*) into v_sent_or_won from public.quotes
     where owner_id = v_uid and not coalesce(is_test,false) and (sent_at is not null
       or status::text in ('INVIATO','ACCETTATO','CONVERTITO_IN_CONTRATTO','RIFIUTATO'));
    if v_sent_or_won = 0 then
      v_sig := v_sig || jsonb_build_object('key','draft_not_sent','kind','consiglio','priority',1,'area','Preventivi',
        'title','Manda il preventivo',
        'body','Hai un preventivo pronto in bozza. Mandalo al cliente: finché resta bozza non lavora per te.',
        'link','/quotes', 'state', v_quotes::text, 'snooze', 3);
    end if;
  end if;

  -- C1) cliente caldo (≥3 aperture). Lo stato è il numero di aperture: se riapre, torna.
  for r in
    select id, coalesce(nullif(client_name,''),'Il cliente') cn, open_count
    from public.quotes where owner_id = v_uid and status::text = 'INVIATO' and open_count >= 3
      and not coalesce(is_test,false) and not coalesce(funnel_paused,false)
      and not (id = any(v_opened))   -- già raccontato tra le notizie di oggi: non mi ripeto
    order by open_count desc, last_opened_at desc nulls last limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','hot_quote:'||r.id,'kind','consiglio','priority',1,'area','Preventivi',
      'title', r.cn || ' continua a riaprire il preventivo',
      'body', 'Riaperto ' || r.open_count || ' volte. È il momento giusto per sentire questo cliente.',
      'link','/quotes/'||r.id, 'state', r.open_count::text, 'snooze', 7);
  end loop;

  -- C2) accettato senza contratto da >2 giorni
  for r in
    select id, coalesce(nullif(client_name,''),'un cliente') cn,
           floor(extract(epoch from (now()-accepted_at))/86400)::int gg
    from public.quotes where owner_id = v_uid and status::text = 'ACCETTATO' and accepted_at is not null
      and accepted_at < now() - interval '2 days' and not coalesce(is_test,false)
    order by accepted_at asc limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','accepted_no_contract:'||r.id,'kind','consiglio','priority',1,'area','Contratti',
      'title','Chiudi il contratto di ' || r.cn,
      'body','Il preventivo è accettato da ' || r.gg || ' giorni. Trasformalo in contratto prima che si raffreddi.',
      'link','/quotes/'||r.id, 'state', null, 'snooze', 3);
  end loop;

  -- C3) inviato mai aperto da >3 giorni
  for r in
    select id, coalesce(nullif(client_name,''),'Il cliente') cn,
           floor(extract(epoch from (now()-sent_at))/86400)::int gg
    from public.quotes where owner_id = v_uid and status::text = 'INVIATO' and open_count = 0
      and sent_at is not null and sent_at < now() - interval '3 days'
      and not coalesce(is_test,false) and not coalesce(funnel_paused,false)
    order by sent_at asc limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','sent_unopened:'||r.id,'kind','consiglio','priority',2,'area','Preventivi',
      'title', r.cn || ' non ha mai aperto',
      'body', 'Preventivo inviato ' || r.gg || ' giorni fa, zero aperture. Un promemoria gentile spesso basta.',
      'link','/quotes/'||r.id, 'state', null, 'snooze', 7);
  end loop;

  -- C4) catalogo vuoto
  select count(*) into v_services from public.services where fornitore_id = v_uid and is_active;
  if v_services = 0 then
    v_sig := v_sig || jsonb_build_object('key','empty_catalog','kind','consiglio','priority',2,'area','Catalogo',
      'title','Catalogo vuoto','body','Bastano 3 servizi col prezzo e il prossimo preventivo lo fai in un minuto.',
      'link','/catalog', 'state', null, 'snooze', 14);
  end if;

  -- C5) mese in calo
  select count(*) into v_sent_this from public.quotes where owner_id = v_uid and not coalesce(is_test,false) and sent_at >= date_trunc('month', now());
  select count(*) into v_sent_last from public.quotes where owner_id = v_uid and not coalesce(is_test,false)
    and sent_at >= date_trunc('month', now()) - interval '1 month' and sent_at < date_trunc('month', now());
  if v_sent_last >= 3 and v_sent_this < v_sent_last then
    v_sig := v_sig || jsonb_build_object('key','month_drop','kind','consiglio','priority',2,'area','Preventivi',
      'title','Pipeline in calo',
      'body','Questo mese hai inviato ' || v_sent_this || ' preventivi contro ' || v_sent_last || ' del mese scorso. Un po'' di pipeline non guasta.',
      'link','/quotes', 'state', to_char(now(),'YYYYMM') || ':' || v_sent_this, 'snooze', 7);
  end if;

  -- C6) conversione bassa
  select count(*) into v_sent90 from public.quotes where owner_id = v_uid and not coalesce(is_test,false) and sent_at is not null and sent_at >= now() - interval '90 days';
  select count(*) into v_acc90 from public.quotes where owner_id = v_uid and not coalesce(is_test,false) and sent_at is not null and sent_at >= now() - interval '90 days'
    and status::text in ('ACCETTATO','CONVERTITO_IN_CONTRATTO');
  if v_sent90 >= 5 then
    v_rate := round(100.0 * v_acc90 / nullif(v_sent90,0))::int;
    if v_rate < 30 then
      v_sig := v_sig || jsonb_build_object('key','low_conversion','kind','consiglio','priority',2,'area','Preventivi',
        'title','Conversione da alzare',
        'body','Negli ultimi 90 giorni converti il ' || v_rate || '% dei preventivi. Di solito si alza rispondendo più in fretta e seguendo quelli già aperti.',
        'link','/quotes', 'state', v_rate::text, 'snooze', 30);
    end if;
  end if;

  -- C7) profilo senza logo
  if v_logo is null then
    v_sig := v_sig || jsonb_build_object('key','no_logo','kind','consiglio','priority',3,'area','Brand',
      'title','Metti la tua faccia','body','Carica il logo: preventivi e contratti escono già brandizzati.',
      'link','/settings/brand', 'state', null, 'snooze', 30);
  end if;

  -- C8) soldi sul tavolo. Lo stato è la cifra: cambia quando cambia la pipeline.
  select coalesce(sum(case when coalesce(total_client_selected,0) > 0 then total_client_selected else total_client end),0)
    into v_pending_val from public.quotes
   where owner_id = v_uid and status::text = 'INVIATO' and not coalesce(is_test,false) and not coalesce(funnel_paused,false);
  if v_pending_val >= 1 then
    v_sig := v_sig || jsonb_build_object('key','pending_value','kind','consiglio','priority',2,'area','Bilancio',
      'title','Soldi sul tavolo',
      'body','Hai ' || filo_eur(v_pending_val) || ' di preventivi inviati in attesa di risposta. Seguili.',
      'link','/quotes', 'state', round(v_pending_val)::text, 'snooze', 7);
  end if;

  -- C9) rete
  if v_role in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    select count(*) into v_net from public.collaborations where capostipite_id = v_uid and status = 'ACTIVE';
    if v_net < 3 then
      v_sig := v_sig || jsonb_build_object('key','grow_network','kind','consiglio','priority',2,'area','Rete',
        'title','Allarga la rete',
        'body','Invita i fornitori con cui lavori già: più rete in pancia, più eventi che girano. Il codice glielo dai tu.',
        'link','/suppliers', 'state', v_net::text, 'snooze', 30);
    end if;
  elsif v_role = 'FORNITORE' then
    select count(*) into v_net from public.collaborations where fornitore_id = v_uid and status = 'ACTIVE';
    if v_net < 2 then
      v_sig := v_sig || jsonb_build_object('key','get_discovered','kind','consiglio','priority',2,'area','Rete',
        'title','Fatti scoprire',
        'body','Candidati ai capostipiti e fatti trovare su Scopri: è da lì che arrivano i lavori.',
        'link','/scopri', 'state', v_net::text, 'snooze', 30);
    end if;
  end if;

  -- C9b) Evento passato da 1-60 giorni e recensione mai chiesta: il momento buono è
  --      adesso, col ricordo fresco. Senza link nel profilo, il consiglio è caricarli.
  for r in
    select ce.id as entry_id, ce.title, coalesce(ce.date_to, ce.date_from)::date as fine,
           coalesce(nullif(trim(pr.client_name),''), (select nullif(trim(m.full_name),'') from wedding_couple_members m where m.entry_id = ce.id order by m.created_at limit 1)) as chi
      from calendar_entries ce
      left join calendar_entries_private pr on pr.entry_id = ce.id
     where coalesce(ce.date_to, ce.date_from)::date between current_date - 60 and current_date - 1
       and public.review_is_pro_of_entry(ce.id, v_uid)
       and exists (select 1 from wedding_couple_members m where m.entry_id = ce.id)
       and not exists (select 1 from review_requests rr where rr.entry_id = ce.id and rr.professional_id = v_uid)
     order by coalesce(ce.date_to, ce.date_from) desc limit 3
  loop
    v_sig := v_sig || jsonb_build_object('key','review_due:'||r.entry_id,'kind','consiglio','priority',1,'area','Recensioni',
      'title', 'Chiedi una recensione a ' || coalesce(r.chi, r.title, 'questo cliente'),
      'body', 'L''evento è passato da ' || (current_date - r.fine) || case when (current_date - r.fine) = 1 then ' giorno' else ' giorni' end
              || ': il ricordo è fresco, è il momento buono. '
              || case when v_has_review_links then 'Un click e il cliente riceve i tuoi link su Google e Matrimonio.com.'
                      else 'Prima carica i link del tuo profilo Google e Matrimonio.com nelle Impostazioni.' end,
      'link', case when v_has_review_links then '/weddings/'||r.entry_id else '/profile#recensioni' end,
      'state', case when v_has_review_links then 'links' else 'nolinks' end, 'snooze', 7);
  end loop;

  -- C10) recruiting, evergreen a bassa priorità: una volta al mese basta e avanza.
  v_sig := v_sig || jsonb_build_object('key','recruit','kind','consiglio','priority',3,'area','Crescita',
    'title','Porta un collega',
    'body','Più professionisti dentro, più lavoro per tutti. Invita un collega: a te crediti, a lui un posto nella tua rete.',
    'link','/recruiting', 'state', null, 'snooze', 60);

  -- ═══════════════ MEMORIA: cosa ho già detto, cosa hai già capito ═══════════════
  for s in select * from jsonb_array_elements(v_sig) loop
    insert into filo_signal_state (user_id, key, state)
    values (v_uid, s->>'key', s->>'state')
    on conflict (user_id, key) do update set last_seen_at = now(), state = excluded.state;

    select * into st from filo_signal_state where user_id = v_uid and key = s->>'key';
    -- Spento da "ho capito" e la realtà non è cambiata → non lo ripeto.
    if st.snooze_until is not null and st.snooze_until > now()
       and (st.ack_state is null or st.ack_state = (s->>'state')) then
      continue;
    end if;
    v_out := v_out || (s || jsonb_build_object(
      'days_seen', floor(extract(epoch from (now() - st.first_seen_at))/86400)::int,
      'nuovo', st.first_seen_at > now() - interval '5 minutes',
      -- torna dopo un "ho capito" perché lo stato è cambiato
      'ritorna', st.acked_at is not null and st.ack_state is distinct from (s->>'state')));
  end loop;

  -- ═══════════════ LE ULTIME 24 ORE, in numeri (anche quando è tutto fermo) ═══════════════
  select count(distinct entry_id) into o_visite from couple_visits v
   where v.started_at > now() - interval '24 hours'
     and extract(epoch from (v.last_seen_at - v.started_at)) >= 5
     and (exists (select 1 from calendar_entries ce where ce.id = v.entry_id and ce.owner_id = v_uid)
          or exists (select 1 from event_galleries g where g.entry_id = v.entry_id and g.owner_id = v_uid));
  select count(*) into o_aperture from quotes where owner_id = v_uid and not coalesce(is_test,false)
     and last_opened_at > now() - interval '24 hours';
  select count(*) into o_risposte from quote_ultimatums u join quotes q on q.id = u.quote_id
   where u.owner_id = v_uid and not coalesce(q.is_test,false) and u.responded_at > now() - interval '24 hours';
  select count(*) into o_cuori from gallery_media_likes l
    join gallery_media m on m.id = l.media_id
    join wedding_couple_members wm on wm.entry_id = m.entry_id and wm.user_id = l.user_id
    join calendar_entries ce on ce.id = m.entry_id
   where l.created_at > now() - interval '24 hours'
     and (ce.owner_id = v_uid or exists (select 1 from event_galleries g where g.entry_id = ce.id and g.owner_id = v_uid));
  select count(*) into o_lead from lead_requests where wp_id = v_uid and created_at > now() - interval '24 hours';
  select count(*) into o_incassi from contract_payments where owner_id = v_uid and coalesce(paid,false) and paid_at = current_date;

  select coalesce(sum(total_client),0) into v_fatt_month from public.quotes
   where owner_id = v_uid and not coalesce(is_test,false) and status::text in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')
     and date_trunc('month', accepted_at) = date_trunc('month', now());

  return jsonb_build_object('ok', true, 'signals', v_out, 'totale', jsonb_array_length(v_sig),
    'oggi', jsonb_build_object('visite', o_visite, 'aperture', o_aperture, 'risposte', o_risposte,
                               'cuori', o_cuori, 'lead', o_lead, 'incassi', o_incassi),
    'stats', jsonb_build_object('sent_this_month', v_sent_this, 'sent_last_month', v_sent_last,
                                'sent_90', v_sent90, 'accepted_90', v_acc90,
                                'pending_value', v_pending_val, 'fatturato_month', v_fatt_month));
end$$;
revoke all on function public.filo_brief() from public;
grant execute on function public.filo_brief() to authenticated;
