-- ============================================================================
-- Terzo giro di stress test (06/09/2026, "ennesimo mega stress test"): tre
-- collaudi paralleli (concorrenza reale + IDOR incrociato, integrità dati
-- finanziari, vita evento dopo la firma). Questa migration chiude i bug
-- CONFIRMED e CRITICI trovati: tre leak reali del meccanismo "blind" (galleria
-- pubblica, richiesta recensione) fuori dal perimetro preventivo dove il
-- blind era già applicato, una vera race di doppia prenotazione dimostrata
-- dal vivo (non più solo teorica), e una fuga di analytics del cliente verso
-- un fornitore periferico della rete.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) LEAK CRITICO — gallery_get_by_token esponeva nome/email REALI del
--    fotografo anche quando quel fornitore era BLIND sul preventivo del
--    capostipite. Verificato dal vivo dal collaudo: RPC pubblica, senza
--    autenticazione, restituiva business_name+email del fornitore nascosto.
--    Fix: quando il proprietario della galleria è un fornitore blind sul
--    preventivo collegato all'evento, il link pubblico mostra l'identità del
--    CAPOSTIPITE (coerente col resto del sistema: BUNDLE = tutto passa da
--    lui), non null/vuoto (eviterebbe una UI rotta senza chiudere davvero
--    l'identità reale con qualcosa di sensato).
-- ----------------------------------------------------------------------------
create or replace function public.gallery_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_g record; v_p record; v_email text; v_date date; v_sel public.gallery_selection;
  v_media jsonb; v_pool_n int; v_decided_n int; v_kept_n int; v_total int;
  v_quote_id uuid; v_owner_id uuid; v_mode text; v_is_blind boolean := false;
begin
  if p_token is null then return jsonb_build_object('error', 'no_token'); end if;
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_g.share_expires_at is not null and v_g.share_expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select ce.quote_id into v_quote_id from public.calendar_entries ce where ce.id = v_g.entry_id;
  if v_quote_id is not null then
    select owner_id into v_owner_id from public.quotes where id = v_quote_id;
    select coalesce(capostipite_sale_mode,'BUNDLE') into v_mode from public.profiles where id = v_owner_id;
    if v_owner_id is distinct from v_g.owner_id then
      select exists(
        select 1 from public.quote_items qi
         where qi.quote_id = v_quote_id
           and qi.supplier_id = v_g.owner_id
           and public.quote_item_is_blind(qi, v_mode)
      ) into v_is_blind;
    end if;
  end if;

  if v_is_blind then
    select business_name, full_name, brand_logo_url, brand_primary_color into v_p from public.profiles where id = v_owner_id;
    select email into v_email from auth.users where id = v_owner_id;
  else
    select business_name, full_name, brand_logo_url, brand_primary_color into v_p from public.profiles where id = v_g.owner_id;
    select email into v_email from auth.users where id = v_g.owner_id;
  end if;

  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_g.entry_id;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);

  select count(*) into v_total from public._gallery_base_media(v_g.id);
  select count(*) into v_pool_n from public._gallery_pool(v_g.id, v_sel.round);
  select count(*) into v_decided_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round;
  select count(*) into v_kept_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', gm.id, 'drive_file_id', gm.drive_file_id, 'thumbnail_link', gm.thumbnail_link,
           'media_type', gm.media_type, 'album_moment', gm.album_moment, 'source_name', gm.source_name,
           'decision', d.keep) order by gm.album_moment nulls last, gm.created_at), '[]'::jsonb)
    into v_media
  from public.gallery_media gm
  join public._gallery_pool(v_g.id, v_sel.round) p on p.media_id = gm.id
  left join public.gallery_selection_decisions d on d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round;

  return jsonb_build_object(
    'ok', true,
    'gallery', jsonb_build_object(
      'title', v_g.title, 'couple_label', v_g.couple_label, 'kind', v_g.kind,
      'event_date', v_date, 'expires_at', v_g.share_expires_at),
    'photographer', jsonb_build_object(
      'business_name', v_p.business_name, 'full_name', v_p.full_name, 'email', v_email,
      'logo', v_p.brand_logo_url, 'color', v_p.brand_primary_color),
    'selection', jsonb_build_object(
      'round', v_sel.round, 'status', v_sel.status, 'target_min', v_sel.target_min, 'target_max', v_sel.target_max,
      'total', v_total, 'pool', v_pool_n, 'decided', v_decided_n, 'kept', v_kept_n,
      'submitted_at', v_sel.submitted_at),
    'media', v_media);
end$$;

