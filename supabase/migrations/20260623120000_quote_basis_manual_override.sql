-- Quantità per-invitato/per-tavolo MODIFICABILI a mano: cambiando guest_count/table_count del
-- preventivo NON si sovrascrivono più le righe impostate manualmente (es. "10 damigelle" su un
-- servizio a persona). Si ri-allineano solo le righe ancora uguali al vecchio totale.
create or replace function quotes_propagate_basis()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.guest_count is distinct from old.guest_count then
    update quote_items
       set quantity = greatest(coalesce(new.guest_count, 1), 1)
     where quote_id = new.id
       and quantity_basis = 'PER_GUEST'
       and quantity = greatest(coalesce(old.guest_count, 1), 1);   -- solo se ancora = vecchio totale
  end if;
  if new.table_count is distinct from old.table_count then
    update quote_items
       set quantity = greatest(coalesce(new.table_count, 1), 1)
     where quote_id = new.id
       and quantity_basis = 'PER_TABLE'
       and quantity = greatest(coalesce(old.table_count, 1), 1);
  end if;
  return new;
end$$;
