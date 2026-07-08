-- Sostituisce il menu demo Baronella con un catalogo GOURMET (fine dining calabrese),
-- distinto da quello della Tenuta. Rimpiazza le voci "trattoria" del 20260709130000.
-- Food cost TUTTO-TUTTO: ogni ricetta include gli aromi minori (sale, sale Maldon, pepe,
-- olio nuovo, burro, aglio, erbe…) con grammatura e costo. Auto-contenuto e idempotente.
-- Strategia dispensa pulita: disattivo tutti gli ingredienti della location, poi riattivo
-- SOLO quelli del catalogo gourmet → il magazzino attivo mostra solo materie prime gourmet.
do $$
declare
  v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_menu uuid;
  v_menu_name text := 'La Baronella — Menu à la carte';
  v_keep text[] := array[
    'Ricciola','Scampo di Corigliano','Riccio di mare','Dentice','Vongole','Bottarga di tonno','Ostrica','Gambero rosso di Mazara',
    'Carne podolica','Guancia di podolica','Piccione','Nduja di Spilinga',
    'Burrata','Caciocavallo silano','Pecorino di grotta','Ricotta di pecora',
    'Uova','Riso Carnaroli','Farina 00','Semola di grano duro','Spaghetto artigianale','Baccala''',
    'Cipolla di Tropea','Patata viola della Sila','Cime di rapa','Sedano rapa','Cannellini di Cortale','Erbe spontanee','Agrumi di Calabria','Olive',
    'Ciliegie','Nocciole di Calabria','Bergamotto','Cioccolato di Modica','Pasticceria mignon',
    'Zafferano di Calabria','Miele di castagno','Liquirizia di Calabria','Finocchietto selvatico',
    'Cirò Rosso DOC','Cirò Bianco DOC','Magliocco','Metodo Classico calabrese','Caffè',
    'Zucchero','Olio EVO nuovo','Sale','Sale Maldon','Pepe nero','Burro','Aglio','Prezzemolo','Peperoncino','Rosmarino'
  ];
