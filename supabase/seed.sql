-- ============================================================================
-- Wedding Platform — Seed
--   * Categorie servizio standard
--   * 6 utenti test (1 admin + 1 wp + 1 location + 3 fornitori)
--   * Collaborations attive Giulia <-> 3 fornitori, Villa Aurora <-> fioraio
--   * Servizi catalogo: 8 fioraio + 5 fotografo + 6 catering + 4 location
-- Password test universale: Test123!
-- ============================================================================

-- NB: la funzione seed_user(...) e' creata in 20260521150300_seed_helpers.sql.

-- 1. Categorie standard -------------------------------------------------------
insert into service_categories (id, name, slug, subrole, is_standard) values
  ('11111111-0000-0000-0000-000000000001','Bouquet sposa',          'bouquet-sposa',          'fioraio',   true),
  ('11111111-0000-0000-0000-000000000002','Addobbi cerimonia',      'addobbi-cerimonia',      'fioraio',   true),
  ('11111111-0000-0000-0000-000000000003','Centrotavola',           'centrotavola',           'fioraio',   true),
  ('11111111-0000-0000-0000-000000000004','Composizioni esterno',   'composizioni-esterno',   'fioraio',   true),
  ('11111111-0000-0000-0000-000000000010','Servizio fotografico',   'servizio-fotografico',   'fotografo', true),
  ('11111111-0000-0000-0000-000000000011','Servizio video',         'servizio-video',         'fotografo', true),
  ('11111111-0000-0000-0000-000000000012','Album fotografico',      'album-fotografico',      'fotografo', true),
  ('11111111-0000-0000-0000-000000000013','Riprese drone',          'riprese-drone',          'fotografo', true),
  ('11111111-0000-0000-0000-000000000020','Menu matrimonio',        'menu-matrimonio',        'catering',  true),
  ('11111111-0000-0000-0000-000000000021','Servizio bar',           'servizio-bar',           'catering',  true),
  ('11111111-0000-0000-0000-000000000022','Personale servizio',     'personale-servizio',     'catering',  true),
  ('11111111-0000-0000-0000-000000000030','Affitto sala matrimonio','affitto-sala',           'location',  true),
  ('11111111-0000-0000-0000-000000000031','Allestimento sala',      'allestimento-sala',      'location',  true),
  ('11111111-0000-0000-0000-000000000032','Aperitivo di benvenuto', 'aperitivo-benvenuto',    'location',  true),
  ('11111111-0000-0000-0000-000000000033','Cena di gala',           'cena-gala',              'location',  true),
  ('11111111-0000-0000-0000-000000000090','Wedding cake',           'wedding-cake',           null,        true),
  ('11111111-0000-0000-0000-000000000091','Auto sposi',             'auto-sposi',             null,        true),
  ('11111111-0000-0000-0000-000000000092','Confetti e bomboniere',  'confetti-bomboniere',    null,        true),
  ('11111111-0000-0000-0000-000000000093','Inviti e partecipazioni','inviti-partecipazioni',  null,        true)
on conflict (slug) do nothing;

-- 2. Utenti test --------------------------------------------------------------
select seed_user(
  '00000000-aaaa-0000-0000-000000000001'::uuid,
  'admin@wp-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','ADMIN','full_name','Admin Test')
);
select seed_user(
  '00000000-aaaa-0000-0000-000000000002'::uuid,
  'giulia@wp-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','WEDDING_PLANNER','full_name','Giulia Rossi')
);
select seed_user(
  '00000000-aaaa-0000-0000-000000000003'::uuid,
  'manager@villaaurora-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','LOCATION','full_name','Villa Aurora','business_name','Villa Aurora Srl')
);
select seed_user(
  '00000000-aaaa-0000-0000-000000000004'::uuid,
  'info@fioreriabianchi-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','FORNITORE','subrole','fioraio','full_name','Anna Bianchi','business_name','Fioreria Bianchi')
);
select seed_user(
  '00000000-aaaa-0000-0000-000000000005'::uuid,
  'mario@foto-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','FORNITORE','subrole','fotografo','full_name','Mario Foto','business_name','Mario Foto Studio')
);
select seed_user(
  '00000000-aaaa-0000-0000-000000000006'::uuid,
  'info@cateringsole-test.it'::text,
  'Test123!'::text,
  jsonb_build_object('role','FORNITORE','subrole','catering','full_name','Luca Sole','business_name','Catering Sole')
);

