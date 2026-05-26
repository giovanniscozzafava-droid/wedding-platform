-- ============================================================================
-- WP/Location ora possono emettere propri servizi (organizzazione, coordinamento,
-- consulenza). Aggiungiamo le categorie standard per subrole 'wedding_planner'
-- e rinominiamo le label generiche da "matrimonio" a "evento" — la piattaforma
-- gestisce 9 event_kind.
-- ============================================================================

-- 1) Categorie wedding_planner
insert into service_categories (id, name, slug, subrole, is_standard) values
  ('11111111-0000-0000-0000-000000000100','Consulenza orientativa',      'consulenza-wp',         'wedding_planner', true),
  ('11111111-0000-0000-0000-000000000101','Day coordinator',             'day-coordinator',       'wedding_planner', true),
  ('11111111-0000-0000-0000-000000000102','Pianificazione completa',     'pianificazione-full',   'wedding_planner', true),
  ('11111111-0000-0000-0000-000000000103','Coordinamento giorno-G',      'coordinamento-day',     'wedding_planner', true),
  ('11111111-0000-0000-0000-000000000104','Gestione fornitori',          'gestione-fornitori',    'wedding_planner', true),
  ('11111111-0000-0000-0000-000000000105','Sopralluoghi e ricerca venue','sopralluoghi-venue',    'wedding_planner', true)
on conflict (slug) do nothing;

-- 2) Categorie per i nuovi subroles
insert into service_categories (id, name, slug, subrole, is_standard) values
  ('11111111-0000-0000-0000-000000000110','Acconciatura sposa/protagonista','acconciatura-protagonista','parrucchiere', true),
  ('11111111-0000-0000-0000-000000000111','Acconciature invitati',           'acconciature-invitati',    'parrucchiere', true),
  ('11111111-0000-0000-0000-000000000120','Spettacolo pirotecnico aereo',    'pirotecnico-aereo',        'fuochista',    true),
  ('11111111-0000-0000-0000-000000000121','Effetti freddi indoor',           'effetti-freddi',           'fuochista',    true),
  ('11111111-0000-0000-0000-000000000122','Fontane luminose',                'fontane-luminose',         'fuochista',    true),
  ('11111111-0000-0000-0000-000000000130','Light design pista ballo',        'light-pista',              'luci',         true),
  ('11111111-0000-0000-0000-000000000131','Uplighters/architetturale',       'light-architettura',       'luci',         true),
  ('11111111-0000-0000-0000-000000000132','Gobo personalizzati',             'gobo-custom',              'luci',         true),
  ('11111111-0000-0000-0000-000000000133','Projection mapping',              'projection-mapping',       'luci',         true),
  ('11111111-0000-0000-0000-000000000140','Open bar cocktail',               'open-bar',                 'bartender',    true),
  ('11111111-0000-0000-0000-000000000141','Cocktail di benvenuto',           'cocktail-welcome',         'bartender',    true),
  ('11111111-0000-0000-0000-000000000142','Signature drink personalizzato',  'signature-drink',          'bartender',    true),
  ('11111111-0000-0000-0000-000000000150','Partecipazioni',                  'partecipazioni',           'stampe',       true),
  ('11111111-0000-0000-0000-000000000151','Menu cartacei',                   'menu-cartacei',            'stampe',       true),
  ('11111111-0000-0000-0000-000000000152','Tableau de mariage',              'tableau-mariage',          'stampe',       true),
  ('11111111-0000-0000-0000-000000000153','Cartoleria evento',               'cartoleria-evento',        'stampe',       true),
  ('11111111-0000-0000-0000-000000000160','Bomboniere classiche',            'bomboniere-classiche',     'bomboniere',   true),
  ('11111111-0000-0000-0000-000000000161','Bomboniere solidali',             'bomboniere-solidali',      'bomboniere',   true),
  ('11111111-0000-0000-0000-000000000162','Confetti decorati',               'confetti-decorati',        'bomboniere',   true)
on conflict (slug) do nothing;

-- 3) Rename label generiche da "matrimonio" a "evento" — il dominio è cambiato
update service_categories set name = 'Affitto sala evento' where slug = 'affitto-sala';
update service_categories set name = 'Menù evento'         where slug = 'menu-matrimonio';
update service_categories set name = 'Auto cerimonia'      where slug = 'auto-sposi';
