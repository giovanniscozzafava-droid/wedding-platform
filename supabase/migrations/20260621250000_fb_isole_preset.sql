-- Preset BUFFET (uso tipico italiano): giromano (finger passati), isole pre-cena (stazioni),
-- dolci (buffet finale). Carica con un clic ingredienti + costi + ricette + 3 menu, con grammature
-- REALISTICHE a ospite (rule-of-thumb catering ~400-500 g/ospite totali). Il gestore poi modifica
-- grammi, costi e aggiunge voci da solo. SECURITY DEFINER ma scrive SOLO sulla location chiamante.
create or replace function public.fb_load_isole_preset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_loc uuid := auth.uid(); v_menu uuid; v_ing uuid; v_rec uuid; r record; n int := 0;
begin
  if v_loc is null then return jsonb_build_object('error','auth_required'); end if;
  if not exists (select 1 from public.profiles where id = v_loc and role in ('LOCATION','ADMIN')) then
    return jsonb_build_object('error','forbidden');
  end if;

  for r in select * from (values
    -- GIROMANO (finger food passati)
    ('Buffet · Giromano',        'Tartine e canapè',          'Tartine miste',            70,  9.0),
    ('Buffet · Giromano',        'Mini arancini e crocchè',   'Arancini/crocchè',         60,  8.0),
    ('Buffet · Giromano',        'Crostini e bruschette',     'Crostini misti',           55,  7.0),
    ('Buffet · Giromano',        'Mini rustici e quiche',     'Rustici da forno',         55,  8.0),
    ('Buffet · Giromano',        'Polpettine e spiedini',     'Polpette e spiedini',      60, 11.0),
    -- ISOLE pre-cena (stazioni)
    ('Buffet · Isole pre-cena',  'Isola salmone marinato',    'Salmone',                  50, 26.0),
    ('Buffet · Isole pre-cena',  'Isola salumi',              'Salumi affettati misti',   60, 15.0),
    ('Buffet · Isole pre-cena',  'Isola formaggi',            'Formaggi (caciocavallo/pecorino)', 60, 16.0),
    ('Buffet · Isole pre-cena',  'Isola polpo e patate',      'Polpo',                    70, 18.0),
    ('Buffet · Isole pre-cena',  'Isola carne alla griglia',  'Carne mista da griglia',  120, 12.0),
    ('Buffet · Isole pre-cena',  'Isola pizza e focaccia',    'Impasto pizza/focaccia',  100,  5.0),
    ('Buffet · Isole pre-cena',  'Isola pesce crudo',         'Pesce crudo misto',        70, 30.0),
    ('Buffet · Isole pre-cena',  'Isola fritti caldi',        'Misto da frittura',        80,  9.0),
    ('Buffet · Isole pre-cena',  'Isola pasta fresca live',   'Pasta fresca',             90,  6.0),
    ('Buffet · Isole pre-cena',  'Isola verdure grigliate',   'Verdure di stagione',     100,  4.0),
    -- DOLCI (buffet finale)
    ('Buffet · Dolci',           'Pasticceria mignon',        'Pasticceria mignon',       70, 14.0),
    ('Buffet · Dolci',           'Frutta fresca e macedonia', 'Frutta mista',             90,  3.0),
    ('Buffet · Dolci',           'Cioccolateria e praline',   'Cioccolato e praline',     30, 22.0),
    ('Buffet · Dolci',           'Isola gelati e sorbetti',   'Gelato e sorbetti',        70,  7.0),
    ('Buffet · Dolci',           'Taglio torta nuziale',      'Torta nuziale',           100, 12.0)
  ) as t(menu_name, isola, ingr, grammi, eurkg)
  loop
    -- menu (get-or-create)
    select id into v_menu from public.fb_menus where location_id = v_loc and name = r.menu_name and is_active;
    if v_menu is null then insert into public.fb_menus(location_id, name) values (v_loc, r.menu_name) returning id into v_menu; end if;
    -- ingrediente (get-or-create + costo)
    select id into v_ing from public.fb_ingredients where location_id = v_loc and name = r.ingr;
    if v_ing is null then
      insert into public.fb_ingredients(location_id, name, stock_unit, category)
        values (v_loc, r.ingr, 'G', 'Buffet') returning id into v_ing;
      insert into public.fb_ingredient_cost_versions(ingredient_id, cost_per_unit) values (v_ing, round(r.eurkg / 1000.0, 4));
    end if;
    -- ricetta (1 porzione = grammi/ospite)
    insert into public.fb_recipes(location_id, name, yield_qty, yield_unit) values (v_loc, r.isola, 1, 'PORZIONI')
      on conflict (location_id, name) do update set yield_qty = excluded.yield_qty returning id into v_rec;
    delete from public.fb_recipe_items where recipe_id = v_rec;
    insert into public.fb_recipe_items(recipe_id, ingredient_id, qty, unit) values (v_rec, v_ing, r.grammi, 'G');
    -- voce di menu (evita doppioni)
    if not exists (select 1 from public.fb_menu_items where menu_id = v_menu and recipe_id = v_rec) then
      insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover) values (v_menu, v_rec, 1);
    end if;
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'voci', n);
end$$;
grant execute on function public.fb_load_isole_preset() to authenticated;
