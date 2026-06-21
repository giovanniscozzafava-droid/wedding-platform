-- FILO v1 (data-aware): brief owner-scoped che trasforma lo stato reale del professionista in
-- SUGGERIMENTI prioritizzati, con la voce di Filo. Niente AI: regole su dati propri (auth.uid()).
-- Aiuta nel business (clienti caldi, contratti da chiudere, conversione, pipeline) oltre che nell'uso.
create or replace function public.filo_brief()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_sig jsonb := '[]'::jsonb;
  r record;
  v_logo text; v_services int;
  v_sent_this int; v_sent_last int; v_acc90 int; v_sent90 int; v_rate int;
  v_pending_val numeric(14,2); v_fatt_month numeric(14,2);
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select brand_logo_url into v_logo from public.profiles where id = v_uid;

  -- 1) CLIENTE CALDO: preventivo inviato, riaperto >= 3 volte, non ancora deciso. (priorità 1)
  for r in
    select id, coalesce(nullif(client_name,''),'Il cliente') cn, open_count
    from public.quotes
    where owner_id = v_uid and status = 'INVIATO' and open_count >= 3
    order by open_count desc, last_opened_at desc nulls last limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','hot_quote','priority',1,'area','Preventivi',
      'title','Un cliente è caldo',
      'body', r.cn || ' ha riaperto il preventivo ' || r.open_count || ' volte. È il momento giusto per sentirlo.',
      'link','/quotes/'||r.id);
  end loop;

  -- 2) ACCETTATO SENZA CONTRATTO da > 2 giorni → chiudi prima che si raffreddi. (priorità 1)
  for r in
    select id, coalesce(nullif(client_name,''),'un cliente') cn,
           floor(extract(epoch from (now()-accepted_at))/86400)::int gg
    from public.quotes
    where owner_id = v_uid and status = 'ACCETTATO' and accepted_at is not null
      and accepted_at < now() - interval '2 days'
    order by accepted_at asc limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','accepted_no_contract','priority',1,'area','Contratti',
      'title','Chiudi il contratto',
      'body','Il preventivo di ' || r.cn || ' è accettato da ' || r.gg || ' giorni. Trasformalo in contratto prima che si raffreddi.',
      'link','/quotes/'||r.id);
  end loop;

  -- 3) INVIATO ma MAI APERTO da > 3 giorni → promemoria gentile. (priorità 2)
  for r in
    select id, coalesce(nullif(client_name,''),'Il cliente') cn,
           floor(extract(epoch from (now()-sent_at))/86400)::int gg
    from public.quotes
    where owner_id = v_uid and status = 'INVIATO' and open_count = 0
      and sent_at is not null and sent_at < now() - interval '3 days'
    order by sent_at asc limit 2
  loop
    v_sig := v_sig || jsonb_build_object('key','sent_unopened','priority',2,'area','Preventivi',
      'title','Un preventivo in sospeso',
      'body', r.cn || ' non ha ancora aperto il preventivo (inviato ' || r.gg || ' giorni fa). Un promemoria gentile spesso basta.',
      'link','/quotes/'||r.id);
  end loop;

  -- 4) CATALOGO VUOTO → preventivi più lenti. (priorità 2)
  select count(*) into v_services from public.services where fornitore_id = v_uid and is_active;
  if v_services = 0 then
    v_sig := v_sig || jsonb_build_object('key','empty_catalog','priority',2,'area','Catalogo',
      'title','Catalogo vuoto',
      'body','Bastano 3 servizi col prezzo e il prossimo preventivo lo fai in un minuto.',
      'link','/catalog');
  end if;

  -- 5) MESE IN CALO: meno preventivi inviati di quello scorso. (priorità 2)
  select count(*) into v_sent_this from public.quotes
   where owner_id = v_uid and sent_at >= date_trunc('month', now());
  select count(*) into v_sent_last from public.quotes
   where owner_id = v_uid and sent_at >= date_trunc('month', now()) - interval '1 month'
     and sent_at < date_trunc('month', now());
  if v_sent_last >= 3 and v_sent_this < v_sent_last then
    v_sig := v_sig || jsonb_build_object('key','month_drop','priority',2,'area','Preventivi',
      'title','Pipeline in calo',
      'body','Questo mese hai inviato ' || v_sent_this || ' preventivi contro ' || v_sent_last || ' del mese scorso. Un po'' di pipeline non guasta.',
      'link','/quotes');
  end if;

  -- 6) CONVERSIONE BASSA (ultimi 90 gg, almeno 5 inviati). (priorità 2)
  select count(*) into v_sent90 from public.quotes
   where owner_id = v_uid and sent_at is not null and sent_at >= now() - interval '90 days';
  select count(*) into v_acc90 from public.quotes
   where owner_id = v_uid and sent_at is not null and sent_at >= now() - interval '90 days'
     and status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO');
  if v_sent90 >= 5 then
    v_rate := round(100.0 * v_acc90 / nullif(v_sent90,0))::int;
    if v_rate < 30 then
      v_sig := v_sig || jsonb_build_object('key','low_conversion','priority',2,'area','Preventivi',
        'title','Conversione da alzare',
        'body','Negli ultimi 90 giorni converti il ' || v_rate || '% dei preventivi. Di solito si alza rispondendo più in fretta e seguendo quelli già aperti.',
        'link','/quotes');
    end if;
  end if;

  -- 7) PROFILO SENZA LOGO → documenti senza brand. (priorità 3)
  if v_logo is null then
    v_sig := v_sig || jsonb_build_object('key','no_logo','priority',3,'area','Brand',
      'title','Metti la tua faccia',
      'body','Carica il logo: preventivi e contratti escono già brandizzati.',
      'link','/settings/brand');
  end if;

  -- 8) BILANCIO: valore dei preventivi inviati ancora in attesa di firma = soldi sul tavolo.
  --    Stessa logica del bilancio: importi esatti numeric(14,2). (priorità 2)
  select coalesce(sum(total_client),0) into v_pending_val
    from public.quotes where owner_id = v_uid and status = 'INVIATO';
  if v_pending_val >= 1 then
    v_sig := v_sig || jsonb_build_object('key','pending_value','priority',2,'area','Bilancio',
      'title','Soldi sul tavolo',
      'body','Hai ' || to_char(v_pending_val,'FM999G999G990D00') || ' € di preventivi inviati in attesa di risposta. Seguili.',
      'link','/quotes');
  end if;

  -- fatturato del mese (vinto = accettato o convertito), per le stats di Filo.
  select coalesce(sum(total_client),0) into v_fatt_month
    from public.quotes
   where owner_id = v_uid and status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')
     and date_trunc('month', accepted_at) = date_trunc('month', now());

  return jsonb_build_object('ok', true, 'signals', v_sig,
    'stats', jsonb_build_object('sent_this_month', v_sent_this, 'sent_last_month', v_sent_last,
                                'sent_90', v_sent90, 'accepted_90', v_acc90,
                                'pending_value', v_pending_val, 'fatturato_month', v_fatt_month));
end$$;
grant execute on function public.filo_brief() to authenticated;
