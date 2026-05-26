-- ============================================================================
-- SERVICES — colonna display_order per consentire al fornitore di riordinare
-- le proprie card tramite drag-and-drop sul catalogo. Default 0 (alphabetical
-- fallback se mai settato).
-- ============================================================================

alter table services
  add column if not exists display_order int not null default 0;

create index if not exists idx_services_owner_order
  on services(fornitore_id, display_order);

comment on column services.display_order is
  'Posizione preferita dal fornitore. Ordinamento crescente. Riordinabile via drag-and-drop su CatalogPage.';

-- RPC bulk update — atomico, sicuro per RLS (il filtro fornitore_id = auth.uid()
-- + esistenza RLS modify_owner garantisce che nessuno possa riordinare i
-- servizi altrui).
create or replace function reorder_services(p_ids uuid[])
returns void
language plpgsql
security invoker
as $$
declare
  i int;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;
  for i in 1..array_length(p_ids, 1) loop
    update services
       set display_order = i,
           updated_at    = now()
     where id            = p_ids[i]
       and fornitore_id  = auth.uid();
  end loop;
end$$;

grant execute on function reorder_services(uuid[]) to authenticated;

comment on function reorder_services(uuid[]) is
  'Riordina i servizi del fornitore. p_ids = array nel nuovo ordine desiderato. Aggiorna display_order da 1..N solo per le righe di proprieta'' di auth.uid().';
