-- ============================================================================
-- Aggiunge EVENT_DATE all'enum change_request_entity
-- ----------------------------------------------------------------------------
-- Permette alla coppia di richiedere modifica della data cerimonia/evento
-- al WP senza poterla modificare direttamente (la data e` stabilita dal
-- preventivo accettato e va concordata).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'change_request_entity' and e.enumlabel = 'EVENT_DATE'
  ) then
    alter type change_request_entity add value 'EVENT_DATE';
  end if;
end$$;
