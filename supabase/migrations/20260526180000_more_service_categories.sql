-- ============================================================================
-- Categorie standard per i 15 nuovi subroles verticali aggiunti al catalogo:
-- photobooth, estetista, maitre, chef, food_truck, sommelier, sweet_table,
-- hostess, valet, navetta, noleggio, animali, calligrafo, magia, livepainter.
-- ============================================================================

insert into service_categories (id, name, slug, subrole, is_standard) values
  -- Photobooth
  ('11111111-0000-0000-0000-000000000200','Photobooth classico chiuso',     'photobooth-classico',      'photobooth',  true),
  ('11111111-0000-0000-0000-000000000201','Photobooth open air',            'photobooth-open',          'photobooth',  true),
  ('11111111-0000-0000-0000-000000000202','Mirror booth specchio',          'photobooth-mirror',        'photobooth',  true),
  ('11111111-0000-0000-0000-000000000203','Booth 360 slow motion',          'photobooth-360',           'photobooth',  true),
  ('11111111-0000-0000-0000-000000000204','GIF booth',                      'photobooth-gif',           'photobooth',  true),
  -- Estetista
  ('11111111-0000-0000-0000-000000000210','Manicure sposa',                 'manicure-sposa',           'estetista',   true),
  ('11111111-0000-0000-0000-000000000211','Pedicure sposa',                 'pedicure-sposa',           'estetista',   true),
  ('11111111-0000-0000-0000-000000000212','Trattamento viso pre-evento',    'viso-pre-evento',          'estetista',   true),
  ('11111111-0000-0000-0000-000000000213','Massaggio rilassante',           'massaggio-rilassante',     'estetista',   true),
  ('11111111-0000-0000-0000-000000000214','Spa day gruppo',                 'spa-day-gruppo',           'estetista',   true),
  -- Maitre
  ('11111111-0000-0000-0000-000000000220','Coordinamento di sala',          'coord-sala',               'maitre',      true),
  ('11111111-0000-0000-0000-000000000221','Direzione personale evento',     'direzione-personale',      'maitre',      true),
  -- Chef / show cooking
  ('11111111-0000-0000-0000-000000000230','Live cooking corner',            'live-cooking',             'chef',        true),
  ('11111111-0000-0000-0000-000000000231','Chef action station',            'chef-action',              'chef',        true),
  ('11111111-0000-0000-0000-000000000232','Menu degustazione seduti',       'menu-degustazione',        'chef',        true),
  ('11111111-0000-0000-0000-000000000233','Show cooking pesce crudo',       'show-pesce-crudo',         'chef',        true),
  -- Food truck
  ('11111111-0000-0000-0000-000000000240','Pizza forno a legna mobile',     'pizza-forno-legna',        'food_truck',  true),
  ('11111111-0000-0000-0000-000000000241','Burger americani',               'burger-americani',         'food_truck',  true),
  ('11111111-0000-0000-0000-000000000242','Street food italiano',           'street-italiano',          'food_truck',  true),
  ('11111111-0000-0000-0000-000000000243','Crepes dolci/salate',            'crepes',                   'food_truck',  true),
  ('11111111-0000-0000-0000-000000000244','Panini gourmet',                 'panini-gourmet',           'food_truck',  true),
  -- Sommelier
  ('11111111-0000-0000-0000-000000000250','Degustazione vini guidata',      'degustazione-vini',        'sommelier',   true),
  ('11111111-0000-0000-0000-000000000251','Corner vini durante evento',     'corner-vini',              'sommelier',   true),
  ('11111111-0000-0000-0000-000000000252','Champagne corner',               'champagne-corner',         'sommelier',   true),
  ('11111111-0000-0000-0000-000000000253','Masterclass distillati',         'masterclass-distillati',   'sommelier',   true),
  -- Sweet table
  ('11111111-0000-0000-0000-000000000260','Confettata classica',            'confettata-classica',      'sweet_table', true),
  ('11111111-0000-0000-0000-000000000261','Sweet table internazionale',     'sweet-table-intl',         'sweet_table', true),
  ('11111111-0000-0000-0000-000000000262','Macarons corner',                'macarons-corner',          'sweet_table', true),
  ('11111111-0000-0000-0000-000000000263','Cioccolato fontana',             'cioccolato-fontana',       'sweet_table', true),
  ('11111111-0000-0000-0000-000000000264','Gelato artigianale corner',      'gelato-corner',            'sweet_table', true),
  -- Hostess
  ('11111111-0000-0000-0000-000000000270','Welcome drink hostess',          'hostess-welcome',          'hostess',     true),
  ('11111111-0000-0000-0000-000000000271','Guida ai posti / libretti',      'hostess-guida',            'hostess',     true),
  ('11111111-0000-0000-0000-000000000272','Guardaroba ospiti',              'hostess-guardaroba',       'hostess',     true),
  -- Valet
  ('11111111-0000-0000-0000-000000000280','Valet parking serata',           'valet-serata',             'valet',       true),
  -- Navetta
  ('11111111-0000-0000-0000-000000000290','Navetta minivan 8 posti',        'navetta-minivan',          'navetta',     true),
  ('11111111-0000-0000-0000-000000000291','Navetta pulmino 15 posti',       'navetta-pulmino',          'navetta',     true),
  ('11111111-0000-0000-0000-000000000292','Bus 30 posti',                   'navetta-bus30',            'navetta',     true),
  ('11111111-0000-0000-0000-000000000293','Gran turismo',                   'navetta-granturismo',      'navetta',     true),
  -- Noleggio
  ('11111111-0000-0000-0000-000000000300','Noleggio tavoli',                'nol-tavoli',               'noleggio',    true),
  ('11111111-0000-0000-0000-000000000301','Noleggio sedie chiavari',        'nol-sedie-chiavari',       'noleggio',    true),
  ('11111111-0000-0000-0000-000000000302','Noleggio gazebo / tendostruttura','nol-gazebo',              'noleggio',    true),
  ('11111111-0000-0000-0000-000000000303','Noleggio pista da ballo',        'nol-pista-ballo',          'noleggio',    true),
  ('11111111-0000-0000-0000-000000000304','Noleggio stoviglie/cristalleria','nol-stoviglie',            'noleggio',    true),
  ('11111111-0000-0000-0000-000000000305','Riscaldatori esterni / pedane',  'nol-riscaldatori',         'noleggio',    true),
  -- Animali cerimonia
  ('11111111-0000-0000-0000-000000000310','Falconeria',                     'falconeria',               'animali',     true),
  ('11111111-0000-0000-0000-000000000311','Colombe bianche',                'colombe-bianche',          'animali',     true),
  ('11111111-0000-0000-0000-000000000312','Cani porta-anelli addestrati',   'cani-anelli',              'animali',     true),
  ('11111111-0000-0000-0000-000000000313','Cavalli da cerimonia',           'cavalli-cerimonia',        'animali',     true),
  -- Calligrafo
  ('11111111-0000-0000-0000-000000000320','Calligrafia partecipazioni',     'callig-partecipazioni',    'calligrafo',  true),
  ('11111111-0000-0000-0000-000000000321','Calligrafia segnaposto',         'callig-segnaposto',        'calligrafo',  true),
  ('11111111-0000-0000-0000-000000000322','Tableau scritto a mano',         'callig-tableau',           'calligrafo',  true),
  -- Magia
  ('11111111-0000-0000-0000-000000000330','Close-up magia aperitivo',       'magia-closeup',            'magia',       true),
  ('11111111-0000-0000-0000-000000000331','Micromagia ai tavoli',           'magia-tavoli',             'magia',       true),
  ('11111111-0000-0000-0000-000000000332','Mentalismo show',                'magia-mentalismo',         'magia',       true),
  ('11111111-0000-0000-0000-000000000333','Magia per bambini',              'magia-bambini',            'magia',       true),
  -- Live painter
  ('11111111-0000-0000-0000-000000000340','Ritratto a olio sposi',          'ritratto-olio',            'livepainter', true),
  ('11111111-0000-0000-0000-000000000341','Ritratto acquerello ospiti',     'ritratto-acquerello',      'livepainter', true),
  ('11111111-0000-0000-0000-000000000342','Caricature veloci ospiti',       'caricature',               'livepainter', true),
  ('11111111-0000-0000-0000-000000000343','Live painting evento',           'live-painting',            'livepainter', true)
on conflict (slug) do nothing;
