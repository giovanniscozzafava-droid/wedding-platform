-- ============================================================================
-- Quote: table_count + quantity_basis per moltiplicatori automatici
-- ============================================================================

alter table quotes
  add column if not exists table_count int;

-- quantity_basis = 'FLAT' | 'PER_GUEST' | 'PER_TABLE' | 'PER_HOUR'
-- per ricalcolo automatico quando cambia guest_count/table_count del quote.
create type quantity_basis as enum ('FLAT', 'PER_GUEST', 'PER_TABLE', 'PER_HOUR');

alter table quote_items
  add column if not exists quantity_basis quantity_basis not null default 'FLAT';

-- Funzione: quando quote.guest_count o table_count cambia, ricalcola quantity
-- dei quote_items con basis PER_GUEST / PER_TABLE.
create or replace function quotes_propagate_basis()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.guest_count is distinct from old.guest_count then
    update quote_items
       set quantity = greatest(coalesce(new.guest_count, 1), 1)
     where quote_id = new.id
       and quantity_basis = 'PER_GUEST';
  end if;
  if new.table_count is distinct from old.table_count then
    update quote_items
       set quantity = greatest(coalesce(new.table_count, 1), 1)
     where quote_id = new.id
       and quantity_basis = 'PER_TABLE';
  end if;
  return new;
end$$;

create trigger trg_quotes_basis_propagate
  after update of guest_count, table_count on quotes
  for each row execute function quotes_propagate_basis();
