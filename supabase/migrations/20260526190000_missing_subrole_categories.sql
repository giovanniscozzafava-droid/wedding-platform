-- ============================================================================
-- Categorie standard mancanti per subroles originali (make_up, musica, abiti,
-- celebrante, animazione, auto, pasticcere, videomaker). Senza queste, il
-- fornitore vedeva nel dropdown ServiceForm solo categorie subrole=NULL
-- (es. "Allestimenti", "Wedding cake") che non hanno senso per lui.
-- ============================================================================

insert into service_categories (id, name, slug, subrole, is_standard) values
  -- Make-up
  ('11111111-0000-0000-0000-000000000400','Trucco sposa',                'trucco-sposa',           'make_up',     true),
  ('11111111-0000-0000-0000-000000000401','Prova trucco',                'trucco-prova',           'make_up',     true),
  ('11111111-0000-0000-0000-000000000402','Trucco invitati',             'trucco-invitati',        'make_up',     true),
  ('11111111-0000-0000-0000-000000000403','Trucco effetti speciali',     'trucco-fx',              'make_up',     true),
  ('11111111-0000-0000-0000-000000000404','Body painting',               'body-painting',          'make_up',     true),
  ('11111111-0000-0000-0000-000000000405','Pacchetto trucco + capelli',  'trucco-capelli-combo',   'make_up',     true),
  -- Musica
  ('11111111-0000-0000-0000-000000000410','DJ set serata completa',      'dj-set',                 'musica',      true),
  ('11111111-0000-0000-0000-000000000411','Band live',                   'band-live',              'musica',      true),
  ('11111111-0000-0000-0000-000000000412','Musicista solo (sax/violino)','musicista-solo',         'musica',      true),
  ('11111111-0000-0000-0000-000000000413','Coro polifonico cerimonia',   'coro-cerimonia',         'musica',      true),
  ('11111111-0000-0000-0000-000000000414','Quartetto archi',             'quartetto-archi',        'musica',      true),
  ('11111111-0000-0000-0000-000000000415','Musica ambient aperitivo',    'musica-ambient',         'musica',      true),
  ('11111111-0000-0000-0000-000000000416','Service audio professionale', 'audio-pro',              'musica',      true),
  -- Abiti / Atelier
  ('11111111-0000-0000-0000-000000000420','Abito sposa',                 'abito-sposa',            'abiti',       true),
  ('11111111-0000-0000-0000-000000000421','Abito sposo',                 'abito-sposo',            'abiti',       true),
  ('11111111-0000-0000-0000-000000000422','Abiti damigelle',             'abiti-damigelle',        'abiti',       true),
  ('11111111-0000-0000-0000-000000000423','Abiti testimoni/madrine',     'abiti-testimoni',        'abiti',       true),
  ('11111111-0000-0000-0000-000000000424','Accessori sposa (velo/tiara)','accessori-sposa',        'abiti',       true),
  ('11111111-0000-0000-0000-000000000425','Modifiche/sartoria',          'sartoria',               'abiti',       true),
  -- Celebrante
  ('11111111-0000-0000-0000-000000000430','Cerimonia simbolica',         'cer-simbolica',          'celebrante',  true),
  ('11111111-0000-0000-0000-000000000431','Officiante cerimonia civile', 'cer-civile',             'celebrante',  true),
  ('11111111-0000-0000-0000-000000000432','Cerimonia interreligiosa',    'cer-interreligiosa',     'celebrante',  true),
  ('11111111-0000-0000-0000-000000000433','Cerimonia rinnovamento promesse','cer-rinnovamento',    'celebrante',  true),
  -- Animazione
  ('11111111-0000-0000-0000-000000000440','Animazione bambini',          'animazione-bambini',     'animazione',  true),
  ('11111111-0000-0000-0000-000000000441','Truccabimbi',                 'truccabimbi',            'animazione',  true),
  ('11111111-0000-0000-0000-000000000442','Baby dance',                  'baby-dance',             'animazione',  true),
  ('11111111-0000-0000-0000-000000000443','Giochi organizzati',          'giochi-org',             'animazione',  true),
  ('11111111-0000-0000-0000-000000000444','Angolo lettura/disegno',      'angolo-lettura',         'animazione',  true),
  ('11111111-0000-0000-0000-000000000445','Sculture palloncini',         'palloncini',             'animazione',  true),
  -- Auto / Trasporti
  ('11111111-0000-0000-0000-000000000450','Auto d''epoca',               'auto-epoca',             'auto',        true),
  ('11111111-0000-0000-0000-000000000451','Auto lusso moderna',          'auto-lusso',             'auto',        true),
  ('11111111-0000-0000-0000-000000000452','Limousine',                   'limousine',              'auto',        true),
  ('11111111-0000-0000-0000-000000000453','Sportiva',                    'auto-sportiva',          'auto',        true),
  ('11111111-0000-0000-0000-000000000454','Calesse / Carrozza',          'calesse',                'auto',        true),
  ('11111111-0000-0000-0000-000000000455','Moto / Vespa',                'moto-vespa',             'auto',        true),
  -- Pasticcere
  ('11111111-0000-0000-0000-000000000460','Wedding cake design',         'pcake-design',           'pasticcere',  true),
  ('11111111-0000-0000-0000-000000000461','Torta monumentale piani',     'torta-piani',            'pasticcere',  true),
  ('11111111-0000-0000-0000-000000000462','Mignon assortiti',            'mignon',                 'pasticcere',  true),
  ('11111111-0000-0000-0000-000000000463','Macarons / Pasticceria francese','macarons-pasticc',    'pasticcere',  true),
  ('11111111-0000-0000-0000-000000000464','Cake pops e mini cakes',      'cake-pops',              'pasticcere',  true),
  ('11111111-0000-0000-0000-000000000465','Dolci tipici regionali',      'dolci-regionali',        'pasticcere',  true),
  -- Videomaker
  ('11111111-0000-0000-0000-000000000470','Video evento completo',       'video-full',             'videomaker',  true),
  ('11111111-0000-0000-0000-000000000471','Highlight breve 3-5 minuti',  'video-highlight',        'videomaker',  true),
  ('11111111-0000-0000-0000-000000000472','Riprese drone aeree',         'video-drone',            'videomaker',  true),
  ('11111111-0000-0000-0000-000000000473','Slideshow proiezione serata', 'video-slideshow',        'videomaker',  true),
  ('11111111-0000-0000-0000-000000000474','Video raw integrale',         'video-raw',              'videomaker',  true),
  ('11111111-0000-0000-0000-000000000475','Pre-wedding / Save the date video','video-savethedate', 'videomaker',  true)
on conflict (slug) do nothing;