-- MEDIO — il capostipite (owner dell'evento) non aveva alcuna visibilità sullo
-- stato della selezione foto quando la galleria appartiene al fornitore
-- esterno reclutato: la feature era scritta pensando solo al fornitore
-- singolo. Estesa la lettura anche al capostipite dell'evento collegato.
drop policy if exists gsel_read_owner on public.gallery_selection;
create policy gsel_read_owner on public.gallery_selection for select using (
  is_admin() or exists (
    select 1 from public.event_galleries g
    left join public.calendar_entries ce on ce.id = g.entry_id
    where g.id = gallery_id
      and (g.owner_id = auth.uid() or public.is_wedding_couple(g.entry_id) or ce.owner_id = auth.uid())
  )
);
drop policy if exists gsd_read_owner on public.gallery_selection_decisions;
create policy gsd_read_owner on public.gallery_selection_decisions for select using (
  is_admin() or exists (
    select 1 from public.event_galleries g
    left join public.calendar_entries ce on ce.id = g.entry_id
    where g.id = gallery_id
      and (g.owner_id = auth.uid() or public.is_wedding_couple(g.entry_id) or ce.owner_id = auth.uid())
  )
);

-- ----------------------------------------------------------------------------
-- 2) LEAK CRITICO — "Chiedi una recensione": un fornitore blind sul preventivo
--    del capostipite poteva chiedere (e nel collaudo ha REALMENTE mandato)
--    un'email al cliente col proprio nome vero, autorivelandosi. Causa:
--    review_is_pro_of_entry considerava chiunque risultasse in
--    calendar_entry_participants (dove ogni fornitore accettato entra
--    automaticamente, blind o no — corretto per quello scopo operativo) come
--    autorizzato anche lato CLIENTE, senza mai controllare il blind.
-- ----------------------------------------------------------------------------
create or replace function public.review_is_pro_of_entry(p_entry uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from calendar_entries ce where ce.id = p_entry and ce.owner_id = p_uid)
      or exists (select 1 from event_galleries g where g.entry_id = p_entry and g.owner_id = p_uid)
      or exists (
        select 1 from calendar_entry_participants cp
        join calendar_entries ce on ce.id = cp.entry_id
        where cp.entry_id = p_entry and cp.user_id = p_uid
          and not exists (
            select 1 from quote_items qi
            join quotes q on q.id = qi.quote_id
            join profiles pr on pr.id = q.owner_id
            where q.id = ce.quote_id
              and qi.supplier_id = p_uid
              and public.quote_item_is_blind(qi, coalesce(pr.capostipite_sale_mode,'BUNDLE'))
          )
      );
$$;

-- ----------------------------------------------------------------------------
-- 3) MEDIO — couple_visits_summary non filtrava le sezioni per chi legge: un
--    fornitore periferico (proprietario solo della galleria foto) vedeva lo
--    stesso identico riepilogo del capostipite, incluso quanto tempo il
--    cliente ha passato sul tab "contratto" — competenza esclusiva del
--    capostipite. Ora un professionista che non è l'owner dell'evento vede
--    solo le sezioni della propria area (quelle che iniziano con "foto"/
--    "galleria"); l'owner dell'evento continua a vedere tutto.
-- ----------------------------------------------------------------------------
create or replace function public.couple_visits_summary(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ok boolean; v_is_owner boolean; v_uid uuid := auth.uid();
begin
  select exists (select 1 from calendar_entries ce where ce.id = p_entry and ce.owner_id = v_uid)
    into v_is_owner;
  select public.is_admin() or v_is_owner
      or exists (select 1 from event_galleries g where g.entry_id = p_entry and g.owner_id = v_uid)
    into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('error','forbidden'); end if;

  return (
    with v as (
      select cv.*, greatest(0, extract(epoch from (cv.last_seen_at - cv.started_at)))::int as secondi
        from couple_visits cv where cv.entry_id = p_entry
          and (public.is_admin() or v_is_owner or cv.section ilike 'foto%' or cv.section ilike 'galleria%')
    ), reali as (select * from v where secondi >= 5)
    select jsonb_build_object(
      'visite',        (select count(*) from reali),
      'rimbalzi',      (select count(*) from v where secondi < 5),
      'secondi_totali',(select coalesce(sum(secondi),0) from reali),
      'ultima',        (select max(last_seen_at) from v),
      'prima',         (select min(started_at) from v),
      'persone',       (select count(distinct user_id) from v),
      'sezioni',       coalesce((select jsonb_agg(x order by x->>'secondi' desc) from (
                          select jsonb_build_object('sezione', section, 'visite', count(*),
                                                    'secondi', sum(secondi), 'ultima', max(last_seen_at)) as x
                            from reali group by section) s), '[]'::jsonb),
      'ultime',        coalesce((select jsonb_agg(y order by y->>'quando' desc) from (
                          select jsonb_build_object('quando', last_seen_at, 'sezione', section,
                                                    'secondi', secondi,
                                                    'chi', coalesce((select full_name from profiles p where p.id = r.user_id), 'Cliente')) as y
                            from reali r order by last_seen_at desc limit 12) t), '[]'::jsonb)
    )
  );
end$$;

-- ============================================================================
-- 4) CRITICO, confermato dal vivo — due preventivi che assegnano lo stesso
--    fornitore alla stessa data, firmati in parallelo esatto, sono ENTRAMBI
--    passati: nessun vincolo a livello DB impediva due appuntamenti EVENTO
--    per lo stesso fornitore nello stesso giorno (CICLO-03 mitigava solo la
--    finestra letta-poi-scritta lato applicazione, non la eliminava).
--
--    Prima di poter aggiungere il vincolo, trovati 23 coppie di righe
--    supplier_appointments duplicate in produzione — MA non sono vere doppie
--    prenotazioni: sono lo STESSO evento reale contato due volte, una volta
--    da "preventivo accettato" (source_quote_id) e una volta da "contratto
--    firmato" (source_contract_id), perché il trigger sul contratto non
--    sapeva mai controllare se l'evento aveva già un appuntamento dal lato
--    preventivo. Consolidate in un'unica riga prima di applicare il vincolo.
-- ============================================================================
do $$
declare r record; v_merged int := 0;
begin
  for r in
    select q.id as q_id, c.id as c_id, c.source_contract_id as c_contract
    from public.supplier_appointments q
    join public.supplier_appointments c
      on c.owner_id = q.owner_id and c.date = q.date and c.id <> q.id
    join public.contracts ct on ct.id = c.source_contract_id
    where q.kind = 'EVENTO' and c.kind = 'EVENTO'
      and q.source_quote_id is not null and q.source_contract_id is null
      and c.source_contract_id is not null and c.source_quote_id is null
      and ct.quote_id = q.source_quote_id
  loop
    update public.supplier_appointments
       set source_contract_id = r.c_contract,
           notes = 'Da preventivo accettato e contratto firmato', updated_at = now()
     where id = r.q_id;
    delete from public.supplier_appointments where id = r.c_id;
    v_merged := v_merged + 1;
  end loop;
  raise notice 'CICLO-03-bis: consolidate % coppie di appuntamenti duplicati (stesso evento, quote+contratto)', v_merged;
