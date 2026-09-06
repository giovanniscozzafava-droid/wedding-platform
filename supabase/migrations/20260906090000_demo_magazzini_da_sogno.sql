-- ============================================================================
-- Espande il "magazzino" dei 3 fornitori demo della presentazione Alessandra
-- Villelli (vedi 20260906080000): da poche voci dimostrative a cataloghi
-- ampi e fotografati — il magazzino virtuale che un WP vorrebbe sfogliare
-- davvero (Giovanni, 06/09/2026: "Costruisci magazzini che tutte le WP
-- sognano"). Additivo, idempotente (on conflict do nothing): non tocca le
-- 13 voci già create, ne aggiunge 23 nuove con foto reali.
--
-- Cancellazione: invariata, ricade nella stessa cascata di 20260906080000
-- (delete from auth.users where id in (...) — vedi quella migration).
-- ============================================================================

do $$
declare
  v_scenografie uuid := 'a1e55a00-0000-4000-8000-000000000002';
  v_fiori       uuid := 'a1e55a00-0000-4000-8000-000000000003';
  v_foto        uuid := 'a1e55a00-0000-4000-8000-000000000004';

  v_cat_scen_sala     uuid; v_cat_scen_cerim uuid; v_cat_scen_noleggio uuid; v_cat_scen_scenog uuid;
  v_cat_fiori_bouquet uuid; v_cat_fiori_addobbi uuid; v_cat_fiori_centro uuid; v_cat_fiori_esterno uuid;
  v_cat_foto_servizio uuid; v_cat_foto_video uuid; v_cat_foto_album uuid; v_cat_foto_drone uuid;
begin
  select id into v_cat_scen_sala     from public.service_categories where slug = 'allestimenti-sala';
  select id into v_cat_scen_cerim    from public.service_categories where slug = 'allestimenti-cerimonia';
  select id into v_cat_scen_noleggio from public.service_categories where slug = 'allestimenti-noleggio-arredi';
  select id into v_cat_scen_scenog   from public.service_categories where slug = 'allestimenti-scenografie';
  select id into v_cat_fiori_bouquet from public.service_categories where slug = 'bouquet-sposa';
  select id into v_cat_fiori_addobbi from public.service_categories where slug = 'addobbi-cerimonia';
  select id into v_cat_fiori_centro  from public.service_categories where slug = 'centrotavola';
  select id into v_cat_fiori_esterno from public.service_categories where slug = 'composizioni-esterno';
  select id into v_cat_foto_servizio from public.service_categories where slug = 'servizio-fotografico';
  select id into v_cat_foto_video    from public.service_categories where slug = 'servizio-video';
  select id into v_cat_foto_album    from public.service_categories where slug = 'album-fotografico';
  select id into v_cat_foto_drone    from public.service_categories where slug = 'riprese-drone';

  -- 1) SCENOGRAFIE MERIDIANA — 12 voci nuove (18 totali) --------------------
  insert into public.services (id, fornitore_id, category_id, name, description, base_price, unit) values
    ('a1e55a00-0000-4000-8000-000000000107', v_scenografie, v_cat_scen_sala,     'Fontana di cioccolato scenografica',      'Fontana a cascata per angolo dolce, con frutta fresca a corredo.', 280,  'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000108', v_scenografie, v_cat_scen_scenog,   'Cascata di fiori a soffitto',              'Installazione sospesa di fiori e verde, effetto scenico sopra il tavolo sposi.', 1200, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000109', v_scenografie, v_cat_scen_cerim,    'Tunnel luminoso ingresso sposi',           'Tunnel di luci per l''ingresso trionfale in sala.', 650, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000110', v_scenografie, v_cat_scen_scenog,   'Insegne luminose personalizzate',          'Scritta al neon con i nomi degli sposi o la data.', 220, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000111', v_scenografie, v_cat_scen_noleggio, 'Noleggio candelabri a sette braccia',      'Candelabro in metallo dorato, prezzo a pezzo.', 18, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000112', v_scenografie, v_cat_scen_sala,     'Drappeggi soffitto in voile',              'Drappeggio scenografico a soffitto su tutta la sala.', 900, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000113', v_scenografie, v_cat_scen_scenog,   'Palco scenografico DJ/band',               'Palco rialzato con quinte e illuminazione dedicata.', 550, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000114', v_scenografie, v_cat_scen_scenog,   'Illuminazione architetturale sala',        'Giochi di luce colorata su pareti e soffitto.', 780, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000115', v_scenografie, v_cat_scen_sala,     'Angolo confettata scenografico',           'Postazione confettata con struttura decorata su misura.', 320, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000116', v_scenografie, v_cat_scen_cerim,    'Gazebo bianco per cerimonia esterna',      'Gazebo in legno bianco 6x4m per cerimonie in giardino.', 700, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000117', v_scenografie, v_cat_scen_noleggio, 'Noleggio tavoli rotondi con tovagliato',   'Tavolo rotondo 8 posti, tovagliato incluso.', 35, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000118', v_scenografie, v_cat_scen_sala,     'Scenografia tavolo torta nuziale',         'Base scenografica e decoro dedicato al tavolo della torta.', 260, 'EVENTO')
  on conflict (id) do nothing;

  insert into public.service_photos (service_id, original_url, thumbnail_url, sort_order) values
    ('a1e55a00-0000-4000-8000-000000000107', 'https://images.pexels.com/photos/11845552/pexels-photo-11845552.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/11845552/pexels-photo-11845552.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000108', 'https://images.pexels.com/photos/34079355/pexels-photo-34079355.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/34079355/pexels-photo-34079355.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000108', 'https://images.pexels.com/photos/34389342/pexels-photo-34389342.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/34389342/pexels-photo-34389342.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000109', 'https://images.pexels.com/photos/169192/pexels-photo-169192.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/169192/pexels-photo-169192.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000109', 'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/35629338/pexels-photo-35629338.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000110', 'https://images.pexels.com/photos/5145396/pexels-photo-5145396.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/5145396/pexels-photo-5145396.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000111', 'https://images.pexels.com/photos/30283581/pexels-photo-30283581.png?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30283581/pexels-photo-30283581.png?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000112', 'https://images.pexels.com/photos/35985252/pexels-photo-35985252.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/35985252/pexels-photo-35985252.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000112', 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/27132464/pexels-photo-27132464.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000113', 'https://images.pexels.com/photos/17315417/pexels-photo-17315417.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/17315417/pexels-photo-17315417.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000114', 'https://images.pexels.com/photos/11450799/pexels-photo-11450799.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/11450799/pexels-photo-11450799.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000115', 'https://images.pexels.com/photos/20199365/pexels-photo-20199365.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/20199365/pexels-photo-20199365.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000116', 'https://images.pexels.com/photos/17315419/pexels-photo-17315419.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/17315419/pexels-photo-17315419.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000116', 'https://images.pexels.com/photos/32854438/pexels-photo-32854438.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32854438/pexels-photo-32854438.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000117', 'https://images.pexels.com/photos/33485954/pexels-photo-33485954.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/33485954/pexels-photo-33485954.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000118', 'https://images.pexels.com/photos/18363439/pexels-photo-18363439.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/18363439/pexels-photo-18363439.jpeg?auto=compress&cs=tinysrgb&h=350', 0)
  on conflict do nothing;

  -- 2) FIORÌ DI PASSIONE — 6 voci nuove (10 totali) --------------------------
  insert into public.services (id, fornitore_id, category_id, name, description, base_price, unit) values
    ('a1e55a00-0000-4000-8000-000000000205', v_fiori, v_cat_fiori_bouquet, 'Bouquet damigelle',            'Bouquet coordinato al bouquet sposa, prezzo a pezzo.', 65, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000206', v_fiori, v_cat_fiori_bouquet, 'Boutonniere sposo e testimoni', 'Fiore all''occhiello coordinato, prezzo a pezzo.', 18, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000207', v_fiori, v_cat_fiori_addobbi, 'Cascata floreale altare',       'Composizione verticale scenografica per altare/gazebo.', 480, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000208', v_fiori, v_cat_fiori_bouquet, 'Corona di fiori per capelli',   'Corona floreale per acconciatura sposa o damigelle.', 55, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000209', v_fiori, v_cat_fiori_centro,  'Composizione tavolo torta',     'Decoro floreale dedicato al tavolo della torta nuziale.', 90, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000210', v_fiori, v_cat_fiori_esterno, 'Petali per lancio',             'Petali freschi selezionati per il lancio agli sposi.', 40, 'EVENTO')
  on conflict (id) do nothing;

  insert into public.service_photos (service_id, original_url, thumbnail_url, sort_order) values
    ('a1e55a00-0000-4000-8000-000000000205', 'https://images.pexels.com/photos/5978138/pexels-photo-5978138.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/5978138/pexels-photo-5978138.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000206', 'https://images.pexels.com/photos/18430840/pexels-photo-18430840.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/18430840/pexels-photo-18430840.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000207', 'https://images.pexels.com/photos/20654851/pexels-photo-20654851.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/20654851/pexels-photo-20654851.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000207', 'https://images.pexels.com/photos/519329/pexels-photo-519329.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/519329/pexels-photo-519329.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000208', 'https://images.pexels.com/photos/15110344/pexels-photo-15110344.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/15110344/pexels-photo-15110344.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000209', 'https://images.pexels.com/photos/5791588/pexels-photo-5791588.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/5791588/pexels-photo-5791588.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000210', 'https://images.pexels.com/photos/1808178/pexels-photo-1808178.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/1808178/pexels-photo-1808178.jpeg?auto=compress&cs=tinysrgb&h=350', 0)
  on conflict do nothing;

  -- 3) OBIETTIVO SUD — 5 voci nuove (8 totali) -------------------------------
  insert into public.services (id, fornitore_id, category_id, name, description, base_price, unit) values
    ('a1e55a00-0000-4000-8000-000000000304', v_foto, v_cat_foto_drone,    'Riprese drone',                          'Riprese aeree cerimonia e location, montaggio incluso.', 450, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000305', v_foto, v_cat_foto_servizio, 'Servizio fotografico pre-wedding',       'Sessione engagement in location a scelta, prima del matrimonio.', 350, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000306', v_foto, v_cat_foto_servizio, 'Fotobooth con stampe istantanee',        'Postazione fotobooth con stampe da regalare agli ospiti.', 380, 'EVENTO'),
    ('a1e55a00-0000-4000-8000-000000000307', v_foto, v_cat_foto_album,    'Album genitori (copia aggiuntiva)',      'Copia dell''album principale in formato ridotto per i genitori.', 250, 'PEZZO'),
    ('a1e55a00-0000-4000-8000-000000000308', v_foto, v_cat_foto_video,    'Video teaser social (same-day edit)',    'Video breve montato in giornata, pronto per i social.', 400, 'EVENTO')
  on conflict (id) do nothing;

  insert into public.service_photos (service_id, original_url, thumbnail_url, sort_order) values
    ('a1e55a00-0000-4000-8000-000000000304', 'https://images.pexels.com/photos/8845836/pexels-photo-8845836.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/8845836/pexels-photo-8845836.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000304', 'https://images.pexels.com/photos/936042/pexels-photo-936042.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/936042/pexels-photo-936042.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000305', 'https://images.pexels.com/photos/1372177/pexels-photo-1372177.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/1372177/pexels-photo-1372177.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000306', 'https://images.pexels.com/photos/33975526/pexels-photo-33975526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/33975526/pexels-photo-33975526.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000306', 'https://images.pexels.com/photos/28319428/pexels-photo-28319428.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/28319428/pexels-photo-28319428.jpeg?auto=compress&cs=tinysrgb&h=350', 1),
    ('a1e55a00-0000-4000-8000-000000000307', 'https://images.pexels.com/photos/36611021/pexels-photo-36611021.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/36611021/pexels-photo-36611021.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('a1e55a00-0000-4000-8000-000000000308', 'https://images.pexels.com/photos/36249009/pexels-photo-36249009.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/36249009/pexels-photo-36249009.jpeg?auto=compress&cs=tinysrgb&h=350', 0)
  on conflict do nothing;

  raise notice 'Magazzini espansi: Scenografie Meridiana 18 voci, Fiorì di Passione 10 voci, Obiettivo Sud 8 voci.';
end $$;
