-- ============================================================================
-- Categorie servizio standard (idempotent, safe per produzione)
-- ============================================================================

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
