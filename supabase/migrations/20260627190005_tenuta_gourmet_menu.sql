-- Menu GOURMET à-la-carte Tenuta delle Grazie: piatti singoli per portata (3 antipasti, 4 primi,
-- 4 secondi, 4 contorni, 2 dolci, brindisi/caffè). Sostituisce i menu preset. course ammessi:
-- APERITIVO/ANTIPASTO/PRIMO/SECONDO/CONTORNO/DOLCE/FRUTTA/BEVANDE.
do $$
declare v_loc uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; v_menu uuid; v_entry uuid;
begin
  delete from public.fb_event_menus where location_id = v_loc;
  delete from public.fb_menus where location_id = v_loc;

  insert into public.fb_ingredients(location_id, name, stock_unit, category)
  select v_loc, d.n, d.u, 'Gourmet' from (values
    ('Gambero rosso di Mazara','G'),('Caciocavallo silano','G'),('Polpo','G'),('Maiale nero di Calabria','G'),
    ('Pescato del giorno','G'),('Capretto','G'),('Cipolla di Tropea','G'),('Zafferano di Calabria','G'),
    ('Nocciole','G'),('Pecorino crotonese','G'),('Pomodoro datterino','G'),('Riso Carnaroli','G'),
    ('Agrumi di Calabria','G'),('Verdure dell''orto','G'),('Miele di fichi','G'),('Ciro Rosso DOC','ML')
  ) d(n,u) where not exists (select 1 from public.fb_ingredients i where i.location_id=v_loc and i.name=d.n);

  insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit, valid_from, source)
  select i.id, c.cost, now(), 'PURCHASE' from public.fb_ingredients i join (values
    ('Gambero rosso di Mazara',0.045),('Caciocavallo silano',0.013),('Polpo',0.016),('Maiale nero di Calabria',0.018),
    ('Pescato del giorno',0.022),('Capretto',0.015),('Cipolla di Tropea',0.003),('Zafferano di Calabria',0.9),
    ('Nocciole',0.012),('Pecorino crotonese',0.016),('Pomodoro datterino',0.0025),('Riso Carnaroli',0.003),
    ('Agrumi di Calabria',0.004),('Verdure dell''orto',0.0025),('Miele di fichi',0.012),('Ciro Rosso DOC',0.012)
  ) c(n,cost) on c.n=i.name where i.location_id=v_loc
    and not exists (select 1 from public.fb_ingredient_cost_versions cv where cv.ingredient_id=i.id);

  insert into public.fb_recipes(location_id, name, yield_qty, yield_unit)
  select v_loc, n, 1, 'porzione' from (values
    ('Tartare di gambero rosso, agrumi e nduja'),('Caciocavallo fondente, miele e pane'),('Polpo arrostito, crema di patate e Tropea'),
    ('Fileja alla nduja, datterino e pecorino crotonese'),('Risotto nduja e gambero rosso'),('Scialatielli ai frutti di mare'),('Tortelli ricotta e zafferano, burro e nocciole'),
    ('Filetto di maiale nero, riduzione al Ciro e patate'),('Pescato in crosta, pomodorini confit'),('Tagliata di vitello podolico, rucola e pecorino'),('Capretto al forno, patate ed erbe della macchia'),
    ('Patate della Sila al rosmarino'),('Verdure dell''orto grigliate'),('Cipolla di Tropea caramellata'),('Insalata di stagione agli agrumi'),
    ('Cassata calabrese rivisitata'),('Mostaccioli e dolci della tradizione'),('Brindisi gourmet'),('Caffe espresso gourmet')
  ) d(n) where not exists (select 1 from public.fb_recipes r where r.location_id=v_loc and r.name=d.n);

  insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit)
  select r.id, i.id, x.qty, i.stock_unit
  from (values
    ('Tartare di gambero rosso, agrumi e nduja','Gambero rosso di Mazara',60),('Tartare di gambero rosso, agrumi e nduja','Agrumi di Calabria',15),('Tartare di gambero rosso, agrumi e nduja','Nduja',8),('Tartare di gambero rosso, agrumi e nduja','Olio EVO',5),
    ('Caciocavallo fondente, miele e pane','Caciocavallo silano',70),('Caciocavallo fondente, miele e pane','Pane casereccio',30),('Caciocavallo fondente, miele e pane','Miele di fichi',10),
    ('Polpo arrostito, crema di patate e Tropea','Polpo',80),('Polpo arrostito, crema di patate e Tropea','Patate',90),('Polpo arrostito, crema di patate e Tropea','Cipolla di Tropea',30),('Polpo arrostito, crema di patate e Tropea','Olio EVO',8),
    ('Fileja alla nduja, datterino e pecorino crotonese','Fileja',110),('Fileja alla nduja, datterino e pecorino crotonese','Nduja',22),('Fileja alla nduja, datterino e pecorino crotonese','Pomodoro datterino',70),('Fileja alla nduja, datterino e pecorino crotonese','Pecorino crotonese',12),('Fileja alla nduja, datterino e pecorino crotonese','Olio EVO',8),
    ('Risotto nduja e gambero rosso','Riso Carnaroli',90),('Risotto nduja e gambero rosso','Gambero rosso di Mazara',40),('Risotto nduja e gambero rosso','Nduja',12),('Risotto nduja e gambero rosso','Pecorino crotonese',8),('Risotto nduja e gambero rosso','Olio EVO',6),
    ('Scialatielli ai frutti di mare','Farina 00',90),('Scialatielli ai frutti di mare','Gamberi',40),('Scialatielli ai frutti di mare','Vongole',40),('Scialatielli ai frutti di mare','Pomodoro datterino',40),('Scialatielli ai frutti di mare','Olio EVO',10),
    ('Tortelli ricotta e zafferano, burro e nocciole','Farina 00',70),('Tortelli ricotta e zafferano, burro e nocciole','Ricotta',60),('Tortelli ricotta e zafferano, burro e nocciole','Zafferano di Calabria',0.1),('Tortelli ricotta e zafferano, burro e nocciole','Burro',20),('Tortelli ricotta e zafferano, burro e nocciole','Nocciole',12),('Tortelli ricotta e zafferano, burro e nocciole','Uova',0.3),
    ('Filetto di maiale nero, riduzione al Ciro e patate','Maiale nero di Calabria',180),('Filetto di maiale nero, riduzione al Ciro e patate','Patate',120),('Filetto di maiale nero, riduzione al Ciro e patate','Ciro Rosso DOC',60),('Filetto di maiale nero, riduzione al Ciro e patate','Olio EVO',10),
    ('Pescato in crosta, pomodorini confit','Pescato del giorno',170),('Pescato in crosta, pomodorini confit','Pane casereccio',30),('Pescato in crosta, pomodorini confit','Pomodoro datterino',50),('Pescato in crosta, pomodorini confit','Olio EVO',12),
    ('Tagliata di vitello podolico, rucola e pecorino','Vitello',170),('Tagliata di vitello podolico, rucola e pecorino','Pecorino crotonese',15),('Tagliata di vitello podolico, rucola e pecorino','Olio EVO',10),
    ('Capretto al forno, patate ed erbe della macchia','Capretto',200),('Capretto al forno, patate ed erbe della macchia','Patate',130),('Capretto al forno, patate ed erbe della macchia','Olio EVO',12),
    ('Patate della Sila al rosmarino','Patate',150),('Patate della Sila al rosmarino','Olio EVO',8),
    ('Verdure dell''orto grigliate','Verdure dell''orto',150),('Verdure dell''orto grigliate','Olio EVO',8),
    ('Cipolla di Tropea caramellata','Cipolla di Tropea',120),('Cipolla di Tropea caramellata','Zucchero',15),('Cipolla di Tropea caramellata','Olio EVO',5),
    ('Insalata di stagione agli agrumi','Verdure dell''orto',100),('Insalata di stagione agli agrumi','Agrumi di Calabria',30),('Insalata di stagione agli agrumi','Olio EVO',6),
    ('Cassata calabrese rivisitata','Ricotta',90),('Cassata calabrese rivisitata','Zucchero',35),('Cassata calabrese rivisitata','Cioccolato fondente',20),('Cassata calabrese rivisitata','Farina 00',30),('Cassata calabrese rivisitata','Uova',1),('Cassata calabrese rivisitata','Burro',15),
    ('Mostaccioli e dolci della tradizione','Farina 00',50),('Mostaccioli e dolci della tradizione','Zucchero',30),('Mostaccioli e dolci della tradizione','Cioccolato fondente',15),('Mostaccioli e dolci della tradizione','Uova',0.3),
    ('Brindisi gourmet','Spumante',0.18),
    ('Caffe espresso gourmet','Caffe',7)
  ) x(recipe,ingr,qty)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc
  join public.fb_ingredients i on i.name=x.ingr and i.location_id=v_loc
  where not exists (select 1 from public.fb_recipe_items ri where ri.recipe_id=r.id and ri.ingredient_id=i.id);

  insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Tenuta delle Grazie — Menu gourmet', 'PER_COPERTO') returning id into v_menu;
  insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover, course, sort_order)
  select v_menu, r.id, x.qpc, x.course, x.so
  from (values
    ('Tartare di gambero rosso, agrumi e nduja',1.0,'ANTIPASTO',1),('Caciocavallo fondente, miele e pane',1.0,'ANTIPASTO',2),('Polpo arrostito, crema di patate e Tropea',1.0,'ANTIPASTO',3),
    ('Fileja alla nduja, datterino e pecorino crotonese',0.5,'PRIMO',1),('Risotto nduja e gambero rosso',0.5,'PRIMO',2),('Scialatielli ai frutti di mare',0.5,'PRIMO',3),('Tortelli ricotta e zafferano, burro e nocciole',0.5,'PRIMO',4),
    ('Filetto di maiale nero, riduzione al Ciro e patate',0.5,'SECONDO',1),('Pescato in crosta, pomodorini confit',0.5,'SECONDO',2),('Tagliata di vitello podolico, rucola e pecorino',0.5,'SECONDO',3),('Capretto al forno, patate ed erbe della macchia',0.5,'SECONDO',4),
    ('Patate della Sila al rosmarino',0.5,'CONTORNO',1),('Verdure dell''orto grigliate',0.5,'CONTORNO',2),('Cipolla di Tropea caramellata',0.5,'CONTORNO',3),('Insalata di stagione agli agrumi',0.5,'CONTORNO',4),
    ('Cassata calabrese rivisitata',0.7,'DOLCE',1),('Mostaccioli e dolci della tradizione',0.5,'DOLCE',2),
    ('Brindisi gourmet',1.0,'BEVANDE',1),('Caffe espresso gourmet',1.0,'BEVANDE',2)
  ) x(recipe,qpc,course,so)
  join public.fb_recipes r on r.name=x.recipe and r.location_id=v_loc;

  select id into v_entry from public.calendar_entries where owner_id=v_loc order by date_from limit 1;
  if v_entry is not null then insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_loc, v_entry, v_menu, 120); end if;
  raise notice 'MENU_GOURMET=% | piatti=%', v_menu, (select count(*) from public.fb_menu_items where menu_id=v_menu);
end $$;