-- 3. Aggiusta business_name dove il trigger non lo ha settato ----------------
update profiles set business_name = 'Villa Aurora Srl'  where id = '00000000-aaaa-0000-0000-000000000003';
update profiles set business_name = 'Fioreria Bianchi'  where id = '00000000-aaaa-0000-0000-000000000004';
update profiles set business_name = 'Mario Foto Studio' where id = '00000000-aaaa-0000-0000-000000000005';
update profiles set business_name = 'Catering Sole'     where id = '00000000-aaaa-0000-0000-000000000006';

-- 4. Collaborations attive ---------------------------------------------------
insert into collaborations (capostipite_id, fornitore_id, status, accepted_at) values
  ('00000000-aaaa-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000004','ACTIVE', now()),
  ('00000000-aaaa-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000005','ACTIVE', now()),
  ('00000000-aaaa-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000006','ACTIVE', now()),
  ('00000000-aaaa-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000004','ACTIVE', now())
on conflict do nothing;

-- 5. Servizi (catalogo) ------------------------------------------------------
-- 8 servizi Fioreria Bianchi (fornitore 04)
insert into services (id, fornitore_id, category_id, name, description, base_price, unit) values
  ('22220000-0004-0000-0000-000000000001','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000001','Bouquet sposa classico','Composizione rose bianche e peonie',180,'PEZZO'),
  ('22220000-0004-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000001','Bouquet sposa boho',   'Stile naturale con fiori di campo',150,'PEZZO'),
  ('22220000-0004-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','Addobbi cerimonia chiesa','Composizioni altare + panche',850,'EVENTO'),
  ('22220000-0004-0000-0000-000000000004','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','Addobbi cerimonia civile','Set arco floreale',600,'EVENTO'),
  ('22220000-0004-0000-0000-000000000005','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000003','Centrotavola standard','Composizione tonda 30cm',45,'PEZZO'),
  ('22220000-0004-0000-0000-000000000006','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000003','Centrotavola tavolo principale','Composizione lineare 1m',180,'PEZZO'),
  ('22220000-0004-0000-0000-000000000007','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','Composizione ingresso','Coppia di vasi alti decorati',320,'EVENTO'),
  ('22220000-0004-0000-0000-000000000008','00000000-aaaa-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','Petali per lancio','Sacchetti petali (per 100 invitati)',180,'EVENTO');

-- 5 servizi Mario Foto (fornitore 05)
insert into services (id, fornitore_id, category_id, name, description, base_price, unit) values
  ('22220000-0005-0000-0000-000000000001','00000000-aaaa-0000-0000-000000000005','11111111-0000-0000-0000-000000000010','Servizio fotografico base','8 ore di copertura, foto digitali alta risoluzione',1500,'EVENTO'),
  ('22220000-0005-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000005','11111111-0000-0000-0000-000000000010','Servizio fotografico premium','Intera giornata, secondo fotografo, foto ritoccate',2400,'EVENTO'),
  ('22220000-0005-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000005','11111111-0000-0000-0000-000000000012','Album fotografico 30x30','60 pagine stampa fine art',650,'PEZZO'),
  ('22220000-0005-0000-0000-000000000004','00000000-aaaa-0000-0000-000000000005','11111111-0000-0000-0000-000000000011','Video matrimonio','Trailer 3 min + video lungo 25 min',1800,'EVENTO'),
  ('22220000-0005-0000-0000-000000000005','00000000-aaaa-0000-0000-000000000005','11111111-0000-0000-0000-000000000013','Riprese drone','Riprese aeree (2 ore)',450,'EVENTO');