begin
  -- reset del menu demo precedente (menu + item + eventuali attribuzioni + ricette trattoria)
  delete from public.fb_event_menus where menu_id in (select id from public.fb_menus where location_id=v_loc and name=v_menu_name);
  delete from public.fb_menu_items where menu_id in (select id from public.fb_menus where location_id=v_loc and name=v_menu_name);
  delete from public.fb_menus where location_id=v_loc and name=v_menu_name;
  delete from public.fb_recipes where location_id=v_loc and name = any(array[
    'Tagliere di salumi e formaggi calabresi','Parmigiana di melanzane','Frittelle di baccala'' e verdure','Insalata di mare tiepida',
    'Fileja alla ''nduja e pecorino','Risotto ai funghi porcini della Sila','Cannelloni ricotta e spinaci al forno','Paccheri allo scoglio',
    'Arrosto misto di maiale e salsiccia','Filetto di spigola all''acqua pazza','Bracioline alla calabrese','Capretto al forno con patate',
    'Patate al forno','Verdure grigliate di stagione','Insalata mista di stagione','Peperoni ripieni',
    'Torta dell''evento','Frutta di stagione e piccola pasticceria','Brindisi con spumante','Caffe'' e digestivi'
  ]);

  -- ── Ingredienti gourmet + aromi ───────────────────────────────────────────
  insert into public.fb_ingredients(location_id, name, stock_unit, category)
  select v_loc, d.n, d.u, d.c from (values
    ('Ricciola','G','Pesce'),('Scampo di Corigliano','G','Pesce'),('Riccio di mare','G','Pesce'),('Dentice','G','Pesce'),
    ('Vongole','G','Pesce'),('Bottarga di tonno','G','Pesce'),('Ostrica','PZ','Pesce'),('Gambero rosso di Mazara','G','Pesce'),('Baccala''','G','Pesce'),
    ('Carne podolica','G','Carne'),('Guancia di podolica','G','Carne'),('Piccione','PZ','Carne'),('Nduja di Spilinga','G','Carne'),
    ('Burrata','G','Salumi e formaggi'),('Caciocavallo silano','G','Salumi e formaggi'),('Pecorino di grotta','G','Salumi e formaggi'),('Ricotta di pecora','G','Salumi e formaggi'),
    ('Uova','PZ','Dispensa'),('Riso Carnaroli','G','Dispensa'),('Farina 00','G','Dispensa'),('Semola di grano duro','G','Dispensa'),('Spaghetto artigianale','G','Dispensa'),('Nocciole di Calabria','G','Dispensa'),('Miele di castagno','G','Dispensa'),('Zucchero','G','Dispensa'),
    ('Cipolla di Tropea','G','Verdura'),('Patata viola della Sila','G','Verdura'),('Cime di rapa','G','Verdura'),('Sedano rapa','G','Verdura'),('Cannellini di Cortale','G','Verdura'),('Erbe spontanee','G','Verdura'),('Agrumi di Calabria','G','Verdura'),('Olive','G','Verdura'),
    ('Ciliegie','G','Frutta e dolci'),('Bergamotto','G','Frutta e dolci'),('Cioccolato di Modica','G','Frutta e dolci'),('Pasticceria mignon','G','Frutta e dolci'),
    ('Zafferano di Calabria','G','Aromi e condimenti'),('Liquirizia di Calabria','G','Aromi e condimenti'),('Finocchietto selvatico','G','Aromi e condimenti'),
    ('Olio EVO nuovo','ML','Aromi e condimenti'),('Sale','G','Aromi e condimenti'),('Sale Maldon','G','Aromi e condimenti'),('Pepe nero','G','Aromi e condimenti'),('Burro','G','Aromi e condimenti'),('Aglio','G','Aromi e condimenti'),('Prezzemolo','G','Aromi e condimenti'),('Peperoncino','G','Aromi e condimenti'),('Rosmarino','G','Aromi e condimenti'),
    ('Cirò Rosso DOC','ML','Bevande'),('Cirò Bianco DOC','ML','Bevande'),('Magliocco','ML','Bevande'),('Metodo Classico calabrese','PZ','Bevande'),('Caffè','G','Bevande')
  ) d(n,u,c) where not exists (select 1 from public.fb_ingredients i where i.location_id=v_loc and i.name=d.n);

  -- riattiva SOLO il catalogo gourmet, disattiva il resto (dispensa pulita)
  update public.fb_ingredients set is_active = (name = any(v_keep)), updated_at = now() where location_id = v_loc;

  -- ── Costo corrente per unità base (€/g, €/ml, €/pz) ───────────────────────
  insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit, valid_from, source)
  select i.id, c.cost, now(), 'MANUAL' from public.fb_ingredients i join (values
    ('Ricciola',0.028),('Scampo di Corigliano',0.05),('Riccio di mare',0.06),('Dentice',0.026),('Vongole',0.012),('Bottarga di tonno',0.12),('Ostrica',1.2),('Gambero rosso di Mazara',0.045),('Baccala''',0.014),
    ('Carne podolica',0.03),('Guancia di podolica',0.02),('Piccione',6.5),('Nduja di Spilinga',0.018),
    ('Burrata',0.014),('Caciocavallo silano',0.013),('Pecorino di grotta',0.02),('Ricotta di pecora',0.008),
    ('Uova',0.25),('Riso Carnaroli',0.003),('Farina 00',0.0012),('Semola di grano duro',0.0015),('Spaghetto artigianale',0.006),('Nocciole di Calabria',0.012),('Miele di castagno',0.012),('Zucchero',0.0012),
    ('Cipolla di Tropea',0.003),('Patata viola della Sila',0.004),('Cime di rapa',0.005),('Sedano rapa',0.004),('Cannellini di Cortale',0.006),('Erbe spontanee',0.02),('Agrumi di Calabria',0.004),('Olive',0.006),
    ('Ciliegie',0.008),('Bergamotto',0.01),('Cioccolato di Modica',0.03),('Pasticceria mignon',0.012),
    ('Zafferano di Calabria',0.9),('Liquirizia di Calabria',0.05),('Finocchietto selvatico',0.02),
    ('Olio EVO nuovo',0.01),('Sale',0.0005),('Sale Maldon',0.02),('Pepe nero',0.03),('Burro',0.008),('Aglio',0.004),('Prezzemolo',0.008),('Peperoncino',0.015),('Rosmarino',0.012),
    ('Cirò Rosso DOC',0.012),('Cirò Bianco DOC',0.012),('Magliocco',0.012),('Metodo Classico calabrese',12.0),('Caffè',0.02)
  ) c(n,cost) on c.n=i.name where i.location_id=v_loc
    and not exists (select 1 from public.fb_ingredient_cost_versions cv where cv.ingredient_id=i.id and cv.valid_until is null);

  -- ── Ricette gourmet ───────────────────────────────────────────────────────
  insert into public.fb_recipes(location_id, name, yield_qty, yield_unit)
  select v_loc, n, 1, 'porzione' from (values
    ('Carpaccio di ricciola, agrumi e finocchietto selvatico'),('Scampo crudo di Corigliano, burrata e polvere di ''nduja'),('Uovo poche, crema di patata viola e pecorino di grotta'),('Battuta di podolica al coltello, ostrica e nocciola'),
    ('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno'),('Risotto Carnaroli, zafferano di Calabria e gambero rosso'),('Spaghetto al riccio di mare e bottarga'),('Tortello di baccala mantecato, cime di rapa e bottarga'),
    ('Filetto di ricciola scottato, cannellini di Cortale e vongole'),('Piccione della Sila, ristretto al Ciro e ciliegie'),('Guancia di podolica brasata al Magliocco, sedano rapa'),('Dentice in crosta di sale agli agrumi, olio nuovo'),
    ('Cipolla di Tropea in agrodolce e polvere di olive'),('Patata viola della Sila, fondente al rosmarino'),('Cime di rapa saltate, aglio e peperoncino'),('Insalatina di erbe spontanee e agrumi'),
    ('Bergamotto in consistenze e cioccolato di Modica'),('Cannolo scomposto, ricotta di pecora e liquirizia'),
    ('Brindisi con Metodo Classico calabrese'),('Caffe, cioccolato e piccola pasticceria')
  ) d(n) where not exists (select 1 from public.fb_recipes r where r.location_id=v_loc and r.name=d.n);

  -- ── Righe ricetta (con TUTTI gli aromi) ───────────────────────────────────
  insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit)
  select r.id, i.id, x.qty, i.stock_unit
  from (values
    -- ANTIPASTI
    ('Carpaccio di ricciola, agrumi e finocchietto selvatico','Ricciola',70),('Carpaccio di ricciola, agrumi e finocchietto selvatico','Agrumi di Calabria',20),('Carpaccio di ricciola, agrumi e finocchietto selvatico','Finocchietto selvatico',2),('Carpaccio di ricciola, agrumi e finocchietto selvatico','Olio EVO nuovo',8),('Carpaccio di ricciola, agrumi e finocchietto selvatico','Sale Maldon',1),('Carpaccio di ricciola, agrumi e finocchietto selvatico','Pepe nero',0.2),
    ('Scampo crudo di Corigliano, burrata e polvere di ''nduja','Scampo di Corigliano',50),('Scampo crudo di Corigliano, burrata e polvere di ''nduja','Burrata',40),('Scampo crudo di Corigliano, burrata e polvere di ''nduja','Nduja di Spilinga',6),('Scampo crudo di Corigliano, burrata e polvere di ''nduja','Olio EVO nuovo',6),('Scampo crudo di Corigliano, burrata e polvere di ''nduja','Sale Maldon',0.8),
    ('Uovo poche, crema di patata viola e pecorino di grotta','Uova',1),('Uovo poche, crema di patata viola e pecorino di grotta','Patata viola della Sila',90),('Uovo poche, crema di patata viola e pecorino di grotta','Pecorino di grotta',15),('Uovo poche, crema di patata viola e pecorino di grotta','Burro',10),('Uovo poche, crema di patata viola e pecorino di grotta','Olio EVO nuovo',5),('Uovo poche, crema di patata viola e pecorino di grotta','Sale',1.2),('Uovo poche, crema di patata viola e pecorino di grotta','Pepe nero',0.2),
    ('Battuta di podolica al coltello, ostrica e nocciola','Carne podolica',60),('Battuta di podolica al coltello, ostrica e nocciola','Ostrica',1),('Battuta di podolica al coltello, ostrica e nocciola','Nocciole di Calabria',8),('Battuta di podolica al coltello, ostrica e nocciola','Olio EVO nuovo',5),('Battuta di podolica al coltello, ostrica e nocciola','Sale Maldon',0.8),('Battuta di podolica al coltello, ostrica e nocciola','Pepe nero',0.2),
    -- PRIMI
    ('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Semola di grano duro',70),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Uova',0.3),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Nduja di Spilinga',20),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Caciocavallo silano',40),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Miele di castagno',6),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Burro',10),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Sale',1.2),('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno','Pepe nero',0.2),
    ('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Riso Carnaroli',90),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Zafferano di Calabria',0.1),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Gambero rosso di Mazara',40),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Cipolla di Tropea',15),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Burro',12),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Pecorino di grotta',8),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Cirò Bianco DOC',15),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Olio EVO nuovo',6),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Sale',1.2),('Risotto Carnaroli, zafferano di Calabria e gambero rosso','Prezzemolo',1),
    ('Spaghetto al riccio di mare e bottarga','Spaghetto artigianale',100),('Spaghetto al riccio di mare e bottarga','Riccio di mare',40),('Spaghetto al riccio di mare e bottarga','Bottarga di tonno',6),('Spaghetto al riccio di mare e bottarga','Aglio',2),('Spaghetto al riccio di mare e bottarga','Prezzemolo',2),('Spaghetto al riccio di mare e bottarga','Peperoncino',0.3),('Spaghetto al riccio di mare e bottarga','Olio EVO nuovo',12),('Spaghetto al riccio di mare e bottarga','Sale',1.2),
    ('Tortello di baccala mantecato, cime di rapa e bottarga','Semola di grano duro',70),('Tortello di baccala mantecato, cime di rapa e bottarga','Uova',0.3),('Tortello di baccala mantecato, cime di rapa e bottarga','Baccala''',60),('Tortello di baccala mantecato, cime di rapa e bottarga','Cime di rapa',40),('Tortello di baccala mantecato, cime di rapa e bottarga','Bottarga di tonno',5),('Tortello di baccala mantecato, cime di rapa e bottarga','Aglio',1.5),('Tortello di baccala mantecato, cime di rapa e bottarga','Olio EVO nuovo',10),('Tortello di baccala mantecato, cime di rapa e bottarga','Sale',1.2),('Tortello di baccala mantecato, cime di rapa e bottarga','Pepe nero',0.2),
    -- SECONDI
    ('Filetto di ricciola scottato, cannellini di Cortale e vongole','Ricciola',160),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Cannellini di Cortale',60),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Vongole',50),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Aglio',2),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Prezzemolo',2),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Olio EVO nuovo',12),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Sale',1.5),('Filetto di ricciola scottato, cannellini di Cortale e vongole','Pepe nero',0.3),
    ('Piccione della Sila, ristretto al Ciro e ciliegie','Piccione',0.5),('Piccione della Sila, ristretto al Ciro e ciliegie','Cirò Rosso DOC',40),('Piccione della Sila, ristretto al Ciro e ciliegie','Ciliegie',30),('Piccione della Sila, ristretto al Ciro e ciliegie','Burro',12),('Piccione della Sila, ristretto al Ciro e ciliegie','Rosmarino',1),('Piccione della Sila, ristretto al Ciro e ciliegie','Sale',1.5),('Piccione della Sila, ristretto al Ciro e ciliegie','Pepe nero',0.3),
    ('Guancia di podolica brasata al Magliocco, sedano rapa','Guancia di podolica',180),('Guancia di podolica brasata al Magliocco, sedano rapa','Magliocco',60),('Guancia di podolica brasata al Magliocco, sedano rapa','Sedano rapa',90),('Guancia di podolica brasata al Magliocco, sedano rapa','Cipolla di Tropea',20),('Guancia di podolica brasata al Magliocco, sedano rapa','Burro',12),('Guancia di podolica brasata al Magliocco, sedano rapa','Rosmarino',1),('Guancia di podolica brasata al Magliocco, sedano rapa','Sale',1.5),('Guancia di podolica brasata al Magliocco, sedano rapa','Pepe nero',0.3),
    ('Dentice in crosta di sale agli agrumi, olio nuovo','Dentice',180),('Dentice in crosta di sale agli agrumi, olio nuovo','Sale',200),('Dentice in crosta di sale agli agrumi, olio nuovo','Agrumi di Calabria',25),('Dentice in crosta di sale agli agrumi, olio nuovo','Olio EVO nuovo',12),('Dentice in crosta di sale agli agrumi, olio nuovo','Pepe nero',0.3),
    -- CONTORNI
    ('Cipolla di Tropea in agrodolce e polvere di olive','Cipolla di Tropea',120),('Cipolla di Tropea in agrodolce e polvere di olive','Zucchero',10),('Cipolla di Tropea in agrodolce e polvere di olive','Olive',10),('Cipolla di Tropea in agrodolce e polvere di olive','Olio EVO nuovo',6),('Cipolla di Tropea in agrodolce e polvere di olive','Sale',1),
    ('Patata viola della Sila, fondente al rosmarino','Patata viola della Sila',140),('Patata viola della Sila, fondente al rosmarino','Burro',10),('Patata viola della Sila, fondente al rosmarino','Rosmarino',0.8),('Patata viola della Sila, fondente al rosmarino','Olio EVO nuovo',5),('Patata viola della Sila, fondente al rosmarino','Sale',1.2),
    ('Cime di rapa saltate, aglio e peperoncino','Cime di rapa',150),('Cime di rapa saltate, aglio e peperoncino','Aglio',2),('Cime di rapa saltate, aglio e peperoncino','Peperoncino',0.4),('Cime di rapa saltate, aglio e peperoncino','Olio EVO nuovo',8),('Cime di rapa saltate, aglio e peperoncino','Sale',1.2),
    ('Insalatina di erbe spontanee e agrumi','Erbe spontanee',80),('Insalatina di erbe spontanee e agrumi','Agrumi di Calabria',25),('Insalatina di erbe spontanee e agrumi','Olio EVO nuovo',6),('Insalatina di erbe spontanee e agrumi','Sale Maldon',0.8),
    -- DOLCI
    ('Bergamotto in consistenze e cioccolato di Modica','Bergamotto',60),('Bergamotto in consistenze e cioccolato di Modica','Cioccolato di Modica',25),('Bergamotto in consistenze e cioccolato di Modica','Zucchero',25),('Bergamotto in consistenze e cioccolato di Modica','Uova',0.5),('Bergamotto in consistenze e cioccolato di Modica','Burro',15),
    ('Cannolo scomposto, ricotta di pecora e liquirizia','Ricotta di pecora',70),('Cannolo scomposto, ricotta di pecora e liquirizia','Zucchero',25),('Cannolo scomposto, ricotta di pecora e liquirizia','Farina 00',30),('Cannolo scomposto, ricotta di pecora e liquirizia','Liquirizia di Calabria',2),('Cannolo scomposto, ricotta di pecora e liquirizia','Cioccolato di Modica',10),
    -- BEVANDE
    ('Brindisi con Metodo Classico calabrese','Metodo Classico calabrese',0.18),
    ('Caffe, cioccolato e piccola pasticceria','Caffè',7),('Caffe, cioccolato e piccola pasticceria','Pasticceria mignon',35),('Caffe, cioccolato e piccola pasticceria','Cioccolato di Modica',8),('Caffe, cioccolato e piccola pasticceria','Zucchero',6)
  ) x(recipe,ingr,qty)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc
  join public.fb_ingredients i on i.name=x.ingr and i.location_id=v_loc
  where not exists (select 1 from public.fb_recipe_items ri where ri.recipe_id=r.id and ri.ingredient_id=i.id);

  -- ── Menu à-la-carte gourmet ───────────────────────────────────────────────
  insert into public.fb_menus(location_id, name, basis) values (v_loc, v_menu_name, 'PER_COPERTO') returning id into v_menu;
  insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover, course, sort_order)
  select v_menu, r.id, x.qpc, x.course, x.so
  from (values
    ('Carpaccio di ricciola, agrumi e finocchietto selvatico',1.0,'ANTIPASTO',1),('Scampo crudo di Corigliano, burrata e polvere di ''nduja',1.0,'ANTIPASTO',2),('Uovo poche, crema di patata viola e pecorino di grotta',1.0,'ANTIPASTO',3),('Battuta di podolica al coltello, ostrica e nocciola',1.0,'ANTIPASTO',4),
    ('Raviolo di ''nduja, fonduta di caciocavallo e miele di castagno',0.5,'PRIMO',1),('Risotto Carnaroli, zafferano di Calabria e gambero rosso',0.5,'PRIMO',2),('Spaghetto al riccio di mare e bottarga',0.5,'PRIMO',3),('Tortello di baccala mantecato, cime di rapa e bottarga',0.5,'PRIMO',4),
    ('Filetto di ricciola scottato, cannellini di Cortale e vongole',0.5,'SECONDO',1),('Piccione della Sila, ristretto al Ciro e ciliegie',0.5,'SECONDO',2),('Guancia di podolica brasata al Magliocco, sedano rapa',0.5,'SECONDO',3),('Dentice in crosta di sale agli agrumi, olio nuovo',0.5,'SECONDO',4),
    ('Cipolla di Tropea in agrodolce e polvere di olive',0.5,'CONTORNO',1),('Patata viola della Sila, fondente al rosmarino',0.5,'CONTORNO',2),('Cime di rapa saltate, aglio e peperoncino',0.5,'CONTORNO',3),('Insalatina di erbe spontanee e agrumi',0.5,'CONTORNO',4),
    ('Bergamotto in consistenze e cioccolato di Modica',0.8,'DOLCE',1),('Cannolo scomposto, ricotta di pecora e liquirizia',0.5,'DOLCE',2),
    ('Brindisi con Metodo Classico calabrese',1.0,'BEVANDE',1),('Caffe, cioccolato e piccola pasticceria',1.0,'BEVANDE',2)
  ) x(recipe,qpc,course,so)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc;

  raise notice 'BARONELLA_GOURMET=% | piatti=% | ingredienti attivi=%',
    v_menu,
    (select count(*) from public.fb_menu_items where menu_id=v_menu),
    (select count(*) from public.fb_ingredients where location_id=v_loc and is_active);
end $$;
