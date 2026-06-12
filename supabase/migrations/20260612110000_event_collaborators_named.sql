-- "Colleghi sull'evento" mostrava "Collega" invece del nome vero: l'embed
-- profiles è bloccato dalla RLS (il proprietario non legge il profilo altrui).
-- RPC SECURITY DEFINER che risolve il nome server-side (business_name → full_name
-- → parte locale dell'email), visibile solo al proprietario dell'evento.
create or replace function public.event_collaborators_named(p_event_id uuid)
returns table(id uuid, collaborator_id uuid, status text, can_edit boolean, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.collaborator_id, c.status, c.can_edit,
         coalesce(
           nullif(btrim(p.business_name), ''),
           nullif(btrim(p.full_name), ''),
           nullif(split_part(u.email, '@', 1), ''),
           'Collega'
         )
    from public.supplier_event_collaborators c
    left join public.profiles  p on p.id = c.collaborator_id
    left join auth.users       u on u.id = c.collaborator_id
   where c.event_id = p_event_id
     and c.owner_id = auth.uid();
$$;
grant execute on function public.event_collaborators_named(uuid) to authenticated;