-- 6 servizi Catering Sole (fornitore 06)
insert into services (id, fornitore_id, category_id, name, description, base_price, unit) values
  ('22220000-0006-0000-0000-000000000001','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000020','Menu base','5 portate + dolce',95,'PERSONA'),
  ('22220000-0006-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000020','Menu premium','7 portate con piatti gourmet',130,'PERSONA'),
  ('22220000-0006-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000020','Menu vegano','Menu vegetale 6 portate',110,'PERSONA'),
  ('22220000-0006-0000-0000-000000000004','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000021','Open bar serale','3 ore open bar + barman',18,'PERSONA'),
  ('22220000-0006-0000-0000-000000000005','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000021','Bar analcolico','Mocktail e succhi 3 ore',8,'PERSONA'),
  ('22220000-0006-0000-0000-000000000006','00000000-aaaa-0000-0000-000000000006','11111111-0000-0000-0000-000000000022','Camerieri extra','Cameriere/ora oltre lo standard',28,'ORA');

-- 4 servizi Villa Aurora (location 03)
insert into services (id, fornitore_id, category_id, name, description, base_price, unit) values
  ('22220000-0003-0000-0000-000000000001','00000000-aaaa-0000-0000-000000000003','11111111-0000-0000-0000-000000000030','Affitto sala matrimonio','Sala interna fino a 200 invitati',8000,'EVENTO'),
  ('22220000-0003-0000-0000-000000000002','00000000-aaaa-0000-0000-000000000003','11111111-0000-0000-0000-000000000031','Allestimento sala','Tovagliato, mise en place, candele',1200,'EVENTO'),
  ('22220000-0003-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000003','11111111-0000-0000-0000-000000000032','Aperitivo di benvenuto','Welcome drink in giardino',25,'PERSONA'),
  ('22220000-0003-0000-0000-000000000004','00000000-aaaa-0000-0000-000000000003','11111111-0000-0000-0000-000000000033','Cena di gala','Spazio dedicato per cena 200 persone',45,'PERSONA');

-- 6. Modificatori esempio ----------------------------------------------------
insert into service_modifiers (service_id, name, modifier_type, value) values
  ('22220000-0004-0000-0000-000000000001','Fiori esotici (+30%)','PERCENT', 30),
  ('22220000-0004-0000-0000-000000000001','Tema bianco (-10%)',  'PERCENT',-10),
  ('22220000-0006-0000-0000-000000000001','Fascia premium (+20%)','PERCENT', 20),
  ('22220000-0006-0000-0000-000000000002','Tartufo stagione (+15%)','PERCENT', 15),
  ('22220000-0005-0000-0000-000000000002','Trasferta extra (>50km)','FIXED', 250);

-- 7. Foto di test (placeholder URL locali) -----------------------------------
insert into service_photos (service_id, original_url, thumbnail_url, sort_order) values
  ('22220000-0004-0000-0000-000000000001','/seed-photos/bouquet1.jpg','/seed-photos/bouquet1-thumb.jpg',0),
  ('22220000-0004-0000-0000-000000000001','/seed-photos/bouquet1b.jpg','/seed-photos/bouquet1b-thumb.jpg',1),
  ('22220000-0004-0000-0000-000000000003','/seed-photos/chiesa1.jpg','/seed-photos/chiesa1-thumb.jpg',0),
  ('22220000-0005-0000-0000-000000000001','/seed-photos/photo-base.jpg','/seed-photos/photo-base-thumb.jpg',0),
  ('22220000-0005-0000-0000-000000000002','/seed-photos/photo-premium.jpg','/seed-photos/photo-premium-thumb.jpg',0),
  ('22220000-0006-0000-0000-000000000001','/seed-photos/menu-base.jpg','/seed-photos/menu-base-thumb.jpg',0),
  ('22220000-0006-0000-0000-000000000002','/seed-photos/menu-premium.jpg','/seed-photos/menu-premium-thumb.jpg',0),
  ('22220000-0003-0000-0000-000000000001','/seed-photos/villa-sala.jpg','/seed-photos/villa-sala-thumb.jpg',0),
  ('22220000-0003-0000-0000-000000000001','/seed-photos/villa-giardino.jpg','/seed-photos/villa-giardino-thumb.jpg',1),
  ('22220000-0003-0000-0000-000000000003','/seed-photos/welcome.jpg','/seed-photos/welcome-thumb.jpg',0);
