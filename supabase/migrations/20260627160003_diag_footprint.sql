do $$ declare pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; begin
  raise notice 'EVENTI(owner)=% | COLLAB=% | QUOTES(owner)=% | CONTRACTS=% | GALLERIE=%',
    (select count(*) from public.calendar_entries where owner_id=pid),
    (select count(*) from public.collaborations where fornitore_id=pid or capostipite_id=pid),
    (select count(*) from public.quotes where owner_id=pid),
    (select count(*) from public.contracts where owner_id=pid),
    (select count(*) from public.event_galleries where owner_id=pid);
exception when others then raise notice 'FOOTPRINT_ERR=%', sqlerrm; end $$;
