-- La Tenuta delle Grazie (LOCATION) entra nel cerchio del matrimonio "Domenico e Raffa" (del fotografo)
-- come location → vede e può mostrare le foto. Replica event_add_capostipite_id.
insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
values ('4c4aeaa7-7bf0-4ef1-b7a0-cefbaf98393a', 'bfca21ff-3654-4826-bfb5-5e248d5dee34', 'location', true)
on conflict (entry_id, user_id) do update set confirmed = true, role_in_entry = 'location';

do $$ declare n int; vis int; begin
  select count(*) into n from public.calendar_entry_participants
    where entry_id='4c4aeaa7-7bf0-4ef1-b7a0-cefbaf98393a' and user_id='bfca21ff-3654-4826-bfb5-5e248d5dee34' and confirmed;
  raise notice 'PARTECIPA_TENUTA=% | foto evento=%', n, (select count(*) from public.gallery_media where entry_id='4c4aeaa7-7bf0-4ef1-b7a0-cefbaf98393a');
end $$;