end$$;

-- Un solo appuntamento EVENTO per fornitore per giorno: è il vincolo che
-- rende impossibile la race, non solo un controllo applicativo aggirabile.
create unique index if not exists idx_supplier_appointments_evento_no_double
  on public.supplier_appointments(owner_id, date) where kind = 'EVENTO';

-- Il trigger sul contratto ora si aggancia all'appuntamento già creato dal
-- preventivo per lo STESSO quote_id (stesso evento) invece di inserirne un
-- secondo alla cieca; se invece esiste già un appuntamento per un evento
-- DIVERSO su quella data, l'insert va a sbattere sul vincolo sopra e la
-- transazione (quindi anche la firma del contratto) si annulla — è la
-- classe di conflitto giusta da bloccare, non da nascondere con un merge.
create or replace function auto_block_availability_from_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_supplier uuid;
begin
  if NEW.status <> 'FIRMATO' or NEW.event_date is null then return NEW; end if;

  if NEW.direct_client_id is not null then
    update public.supplier_appointments
       set date = NEW.event_date, title = coalesce(NEW.title,'Evento'),
           source_contract_id = NEW.id, notes = 'Da contratto firmato', updated_at = now()
     where owner_id = NEW.owner_id and date = NEW.event_date
       and (source_quote_id = NEW.quote_id or source_contract_id = NEW.id);
    if not found then
      insert into public.supplier_appointments(owner_id, kind, title, date, supplier_client_id, source_contract_id, notes)
      values (NEW.owner_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.direct_client_id, NEW.id, 'Da contratto firmato');
    end if;
    perform public.recompute_day_availability(NEW.owner_id, NEW.event_date);
  end if;

  if NEW.direct_client_id is null and NEW.quote_id is not null then
    for v_supplier in
      select distinct qi.supplier_id from public.quote_items qi
       where qi.quote_id = NEW.quote_id and qi.supplier_id is not null
    loop
      update public.supplier_appointments
         set date = NEW.event_date, title = coalesce(NEW.title,'Evento'),
             source_contract_id = NEW.id, notes = 'Voce contratto firmato', updated_at = now()
       where owner_id = v_supplier and date = NEW.event_date
         and (source_quote_id = NEW.quote_id or source_contract_id = NEW.id);
      if not found then
        insert into public.supplier_appointments(owner_id, kind, title, date, source_contract_id, notes)
        values (v_supplier, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.id, 'Voce contratto firmato');
      end if;
      perform public.recompute_day_availability(v_supplier, NEW.event_date);
    end loop;
  end if;

  return NEW;
end$$;
