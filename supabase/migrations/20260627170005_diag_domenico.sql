do $$ declare r record; begin
  for r in select ce.id, ce.title, ce.owner_id, p.slug owner_slug, p.role::text owner_role,
                  (select count(*) from public.event_galleries g where g.entry_id=ce.id) gal,
                  (select count(*) from public.gallery_media m where m.entry_id=ce.id) media
           from public.calendar_entries ce join public.profiles p on p.id=ce.owner_id
           where ce.title ilike '%domenico%' or ce.title ilike '%raffa%' loop
    raise notice 'EV id=% | "%" | owner=%(% / %) | gallerie=% | media=%', r.id, r.title, r.owner_slug, r.owner_role, r.owner_id, r.gal, r.media;
  end loop;
  raise notice '--- struttura cerchio: tabelle partecipanti evento ---';
  for r in select table_name from information_schema.columns where table_schema='public' and column_name='entry_id' and table_name ilike '%particip%' or table_name ilike '%collab%' or table_name ilike '%member%' group by table_name loop
    raise notice 'TAB=%', r.table_name;
  end loop;
end $$;
