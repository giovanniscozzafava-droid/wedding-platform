do $$ declare t text; c text; begin
  foreach t in array array['fb_ingredients','fb_ingredient_cost_versions','fb_recipes','fb_recipe_items','fb_menus','fb_menu_items','fb_event_menus','fb_tastings','fb_tasting_menus','fb_tasting_votes','fb_tasting_invites'] loop
    select string_agg(column_name||':'||data_type, ', ' order by ordinal_position) into c
      from information_schema.columns where table_schema='public' and table_name=t;
    raise notice '% => %', t, coalesce(c,'(ASSENTE)');
  end loop;
  -- RPC che collegano evento↔menu↔tasting
  select string_agg(p.proname,', ') into c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fb_%';
  raise notice 'FB_RPC => %', c;
end $$;
