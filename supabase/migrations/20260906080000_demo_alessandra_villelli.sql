-- ============================================================================
-- DEMO PRESENTAZIONE "Alessandra Villelli" (WP prospect, 06/09/2026).
-- Mondo demo COMPLETO e AUTO-CONTENUTO per mostrare dal vivo il flusso
-- capostipite: rete fornitori con magazzino fotografato, preventivo aggregato,
-- contratto firmato, rate di pagamento.
--
-- CANCELLAZIONE TOTALE (contratti e fatture incluse): ogni riga qui creata
-- discende via ON DELETE CASCADE dai 4 account auth.users sotto. Basta:
--
--   delete from auth.users where id in (
--     'a1e55a00-0000-4000-8000-000000000001', -- Alessandra Villelli (capostipite)
--     'a1e55a00-0000-4000-8000-000000000002', -- Scenografie Meridiana (allestimenti)
--     'a1e55a00-0000-4000-8000-000000000003', -- Fiorì di Passione (fioraio)
--     'a1e55a00-0000-4000-8000-000000000004'  -- Obiettivo Sud (fotografo)
--   );
--
-- (cascata: profiles → collaborations/services→service_photos/quotes→quote_items/
--  calendar_entries→wedding_couple_members/contracts→contract_payments)
-- ============================================================================

do $$
declare
  v_alessandra  uuid := 'a1e55a00-0000-4000-8000-000000000001';
  v_scenografie uuid := 'a1e55a00-0000-4000-8000-000000000002';
  v_fiori       uuid := 'a1e55a00-0000-4000-8000-000000000003';
  v_foto        uuid := 'a1e55a00-0000-4000-8000-000000000004';

  v_event    uuid := 'a1e55a00-0000-4000-8000-000000000501';
  v_quote    uuid := 'a1e55a00-0000-4000-8000-000000000601';
  v_contract uuid := 'a1e55a00-0000-4000-8000-000000000801';

  v_cat_scen_sala    uuid; v_cat_scen_cerim uuid; v_cat_scen_noleggio uuid; v_cat_scen_scenog uuid;
  v_cat_fiori_bouquet uuid; v_cat_fiori_addobbi uuid; v_cat_fiori_centro uuid; v_cat_fiori_esterno uuid;
  v_cat_foto_servizio uuid; v_cat_foto_video uuid; v_cat_foto_album uuid;

  v_total numeric(12,2);
