-- Demo piatti singoli à-la-carte per LOCATION "La Baronella" (c117d389-…), attribuibili ai
-- singoli eventi come per la Tenuta. Catalogo: 4 antipasti, 4 primi, 4 secondi, 4 contorni,
-- 2 dolci, brindisi + caffè. course ammessi: APERITIVO/ANTIPASTO/PRIMO/SECONDO/CONTORNO/DOLCE/FRUTTA/BEVANDE.
--
-- FOOD COST "TUTTO-TUTTO": ogni ricetta include anche i condimenti/aromi minori (sale, pepe nero,
-- origano, aglio, prezzemolo, olio EVO, noce di burro, ecc.) con grammature e costo — ogni grammo incide.
-- Auto-contenuto: inserisce TUTTI gli ingredienti referenziati per questa location (altrimenti la
-- join nome↔location scarterebbe le righe ricetta). Idempotente: rimuove solo QUESTO menu prima di ricrearlo.
do $$
declare v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27'; v_menu uuid;
        v_menu_name text := 'La Baronella — Menu à la carte';
begin
  -- reset mirato del solo menu demo (non tocca altri menu/ricette della location)
  delete from public.fb_menu_items where menu_id in (select id from public.fb_menus where location_id=v_loc and name=v_menu_name);
  delete from public.fb_menus where location_id=v_loc and name=v_menu_name;

  -- ── Ingredienti (materie prime + aromi/condimenti) ────────────────────────
  insert into public.fb_ingredients(location_id, name, stock_unit, category)
  select v_loc, d.n, d.u, d.c from (values
    -- salumi e formaggi
    ('Salumi misti calabresi','G','Salumi e formaggi'),('Caciocavallo silano','G','Salumi e formaggi'),
    ('Pecorino crotonese','G','Salumi e formaggi'),('Ricotta','G','Salumi e formaggi'),
    -- dispensa / pasta / uova
    ('Burro','G','Dispensa'),('Uova','PZ','Dispensa'),('Pane casereccio','G','Dispensa'),('Farina 00','G','Dispensa'),
    ('Riso Carnaroli','G','Dispensa'),('Fileja','G','Dispensa'),('Paccheri','G','Dispensa'),
    ('Zucchero','G','Dispensa'),('Cioccolato fondente','G','Dispensa'),
    -- carne
    ('Vitello','G','Carne'),('Maiale','G','Carne'),('Salsiccia calabrese','G','Carne'),
    ('Capretto','G','Carne'),('Nduja di Spilinga','G','Carne'),
    -- pesce
    ('Baccala''','G','Pesce'),('Calamari','G','Pesce'),('Cozze','G','Pesce'),('Vongole','G','Pesce'),
    ('Gamberi','G','Pesce'),('Spigola','G','Pesce'),
    -- verdura
    ('Melanzane','G','Verdura'),('Pomodoro datterino','G','Verdura'),('Spinaci','G','Verdura'),('Patate','G','Verdura'),
    ('Verdure miste di stagione','G','Verdura'),('Insalata mista di stagione','G','Verdura'),('Peperoni','G','Verdura'),
    ('Funghi porcini della Sila','G','Verdura'),('Cipolla dorata','G','Verdura'),
    -- frutta e dolci
    ('Frutta di stagione','G','Frutta e dolci'),('Pasticceria mignon','G','Frutta e dolci'),
    -- aromi e condimenti (il "tutto-tutto")
    ('Olio EVO','ML','Aromi e condimenti'),('Sale','G','Aromi e condimenti'),('Pepe nero','G','Aromi e condimenti'),
    ('Origano','G','Aromi e condimenti'),('Aglio','G','Aromi e condimenti'),('Prezzemolo','G','Aromi e condimenti'),
    ('Basilico','G','Aromi e condimenti'),('Rosmarino','G','Aromi e condimenti'),('Peperoncino','G','Aromi e condimenti'),
    ('Noce moscata','G','Aromi e condimenti'),('Limone','G','Aromi e condimenti'),('Vino bianco da cucina','ML','Aromi e condimenti')
  ) d(n,u,c) where not exists (select 1 from public.fb_ingredients i where i.location_id=v_loc and i.name=d.n);

  -- ── Costo corrente per unità base (€/g, €/ml, €/pz) ───────────────────────
  insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit, valid_from, source)
  select i.id, c.cost, now(), 'MANUAL' from public.fb_ingredients i join (values
    ('Salumi misti calabresi',0.022),('Caciocavallo silano',0.013),('Pecorino crotonese',0.016),('Ricotta',0.006),
    ('Burro',0.008),('Uova',0.25),('Pane casereccio',0.003),('Farina 00',0.0012),
    ('Riso Carnaroli',0.003),('Fileja',0.004),('Paccheri',0.0035),('Zucchero',0.0012),('Cioccolato fondente',0.012),
    ('Vitello',0.014),('Maiale',0.009),('Salsiccia calabrese',0.011),('Capretto',0.015),('Nduja di Spilinga',0.018),
    ('Baccala''',0.014),('Calamari',0.014),('Cozze',0.005),('Vongole',0.012),('Gamberi',0.02),('Spigola',0.016),
    ('Melanzane',0.0025),('Pomodoro datterino',0.0025),('Spinaci',0.004),('Patate',0.001),
    ('Verdure miste di stagione',0.0025),('Insalata mista di stagione',0.004),('Peperoni',0.003),
    ('Funghi porcini della Sila',0.02),('Cipolla dorata',0.002),
    ('Frutta di stagione',0.003),('Pasticceria mignon',0.012),
    ('Olio EVO',0.008),('Sale',0.0005),('Pepe nero',0.03),('Origano',0.02),('Aglio',0.004),('Prezzemolo',0.008),
    ('Basilico',0.01),('Rosmarino',0.012),('Peperoncino',0.015),('Noce moscata',0.05),('Limone',0.003),('Vino bianco da cucina',0.003)
  ) c(n,cost) on c.n=i.name where i.location_id=v_loc
    and not exists (select 1 from public.fb_ingredient_cost_versions cv where cv.ingredient_id=i.id);

  -- ── Ricette (una per piatto singolo) ──────────────────────────────────────
  insert into public.fb_recipes(location_id, name, yield_qty, yield_unit)
  select v_loc, n, 1, 'porzione' from (values
    ('Tagliere di salumi e formaggi calabresi'),('Parmigiana di melanzane'),('Frittelle di baccala'' e verdure'),('Insalata di mare tiepida'),
    ('Fileja alla ''nduja e pecorino'),('Risotto ai funghi porcini della Sila'),('Cannelloni ricotta e spinaci al forno'),('Paccheri allo scoglio'),
    ('Arrosto misto di maiale e salsiccia'),('Filetto di spigola all''acqua pazza'),('Bracioline alla calabrese'),('Capretto al forno con patate'),
    ('Patate al forno'),('Verdure grigliate di stagione'),('Insalata mista di stagione'),('Peperoni ripieni'),
    ('Torta dell''evento'),('Frutta di stagione e piccola pasticceria'),
    ('Brindisi con spumante'),('Caffe'' e digestivi')
  ) d(n) where not exists (select 1 from public.fb_recipes r where r.location_id=v_loc and r.name=d.n);

  -- ── Righe ricetta (con TUTTI gli aromi/condimenti) ────────────────────────
  insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit)
  select r.id, i.id, x.qty, i.stock_unit
  from (values
    -- ANTIPASTI
    ('Tagliere di salumi e formaggi calabresi','Salumi misti calabresi',60),('Tagliere di salumi e formaggi calabresi','Caciocavallo silano',45),('Tagliere di salumi e formaggi calabresi','Pecorino crotonese',25),('Tagliere di salumi e formaggi calabresi','Pane casereccio',40),('Tagliere di salumi e formaggi calabresi','Origano',0.3),('Tagliere di salumi e formaggi calabresi','Olio EVO',5),
    ('Parmigiana di melanzane','Melanzane',180),('Parmigiana di melanzane','Pomodoro datterino',90),('Parmigiana di melanzane','Caciocavallo silano',40),('Parmigiana di melanzane','Pecorino crotonese',15),('Parmigiana di melanzane','Basilico',2),('Parmigiana di melanzane','Aglio',2),('Parmigiana di melanzane','Olio EVO',20),('Parmigiana di melanzane','Sale',2),('Parmigiana di melanzane','Pepe nero',0.3),
    ('Frittelle di baccala'' e verdure','Baccala''',70),('Frittelle di baccala'' e verdure','Farina 00',45),('Frittelle di baccala'' e verdure','Verdure miste di stagione',50),('Frittelle di baccala'' e verdure','Prezzemolo',2),('Frittelle di baccala'' e verdure','Olio EVO',25),('Frittelle di baccala'' e verdure','Sale',1.5),('Frittelle di baccala'' e verdure','Pepe nero',0.3),
    ('Insalata di mare tiepida','Calamari',60),('Insalata di mare tiepida','Cozze',60),('Insalata di mare tiepida','Gamberi',50),('Insalata di mare tiepida','Patate',60),('Insalata di mare tiepida','Prezzemolo',2),('Insalata di mare tiepida','Aglio',1.5),('Insalata di mare tiepida','Limone',10),('Insalata di mare tiepida','Olio EVO',12),('Insalata di mare tiepida','Sale',1.5),('Insalata di mare tiepida','Pepe nero',0.3),
    -- PRIMI
    ('Fileja alla ''nduja e pecorino','Fileja',110),('Fileja alla ''nduja e pecorino','Nduja di Spilinga',22),('Fileja alla ''nduja e pecorino','Pomodoro datterino',70),('Fileja alla ''nduja e pecorino','Pecorino crotonese',12),('Fileja alla ''nduja e pecorino','Aglio',1.5),('Fileja alla ''nduja e pecorino','Basilico',1),('Fileja alla ''nduja e pecorino','Olio EVO',8),('Fileja alla ''nduja e pecorino','Sale',1.5),('Fileja alla ''nduja e pecorino','Pepe nero',0.2),
    ('Risotto ai funghi porcini della Sila','Riso Carnaroli',90),('Risotto ai funghi porcini della Sila','Funghi porcini della Sila',60),('Risotto ai funghi porcini della Sila','Pecorino crotonese',10),('Risotto ai funghi porcini della Sila','Burro',12),('Risotto ai funghi porcini della Sila','Cipolla dorata',15),('Risotto ai funghi porcini della Sila','Vino bianco da cucina',15),('Risotto ai funghi porcini della Sila','Prezzemolo',1.5),('Risotto ai funghi porcini della Sila','Olio EVO',6),('Risotto ai funghi porcini della Sila','Sale',1.5),('Risotto ai funghi porcini della Sila','Pepe nero',0.2),
    ('Cannelloni ricotta e spinaci al forno','Farina 00',70),('Cannelloni ricotta e spinaci al forno','Ricotta',70),('Cannelloni ricotta e spinaci al forno','Spinaci',60),('Cannelloni ricotta e spinaci al forno','Pomodoro datterino',60),('Cannelloni ricotta e spinaci al forno','Pecorino crotonese',10),('Cannelloni ricotta e spinaci al forno','Uova',0.3),('Cannelloni ricotta e spinaci al forno','Noce moscata',0.2),('Cannelloni ricotta e spinaci al forno','Sale',1.5),('Cannelloni ricotta e spinaci al forno','Pepe nero',0.2),
    ('Paccheri allo scoglio','Paccheri',110),('Paccheri allo scoglio','Cozze',50),('Paccheri allo scoglio','Vongole',50),('Paccheri allo scoglio','Gamberi',40),('Paccheri allo scoglio','Pomodoro datterino',50),('Paccheri allo scoglio','Aglio',2),('Paccheri allo scoglio','Prezzemolo',2),('Paccheri allo scoglio','Peperoncino',0.3),('Paccheri allo scoglio','Vino bianco da cucina',15),('Paccheri allo scoglio','Olio EVO',10),('Paccheri allo scoglio','Sale',1.5),('Paccheri allo scoglio','Pepe nero',0.2),
    -- SECONDI
    ('Arrosto misto di maiale e salsiccia','Maiale',150),('Arrosto misto di maiale e salsiccia','Salsiccia calabrese',80),('Arrosto misto di maiale e salsiccia','Patate',80),('Arrosto misto di maiale e salsiccia','Rosmarino',1),('Arrosto misto di maiale e salsiccia','Aglio',2),('Arrosto misto di maiale e salsiccia','Vino bianco da cucina',20),('Arrosto misto di maiale e salsiccia','Olio EVO',10),('Arrosto misto di maiale e salsiccia','Sale',2),('Arrosto misto di maiale e salsiccia','Pepe nero',0.4),
    ('Filetto di spigola all''acqua pazza','Spigola',170),('Filetto di spigola all''acqua pazza','Pomodoro datterino',60),('Filetto di spigola all''acqua pazza','Aglio',2),('Filetto di spigola all''acqua pazza','Prezzemolo',2),('Filetto di spigola all''acqua pazza','Vino bianco da cucina',15),('Filetto di spigola all''acqua pazza','Olio EVO',12),('Filetto di spigola all''acqua pazza','Sale',1.5),('Filetto di spigola all''acqua pazza','Pepe nero',0.3),
    ('Bracioline alla calabrese','Vitello',160),('Bracioline alla calabrese','Pecorino crotonese',15),('Bracioline alla calabrese','Pane casereccio',20),('Bracioline alla calabrese','Aglio',2),('Bracioline alla calabrese','Prezzemolo',2),('Bracioline alla calabrese','Olio EVO',10),('Bracioline alla calabrese','Sale',1.5),('Bracioline alla calabrese','Pepe nero',0.3),
    ('Capretto al forno con patate','Capretto',200),('Capretto al forno con patate','Patate',130),('Capretto al forno con patate','Rosmarino',1.5),('Capretto al forno con patate','Aglio',2),('Capretto al forno con patate','Olio EVO',12),('Capretto al forno con patate','Sale',2),('Capretto al forno con patate','Pepe nero',0.4),
    -- CONTORNI
    ('Patate al forno','Patate',150),('Patate al forno','Rosmarino',0.8),('Patate al forno','Olio EVO',8),('Patate al forno','Sale',1.5),('Patate al forno','Pepe nero',0.2),
    ('Verdure grigliate di stagione','Verdure miste di stagione',150),('Verdure grigliate di stagione','Olio EVO',8),('Verdure grigliate di stagione','Origano',0.4),('Verdure grigliate di stagione','Sale',1.2),('Verdure grigliate di stagione','Pepe nero',0.2),
    ('Insalata mista di stagione','Insalata mista di stagione',100),('Insalata mista di stagione','Olio EVO',6),('Insalata mista di stagione','Limone',8),('Insalata mista di stagione','Sale',1),
    ('Peperoni ripieni','Peperoni',120),('Peperoni ripieni','Pane casereccio',25),('Peperoni ripieni','Pecorino crotonese',10),('Peperoni ripieni','Prezzemolo',1.5),('Peperoni ripieni','Aglio',1),('Peperoni ripieni','Olio EVO',6),('Peperoni ripieni','Sale',1.2),('Peperoni ripieni','Pepe nero',0.2),
    -- DOLCI
    ('Torta dell''evento','Farina 00',40),('Torta dell''evento','Zucchero',35),('Torta dell''evento','Uova',1),('Torta dell''evento','Burro',20),('Torta dell''evento','Cioccolato fondente',20),
    ('Frutta di stagione e piccola pasticceria','Frutta di stagione',80),('Frutta di stagione e piccola pasticceria','Pasticceria mignon',40),
    -- BEVANDE
    ('Brindisi con spumante','Spumante',0.18),
    ('Caffe'' e digestivi','Caffe''',7),('Caffe'' e digestivi','Zucchero',6)
  ) x(recipe,ingr,qty)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc
  join public.fb_ingredients i on i.name=x.ingr and i.location_id=v_loc
  where not exists (select 1 from public.fb_recipe_items ri where ri.recipe_id=r.id and ri.ingredient_id=i.id);

  -- ── Menu à-la-carte = catalogo piatti singoli attribuibili agli eventi ─────
  insert into public.fb_menus(location_id, name, basis) values (v_loc, v_menu_name, 'PER_COPERTO') returning id into v_menu;
  insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover, course, sort_order)
  select v_menu, r.id, x.qpc, x.course, x.so
  from (values
    ('Tagliere di salumi e formaggi calabresi',1.0,'ANTIPASTO',1),('Parmigiana di melanzane',1.0,'ANTIPASTO',2),('Frittelle di baccala'' e verdure',1.0,'ANTIPASTO',3),('Insalata di mare tiepida',1.0,'ANTIPASTO',4),
    ('Fileja alla ''nduja e pecorino',0.5,'PRIMO',1),('Risotto ai funghi porcini della Sila',0.5,'PRIMO',2),('Cannelloni ricotta e spinaci al forno',0.5,'PRIMO',3),('Paccheri allo scoglio',0.5,'PRIMO',4),
    ('Arrosto misto di maiale e salsiccia',0.5,'SECONDO',1),('Filetto di spigola all''acqua pazza',0.5,'SECONDO',2),('Bracioline alla calabrese',0.5,'SECONDO',3),('Capretto al forno con patate',0.5,'SECONDO',4),
    ('Patate al forno',0.5,'CONTORNO',1),('Verdure grigliate di stagione',0.5,'CONTORNO',2),('Insalata mista di stagione',0.5,'CONTORNO',3),('Peperoni ripieni',0.5,'CONTORNO',4),
    ('Torta dell''evento',0.8,'DOLCE',1),('Frutta di stagione e piccola pasticceria',0.5,'DOLCE',2),
    ('Brindisi con spumante',1.0,'BEVANDE',1),('Caffe'' e digestivi',1.0,'BEVANDE',2)
  ) x(recipe,qpc,course,so)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc;

  raise notice 'BARONELLA_MENU=% | piatti=% | ingredienti loc=%',
    v_menu,
    (select count(*) from public.fb_menu_items where menu_id=v_menu),
    (select count(*) from public.fb_ingredients where location_id=v_loc);
end $$;
