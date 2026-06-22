-- MENU STRUTTURATI PER PORTATE (come le location da eventi): portata + ordine sulle righe di menu,
-- repertorio piatti più ricco, e 3 menu a fasce (Argento/Oro/Platino) con "secondo a scelta"
-- (modellato con qty frazionaria per coperto = split delle scelte, finché non c'è la scelta per invitato).

alter table public.fb_menu_items add column if not exists course text;
alter table public.fb_menu_items add column if not exists sort_order int not null default 0;
do $$ begin
  alter table public.fb_menu_items add constraint fb_menu_items_course_chk
    check (course is null or course in ('APERITIVO','ANTIPASTO','PRIMO','SECONDO','CONTORNO','DOLCE','FRUTTA','BEVANDE'));
exception when duplicate_object then null; end $$;

create or replace function public.fb_seed_structured_menus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_arg uuid; v_oro uuid; v_plat uuid;
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if exists (select 1 from public.fb_menus where location_id = v_loc and name = 'Menu Oro') then return jsonb_build_object('already', true); end if;
  -- richiede il repertorio base
  if not exists (select 1 from public.fb_recipes where location_id = v_loc and name = 'Fileja alla nduja') then
    return jsonb_build_object('error','seed_base_first');
  end if;

  -- INGREDIENTI nuovi (solo quelli mancanti)
  insert into public.fb_ingredients(location_id, name, stock_unit, category)
  select v_loc, d.name, d.unit, 'Matrimonio'
  from (values ('Scampi','G'),('Branzino','G'),('Riso Carnaroli','G'),('Melanzane','G'),
               ('Pomodorini','G'),('Frutta mista','G'),('Filetto di manzo','G'),('Mignon','PZ')) d(name, unit)
  where not exists (select 1 from public.fb_ingredients i where i.location_id = v_loc and i.name = d.name);

  insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit, valid_from, source)
  select i.id, c.cost, now(), 'PURCHASE'
  from public.fb_ingredients i join (values
    ('Scampi',0.022),('Branzino',0.014),('Riso Carnaroli',0.0035),('Melanzane',0.0018),
    ('Pomodorini',0.003),('Frutta mista',0.0025),('Filetto di manzo',0.028),('Mignon',0.6)
  ) c(name, cost) on c.name = i.name
  where i.location_id = v_loc
    and not exists (select 1 from public.fb_ingredient_cost_versions cv where cv.ingredient_id = i.id);

  -- RICETTE nuove
  insert into public.fb_recipes(location_id, name, yield_qty, yield_unit)
  select v_loc, d.name, 1, 'porzione' from (values
    ('Crudo di mare'),('Parmigiana di melanzane'),('Caprese di bufala'),('Risotto agli scampi'),
    ('Branzino al sale'),('Filetto di manzo'),('Patate al forno'),('Verdure grigliate'),
    ('Torta nuziale'),('Mignon assortiti'),('Frutta di stagione')
  ) d(name)
  where not exists (select 1 from public.fb_recipes r where r.location_id = v_loc and r.name = d.name);

  insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit)
  select r.id, i.id, x.qty, i.stock_unit from (values
    ('Crudo di mare','Scampi',50),('Crudo di mare','Gamberi',40),('Crudo di mare','Olio EVO',5),
    ('Parmigiana di melanzane','Melanzane',120),('Parmigiana di melanzane','Pomodoro pelato',60),('Parmigiana di melanzane','Mozzarella di bufala',40),('Parmigiana di melanzane','Parmigiano Reggiano',15),
    ('Caprese di bufala','Mozzarella di bufala',80),('Caprese di bufala','Pomodorini',60),('Caprese di bufala','Olio EVO',8),
    ('Risotto agli scampi','Riso Carnaroli',90),('Risotto agli scampi','Scampi',50),('Risotto agli scampi','Olio EVO',10),('Risotto agli scampi','Pomodorini',30),
    ('Branzino al sale','Branzino',200),('Branzino al sale','Olio EVO',10),
    ('Filetto di manzo','Filetto di manzo',180),('Filetto di manzo','Olio EVO',10),
    ('Patate al forno','Patate',150),('Patate al forno','Olio EVO',8),
    ('Verdure grigliate','Melanzane',100),('Verdure grigliate','Olio EVO',8),
    ('Torta nuziale','Farina 00',40),('Torta nuziale','Uova',1),('Torta nuziale','Zucchero',40),('Torta nuziale','Burro',25),('Torta nuziale','Panna fresca',30),('Torta nuziale','Cioccolato fondente',15),
    ('Mignon assortiti','Mignon',3),
    ('Frutta di stagione','Frutta mista',120)
  ) x(recipe, ingr, qty)
  join public.fb_recipes r on r.name = x.recipe and r.location_id = v_loc
  join public.fb_ingredients i on i.name = x.ingr and i.location_id = v_loc
  where not exists (select 1 from public.fb_recipe_items ri where ri.recipe_id = r.id and ri.ingredient_id = i.id);

  -- MENU a fasce
  insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Menu Argento', 'PER_COPERTO') returning id into v_arg;
  insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Menu Oro', 'PER_COPERTO') returning id into v_oro;
  insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Menu Platino', 'PER_COPERTO') returning id into v_plat;

  insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover, course, sort_order)
  select m.id, r.id, x.qpc, x.course, x.ord
  from (values
    -- ARGENTO
    ('Menu Argento','Tagliere salumi e formaggi',1,'ANTIPASTO',2),
    ('Menu Argento','Fileja alla nduja',1,'PRIMO',3),
    ('Menu Argento','Maiale al forno con patate',1,'SECONDO',4),
    ('Menu Argento','Cassata di ricotta',1,'DOLCE',6),
    ('Menu Argento','Frutta di stagione',1,'FRUTTA',7),
    ('Menu Argento','Brindisi',1,'BEVANDE',8),
    ('Menu Argento','Caffe espresso',1,'BEVANDE',8),
    -- ORO
    ('Menu Oro','Brindisi',1,'APERITIVO',1),
    ('Menu Oro','Tagliere salumi e formaggi',1,'ANTIPASTO',2),
    ('Menu Oro','Crudo di mare',1,'ANTIPASTO',2),
    ('Menu Oro','Caprese di bufala',1,'ANTIPASTO',2),
    ('Menu Oro','Fileja alla nduja',1,'PRIMO',3),
    ('Menu Oro','Risotto agli scampi',1,'PRIMO',3),
    ('Menu Oro','Maiale al forno con patate',0.5,'SECONDO',4),
    ('Menu Oro','Branzino al sale',0.5,'SECONDO',4),
    ('Menu Oro','Patate al forno',1,'CONTORNO',5),
    ('Menu Oro','Torta nuziale',1,'DOLCE',6),
    ('Menu Oro','Frutta di stagione',1,'FRUTTA',7),
    ('Menu Oro','Caffe espresso',1,'BEVANDE',8),
    -- PLATINO
    ('Menu Platino','Brindisi',1,'APERITIVO',1),
    ('Menu Platino','Tagliere salumi e formaggi',1,'ANTIPASTO',2),
    ('Menu Platino','Crudo di mare',1,'ANTIPASTO',2),
    ('Menu Platino','Parmigiana di melanzane',1,'ANTIPASTO',2),
    ('Menu Platino','Caprese di bufala',1,'ANTIPASTO',2),
    ('Menu Platino','Risotto agli scampi',1,'PRIMO',3),
    ('Menu Platino','Fileja alla nduja',1,'PRIMO',3),
    ('Menu Platino','Filetto di manzo',0.5,'SECONDO',4),
    ('Menu Platino','Branzino al sale',0.5,'SECONDO',4),
    ('Menu Platino','Patate al forno',1,'CONTORNO',5),
    ('Menu Platino','Verdure grigliate',1,'CONTORNO',5),
    ('Menu Platino','Torta nuziale',1,'DOLCE',6),
    ('Menu Platino','Mignon assortiti',1,'DOLCE',6),
    ('Menu Platino','Frutta di stagione',1,'FRUTTA',7),
    ('Menu Platino','Caffe espresso',1,'BEVANDE',8)
  ) x(menu, recipe, qpc, course, ord)
  join public.fb_menus m on m.name = x.menu and m.location_id = v_loc
  join public.fb_recipes r on r.name = x.recipe and r.location_id = v_loc;

  return jsonb_build_object('ok', true, 'menu', jsonb_build_array(v_arg, v_oro, v_plat));
end$$;
grant execute on function public.fb_seed_structured_menus() to authenticated;