begin
  -- 1) I 4 account (password unica per la demo: vedi nota in fondo) ----------
  perform seed_user(v_alessandra,  'giovanni.scozzafava+test-alessandra@gmail.com',  'Demo2026!Skorpio', jsonb_build_object('role','WEDDING_PLANNER','full_name','Alessandra Villelli'));
  perform seed_user(v_scenografie, 'giovanni.scozzafava+test-scenografie@gmail.com', 'Demo2026!Skorpio', jsonb_build_object('role','FORNITORE','subrole','allestimenti','full_name','Scenografie Meridiana'));
  perform seed_user(v_fiori,       'giovanni.scozzafava+test-fioripassione@gmail.com','Demo2026!Skorpio', jsonb_build_object('role','FORNITORE','subrole','fioraio','full_name','Fiorì di Passione'));
  perform seed_user(v_foto,        'giovanni.scozzafava+test-obiettivosud@gmail.com', 'Demo2026!Skorpio', jsonb_build_object('role','FORNITORE','subrole','fotografo','full_name','Obiettivo Sud'));

  -- Idempotenza: se la migration viene ri-applicata, ripartiamo puliti sulle
  -- righe "foglia" di questi 4 account (i profili restano, i dati si riscrivono).
  delete from public.contracts        where owner_id = v_alessandra;
  delete from public.quotes           where owner_id = v_alessandra;
  delete from public.calendar_entries where owner_id = v_alessandra;
  delete from public.collaborations   where capostipite_id = v_alessandra;
  delete from public.services         where fornitore_id in (v_scenografie, v_fiori, v_foto);

  -- 2) Profili completi -------------------------------------------------------
  update public.profiles set
    business_name = 'Alessandra Villelli Wedding & Events', full_name = 'Alessandra Villelli',
    phone = '+39 347 5551234', city = 'Catanzaro', zip = '88100', country = 'Italia',
    tagline = 'Wedding planner in Calabria, coordino la tua rete di fornitori in un unico posto',
    bio = 'Organizzo matrimoni in tutta la Calabria con una rete di fornitori selezionati: preventivi aggregati, contratto unico, un solo referente per la coppia.',
    is_discoverable = true, onboarding_complete = true,
    brand_primary_color = '#7a3b3b', brand_secondary_color = '#c9a227'
  where id = v_alessandra;

  update public.profiles set
    business_name = 'Scenografie Meridiana', full_name = 'Scenografie Meridiana',
    phone = '+39 348 5552001', city = 'Lamezia Terme', zip = '88046', country = 'Italia',
    tagline = 'Allestimenti e scenografie per matrimoni ed eventi',
    bio = 'Progettiamo e montiamo allestimenti su misura: sale, cerimonie, backdrop fotografici, noleggio arredi scenici.',
    is_discoverable = true, onboarding_complete = true
  where id = v_scenografie;

  update public.profiles set
    business_name = 'Fiorì di Passione', full_name = 'Fiorì di Passione',
    phone = '+39 348 5552002', city = 'Catanzaro', zip = '88100', country = 'Italia',
    tagline = 'Fioristi per cerimonie ed eventi',
    bio = 'Bouquet, addobbi e composizioni floreali per il tuo giorno più importante.',
    is_discoverable = true, onboarding_complete = true
  where id = v_fiori;

  update public.profiles set
    business_name = 'Obiettivo Sud', full_name = 'Obiettivo Sud',
    phone = '+39 348 5552003', city = 'Catanzaro', zip = '88100', country = 'Italia',
    tagline = 'Fotografia e video di matrimonio',
    bio = 'Racconto per immagini il giorno del sì: foto, video e album stampati.',
    is_discoverable = true, onboarding_complete = true
  where id = v_foto;

  -- 3) Categorie standard esistenti (riusate, non ne creiamo di nuove) --------
  select id into v_cat_scen_sala    from public.service_categories where slug = 'allestimenti-sala';
  select id into v_cat_scen_cerim   from public.service_categories where slug = 'allestimenti-cerimonia';
  select id into v_cat_scen_noleggio from public.service_categories where slug = 'allestimenti-noleggio-arredi';
  select id into v_cat_scen_scenog  from public.service_categories where slug = 'allestimenti-scenografie';
  select id into v_cat_fiori_bouquet from public.service_categories where slug = 'bouquet-sposa';
  select id into v_cat_fiori_addobbi from public.service_categories where slug = 'addobbi-cerimonia';
  select id into v_cat_fiori_centro  from public.service_categories where slug = 'centrotavola';
  select id into v_cat_fiori_esterno from public.service_categories where slug = 'composizioni-esterno';
  select id into v_cat_foto_servizio from public.service_categories where slug = 'servizio-fotografico';
  select id into v_cat_foto_video    from public.service_categories where slug = 'servizio-video';
  select id into v_cat_foto_album    from public.service_categories where slug = 'album-fotografico';

  -- 4) Magazzino fornitori: servizi + foto reali ------------------------------
  insert into public.services (id, fornitore_id, category_id, name, description, base_price, unit) values
    ('a1e55a00-0000-4000-8000-000000000101', v_scenografie, v_cat_scen_scenog,   'Allestimento scenografico sala ricevimento', 'Scenografia completa: tendaggi, luci, elementi decorativi coordinati al tema.', 2400, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000102', v_scenografie, v_cat_scen_cerim,    'Allestimento cerimonia con arco floreale',    'Arco scenografico, velluti e sedute per la cerimonia.', 950, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000103', v_scenografie, v_cat_scen_noleggio, 'Noleggio sedute Chiavarine',                  'Sedia Chiavarina imbottita, prezzo a pezzo.', 12, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000104', v_scenografie, v_cat_scen_scenog,   'Backdrop fotografico luminoso',               'Struttura scenografica retroilluminata per photo corner.', 380, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000105', v_scenografie, v_cat_scen_sala,     'Tavolo imperiale con candelabri',             'Allestimento tavolo imperiale, candelabri a sette braccia inclusi.', 25, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000106', v_scenografie, v_cat_scen_noleggio, 'Lounge photo-booth con divano vintage',       'Angolo lounge scenografico per foto informali.', 300, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000201', v_fiori,       v_cat_fiori_bouquet, 'Bouquet sposa',                                'Bouquet classico stagionale.', 180, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000202', v_fiori,       v_cat_fiori_addobbi, 'Addobbi cerimonia',                            'Addobbo floreale altare/gazebo cerimonia.', 780, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000203', v_fiori,       v_cat_fiori_centro,  'Centrotavola',                                 'Composizione floreale centrotavola, prezzo a tavolo.', 40, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000204', v_fiori,       v_cat_fiori_esterno, 'Composizioni esterno',                         'Composizioni floreali per ingresso e area esterna.', 350, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000301', v_foto,        v_cat_foto_servizio, 'Servizio fotografico',                         'Copertura fotografica intera giornata.', 2200, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000302', v_foto,        v_cat_foto_video,    'Servizio video',                               'Video matrimonio con drone incluso.', 1500, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000303', v_foto,        v_cat_foto_album,    'Album fotografico',                            'Album stampato 30x30, 40 pagine.', 600, 'PEZZO');

  insert into public.service_photos (service_id, original_url, thumbnail_url, sort_order) values
    ('a1e55a00-0000-4000-8000-000000000101', 'https://images.pexels.com/photos/37828118/pexels-photo-37828118.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37828118/pexels-photo-37828118.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000102', 'https://images.pexels.com/photos/14703685/pexels-photo-14703685.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/14703685/pexels-photo-14703685.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000103', 'https://images.pexels.com/photos/30298624/pexels-photo-30298624.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30298624/pexels-photo-30298624.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000104', 'https://images.pexels.com/photos/17206082/pexels-photo-17206082.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/17206082/pexels-photo-17206082.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000105', 'https://images.pexels.com/photos/36154338/pexels-photo-36154338.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/36154338/pexels-photo-36154338.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000106', 'https://images.pexels.com/photos/33136449/pexels-photo-33136449.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/33136449/pexels-photo-33136449.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000201', 'https://images.pexels.com/photos/30891127/pexels-photo-30891127.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30891127/pexels-photo-30891127.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000202', 'https://images.pexels.com/photos/31517332/pexels-photo-31517332.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/31517332/pexels-photo-31517332.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000203', 'https://images.pexels.com/photos/28115373/pexels-photo-28115373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/28115373/pexels-photo-28115373.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000204', 'https://images.pexels.com/photos/7119089/pexels-photo-7119089.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/7119089/pexels-photo-7119089.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000301', 'https://images.pexels.com/photos/30372608/pexels-photo-30372608.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30372608/pexels-photo-30372608.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000302', 'https://images.pexels.com/photos/31798269/pexels-photo-31798269.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/31798269/pexels-photo-31798269.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000303', 'https://images.pexels.com/photos/32507641/pexels-photo-32507641.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32507641/pexels-photo-32507641.jpeg?auto=compress&cs=tinysrgb&h=350', 0);

  -- 5) Rete: collaborazioni ATTIVE ---------------------------------------------
  insert into public.collaborations (capostipite_id, fornitore_id, status, accepted_at) values
    (v_alessandra, v_scenografie, 'ACTIVE', now() - interval '20 days'),
    (v_alessandra, v_fiori,       'ACTIVE', now() - interval '18 days'),
    (v_alessandra, v_foto,        'ACTIVE', now() - interval '15 days');

  -- 6) Evento + coppia ----------------------------------------------------------
  -- calendar_entries NON porta più i dati del cliente (PII split): client_name/
  -- client_email/value_amount vivono in calendar_entries_private (entry_id).
  insert into public.calendar_entries (id, owner_id, title, date_from, date_to, status, event_kind, evento_stato, ambito_capostipite, guest_count, is_test) values
    (v_event, v_alessandra, 'Matrimonio Ferraro · Conte', '2027-05-08', '2027-05-08', 'CONFERMATA', 'matrimonio', 'PIANIFICAZIONE', 'COMPLETO', 90, true);

  -- Un trigger su calendar_entries crea già la riga "ombra" in _private: qui la
  -- valorizziamo (on conflict, non insert secco) invece di duplicarla.
  insert into public.calendar_entries_private (entry_id, client_name, client_email) values
    (v_event, 'Sara Ferraro & Davide Conte', 'sara.ferraro@example.com')
  on conflict (entry_id) do update set client_name = excluded.client_name, client_email = excluded.client_email;

  insert into public.wedding_couple_members (entry_id, email, full_name, role) values
    (v_event, 'sara.ferraro@example.com', 'Sara Ferraro', 'SPOSA'),
    (v_event, 'davide.conte@example.com', 'Davide Conte', 'SPOSO');

  -- 7) Preventivo aggregato (voci dai 3 fornitori) + accettazione --------------
  insert into public.quotes (id, owner_id, title, client_name, client_email, event_date, guest_count, table_count, status, event_kind, default_markup_percent, access_token, sent_at, accepted_at, is_test) values
    (v_quote, v_alessandra, 'Preventivo Ferraro-Conte · Allestimenti, fiori, foto', 'Sara Ferraro & Davide Conte', 'sara.ferraro@example.com', '2027-05-08', 90, 9, 'ACCETTATO', 'matrimonio', 20, gen_random_uuid(), now() - interval '12 days', now() - interval '9 days', true);

  insert into public.quote_items (quote_id, service_id, supplier_id, name_snapshot, description_snapshot, unit_snapshot, snapshot_price, quantity, sort_order) values
    (v_quote, 'a1e55a00-0000-4000-8000-000000000101', v_scenografie, 'Allestimento scenografico sala ricevimento', 'Scenografia completa: tendaggi, luci, elementi decorativi coordinati al tema.', 'EVENTO', 2400, 1, 0),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000102', v_scenografie, 'Allestimento cerimonia con arco floreale',    'Arco scenografico, velluti e sedute per la cerimonia.',                         'EVENTO', 950,  1, 1),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000103', v_scenografie, 'Noleggio sedute Chiavarine',                  'Sedia Chiavarina imbottita, 90 pezzi.',                                          'PEZZO',  12,   90, 2),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000104', v_scenografie, 'Backdrop fotografico luminoso',               'Struttura scenografica retroilluminata per photo corner.',                       'PEZZO',  380,  1, 3),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000201', v_fiori,       'Bouquet sposa',                                'Bouquet classico stagionale.',                                                   'PEZZO',  180,  1, 4),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000202', v_fiori,       'Addobbi cerimonia',                            'Addobbo floreale altare/gazebo cerimonia.',                                      'EVENTO', 780,  1, 5),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000203', v_fiori,       'Centrotavola',                                 'Composizione floreale centrotavola, 9 tavoli.',                                  'PEZZO',  40,   9, 6),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000301', v_foto,        'Servizio fotografico',                         'Copertura fotografica intera giornata.',                                         'EVENTO', 2200, 1, 7),
    (v_quote, 'a1e55a00-0000-4000-8000-000000000303', v_foto,        'Album fotografico',                            'Album stampato 30x30, 40 pagine.',                                               'PEZZO',  600,  1, 8);

  update public.calendar_entries set quote_id = v_quote where id = v_event;

  -- 8) Contratto FIRMATO — totale = somma reale delle righe (mai a mano) -------
  select coalesce(sum(line_client), 0) into v_total from public.quote_items where quote_id = v_quote;

  insert into public.contracts (id, owner_id, quote_id, entry_id, title, client_name, client_email, event_date, total_amount, status, access_token, sections, signed_at, signature_data, is_test) values
    (v_contract, v_alessandra, v_quote, v_event, 'Contratto Matrimonio Ferraro-Conte', 'Sara Ferraro & Davide Conte', 'sara.ferraro@example.com', '2027-05-08', v_total, 'FIRMATO', gen_random_uuid(),
     '[{"heading":"Oggetto","body":"Coordinamento allestimenti, fiori e servizio fotografico per il matrimonio del 08/05/2027, come da preventivo allegato.","type":"CLAUSULE"},{"heading":"Pagamento","body":"Acconto 30% alla firma, seconda rata 50% entro 60 giorni dall''evento, saldo entro 7 giorni dall''evento.","type":"PRICE"}]'::jsonb,
     now() - interval '9 days',
     jsonb_build_object('name','Sara Ferraro','signed_at',(now() - interval '9 days')::text,'method','demo'), true);

  raise notice 'Demo Alessandra Villelli pronta. Totale contratto: % euro', v_total;
end $$;

-- Nota password demo: "Demo2026!Skorpio" per tutti e 4 gli account (solo per la
-- presentazione, da cambiare o cancellare l'intero mondo dopo).
