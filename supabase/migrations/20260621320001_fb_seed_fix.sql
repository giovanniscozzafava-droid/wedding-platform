-- SIMULAZIONE matrimonio Casino Lenza: cucina completa (ingredienti+costi, ricette, menu matrimonio),
-- fornitori + listini per ogni ingrediente, e legame con un evento a 120 coperti. + RPC che consuma
-- il food dell'evento dal magazzino in FEFO. Idempotente (esce se gia' seedato).

-- re-applied with PURCHASE fix
create or replace function public.fb_seed_wedding_demo()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_menu uuid; v_entry uuid;
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if exists (select 1 from public.fb_menus where location_id = v_loc and name = 'Matrimonio Lenza — Completo') then
    return jsonb_build_object('already', true);
  end if;

  -- INGREDIENTI
  insert into public.fb_ingredients(location_id, name, stock_unit, category)
  select v_loc, d.name, d.unit, 'Matrimonio' from (values
    ('Farina 00','G'),('Salmone affumicato','G'),('Mozzarella di bufala','G'),('Prosciutto crudo','G'),
    ('Capocollo di Calabria','G'),('Nduja','G'),('Pane casereccio','G'),('Pomodoro pelato','G'),
    ('Olio EVO','ML'),('Fileja','G'),('Carne di maiale','G'),('Vitello','G'),('Patate','G'),
    ('Parmigiano Reggiano','G'),('Ricotta','G'),('Uova','PZ'),('Zucchero','G'),('Burro','G'),
    ('Panna fresca','ML'),('Cioccolato fondente','G'),('Gamberi','G'),('Vongole','G'),
    ('Spumante','PZ'),('Caffe','G')
  ) d(name, unit);

  -- COSTI (€/stock_unit)
  insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit, valid_from, source)
  select i.id, c.cost, now(), 'PURCHASE'
  from public.fb_ingredients i join (values
    ('Farina 00',0.0008),('Salmone affumicato',0.028),('Mozzarella di bufala',0.011),('Prosciutto crudo',0.022),
    ('Capocollo di Calabria',0.026),('Nduja',0.014),('Pane casereccio',0.003),('Pomodoro pelato',0.0012),
    ('Olio EVO',0.008),('Fileja',0.0035),('Carne di maiale',0.009),('Vitello',0.016),('Patate',0.0011),
    ('Parmigiano Reggiano',0.014),('Ricotta',0.006),('Uova',0.25),('Zucchero',0.0011),('Burro',0.008),
    ('Panna fresca',0.0035),('Cioccolato fondente',0.012),('Gamberi',0.018),('Vongole',0.009),
    ('Spumante',6.0),('Caffe',0.018)
  ) c(name, cost) on c.name = i.name where i.location_id = v_loc;

  -- RICETTE (resa 1 porzione)
  insert into public.fb_recipes(location_id, name, yield_qty, yield_unit)
  select v_loc, d.name, 1, 'porzione' from (values
    ('Tagliere salumi e formaggi'),('Crostino di salmone'),('Crostino di nduja'),('Frittura di mare'),
    ('Fileja alla nduja'),('Maiale al forno con patate'),('Arrosto di vitello'),('Cassata di ricotta'),
    ('Brindisi'),('Caffe espresso')
  ) d(name);

  -- RIGHE RICETTA (qty in stock_unit per porzione)
  insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit)
  select r.id, i.id, x.qty, i.stock_unit
  from (values
    ('Tagliere salumi e formaggi','Prosciutto crudo',40),('Tagliere salumi e formaggi','Capocollo di Calabria',30),
    ('Tagliere salumi e formaggi','Mozzarella di bufala',50),('Tagliere salumi e formaggi','Pane casereccio',40),
    ('Tagliere salumi e formaggi','Olio EVO',5),
    ('Crostino di salmone','Salmone affumicato',30),('Crostino di salmone','Pane casereccio',25),('Crostino di salmone','Burro',8),
    ('Crostino di nduja','Nduja',20),('Crostino di nduja','Pane casereccio',30),
    ('Frittura di mare','Gamberi',45),('Frittura di mare','Vongole',35),('Frittura di mare','Farina 00',20),('Frittura di mare','Olio EVO',15),
    ('Fileja alla nduja','Fileja',110),('Fileja alla nduja','Nduja',25),('Fileja alla nduja','Pomodoro pelato',70),('Fileja alla nduja','Olio EVO',10),('Fileja alla nduja','Parmigiano Reggiano',12),
    ('Maiale al forno con patate','Carne di maiale',180),('Maiale al forno con patate','Patate',160),('Maiale al forno con patate','Olio EVO',12),
    ('Arrosto di vitello','Vitello',160),('Arrosto di vitello','Patate',100),('Arrosto di vitello','Olio EVO',10),
    ('Cassata di ricotta','Ricotta',90),('Cassata di ricotta','Zucchero',35),('Cassata di ricotta','Cioccolato fondente',20),('Cassata di ricotta','Farina 00',30),('Cassata di ricotta','Uova',1),('Cassata di ricotta','Burro',15),
    ('Brindisi','Spumante',0.18),
    ('Caffe espresso','Caffe',7)
  ) x(recipe, ingr, qty)
  join public.fb_recipes r on r.name = x.recipe and r.location_id = v_loc
  join public.fb_ingredients i on i.name = x.ingr and i.location_id = v_loc;

  -- MENU matrimonio
  insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Matrimonio Lenza — Completo', 'PER_COPERTO') returning id into v_menu;
  insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover)
  select v_menu, r.id, x.qpc
  from (values
    ('Tagliere salumi e formaggi',1),('Crostino di salmone',1),('Crostino di nduja',1),('Frittura di mare',1),
    ('Fileja alla nduja',1),('Maiale al forno con patate',0.6),('Arrosto di vitello',0.4),
    ('Cassata di ricotta',1),('Brindisi',1),('Caffe espresso',1)
  ) x(recipe, qpc)
  join public.fb_recipes r on r.name = x.recipe and r.location_id = v_loc;

  -- FORNITORI
  insert into public.fb_suppliers(location_id, name, phone, lead_time_days)
  select v_loc, d.name, d.ph, 2 from (values
    ('Molino Jonico','0962 21345'),('Ittico Tirreno','0963 55120'),('Caseificio Sila','0961 78890'),
    ('Macelleria Calabra','0961 33210'),('Ortofrutta del Sud','0962 44781'),('Cash&Carry Metro','0961 99002')
  ) d(name, ph);

  -- LISTINI (pack_qty in stock_unit)
  insert into public.fb_supplier_products(supplier_id, ingredient_id, pack_label, pack_qty_stock_unit, pack_price, is_preferred)
  select s.id, i.id, x.label, x.qty, x.price, true
  from (values
    ('Molino Jonico','Farina 00','Sacco 25kg',25000,18),
    ('Ittico Tirreno','Salmone affumicato','Conf. 1kg',1000,26),('Ittico Tirreno','Gamberi','Cassa 2kg',2000,34),('Ittico Tirreno','Vongole','Sacco 5kg',5000,42),
    ('Caseificio Sila','Mozzarella di bufala','Conf. 3kg',3000,30),('Caseificio Sila','Ricotta','Secchio 5kg',5000,28),('Caseificio Sila','Parmigiano Reggiano','Forma 1kg',1000,13),('Caseificio Sila','Burro','Panetto 1kg',1000,7.5),('Caseificio Sila','Panna fresca','Brik 1L',1000,3.2),
    ('Macelleria Calabra','Prosciutto crudo','Conf. 2kg',2000,42),('Macelleria Calabra','Capocollo di Calabria','Pezzo 1.5kg',1500,38),('Macelleria Calabra','Nduja','Conf. 1kg',1000,13),('Macelleria Calabra','Carne di maiale','Cassa 10kg',10000,82),('Macelleria Calabra','Vitello','Cassa 5kg',5000,78),
    ('Ortofrutta del Sud','Pomodoro pelato','Cartone 12x400g',4800,9.6),('Ortofrutta del Sud','Patate','Sacco 25kg',25000,22),('Ortofrutta del Sud','Olio EVO','Latta 5L',5000,38),
    ('Cash&Carry Metro','Pane casereccio','Conf. 5kg',5000,14),('Cash&Carry Metro','Fileja','Conf. 3kg',3000,9),('Cash&Carry Metro','Zucchero','Sacco 10kg',10000,11),('Cash&Carry Metro','Cioccolato fondente','Conf. 2kg',2000,22),('Cash&Carry Metro','Uova','Cartone 30pz',30,6),('Cash&Carry Metro','Spumante','Cartone 6 btl',6,33),('Cash&Carry Metro','Caffe','Conf. 1kg',1000,16)
  ) x(sup, ingr, label, qty, price)
  join public.fb_suppliers s on s.name = x.sup and s.location_id = v_loc
  join public.fb_ingredients i on i.name = x.ingr and i.location_id = v_loc;

  -- EVENTO: primo evento della location, 120 coperti, menu agganciato
  select id into v_entry from public.calendar_entries where owner_id = v_loc order by date_from limit 1;
  if v_entry is not null then
    update public.calendar_entries set guest_count = 120 where id = v_entry;
    insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_loc, v_entry, v_menu, 120);
  end if;

  return jsonb_build_object('ok', true, 'menu', v_menu, 'entry', v_entry);
end$$;
grant execute on function public.fb_seed_wedding_demo() to authenticated;

