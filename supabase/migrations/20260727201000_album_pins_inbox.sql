-- Vista aggregata "Richieste dei clienti" lato fotografo: TUTTE le puntine di TUTTI i suoi eventi
-- in un solo posto (un solo catalogo, puntine di tutti i clienti). Ogni riga porta il nome del cliente,
-- il PDF/catalogo, la pagina, il commento, lo stato e l'attività del thread. Cliccando, il fotografo
-- va al punto esatto via deep-link /scegli-album/:entryId?pin=<id>.
--
-- Stato puntina: OPEN | CHOSEN | RESOLVED (la puntina resta sul catalogo finché il fotografo non la
-- segna "gestita" = RESOLVED, oppure il cliente sceglie = CHOSEN).

create or replace function public.album_pins_inbox()
returns table (
  id uuid, entry_id uuid, catalog_id uuid, pdf_path text, page int,
  x real, y real, comment text, status text, created_at timestamptz,
  client_name text, msg_count bigint, last_msg_role text, last_msg_at timestamptz
) language sql security definer set search_path = public as $$
  select p.id, p.entry_id, p.catalog_id, c.pdf_path, p.page,
         p.x, p.y, p.comment, p.status, p.created_at,
         coalesce(nullif(btrim(cep.client_name), ''), 'Cliente') as client_name,
         (select count(*) from public.album_pin_messages m where m.pin_id = p.id) as msg_count,
         (select m.author_role from public.album_pin_messages m where m.pin_id = p.id order by m.created_at desc limit 1) as last_msg_role,
         (select max(m.created_at) from public.album_pin_messages m where m.pin_id = p.id) as last_msg_at
  from public.album_pins p
  join public.calendar_entries ce on ce.id = p.entry_id
  left join public.calendar_entries_private cep on cep.entry_id = p.entry_id
  left join public.album_catalogs c on c.id = p.catalog_id
  where ce.owner_id = auth.uid()
  order by (p.status = 'OPEN') desc,
           coalesce((select max(m.created_at) from public.album_pin_messages m where m.pin_id = p.id), p.created_at) desc;
$$;

revoke all on function public.album_pins_inbox() from anon, public;
grant execute on function public.album_pins_inbox() to authenticated;
