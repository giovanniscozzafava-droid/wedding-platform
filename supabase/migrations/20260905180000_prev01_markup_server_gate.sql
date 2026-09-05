-- ============================================================================
-- PREV-01: il gate "solo il capostipite (WP/LOCATION) imposta il markup" era
-- SOLO in UI (i campi sono nascosti per un FORNITORE nell'editor). Le RLS su
-- quotes/quote_items/quote_supplier_markups verificano solo owner_id = caller,
-- mai il ruolo: chiunque scriva sulla riga (via API diretta) può impostare un
-- ricarico, anche se non è un capostipite. Fix: trigger che rifiuta un
-- ricarico diverso da zero se l'owner del preventivo non è WP/LOCATION/ADMIN.
-- Un valore a 0 resta sempre permesso (nessun ricarico da proteggere).
-- ============================================================================

create or replace function enforce_quote_markup_capostipite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if tg_op = 'UPDATE' and new.default_markup_percent is not distinct from old.default_markup_percent then
    return new;
  end if;
  if coalesce(new.default_markup_percent, 0) = 0 then
    return new;
  end if;
  select role::text into v_role from profiles where id = new.owner_id;
  if v_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    raise exception 'Solo un capostipite (Wedding Planner/Location) può impostare un ricarico.' using errcode = '42501';
  end if;
  return new;
end$$;

drop trigger if exists trg_enforce_quote_markup on quotes;
create trigger trg_enforce_quote_markup
  before insert or update of default_markup_percent on quotes
  for each row execute function enforce_quote_markup_capostipite();

create or replace function enforce_quote_item_markup_capostipite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if tg_op = 'UPDATE' and new.item_markup_percent is not distinct from old.item_markup_percent then
    return new;
  end if;
  if coalesce(new.item_markup_percent, 0) = 0 then
    return new;
  end if;
  select p.role::text into v_role
    from quotes q join profiles p on p.id = q.owner_id
   where q.id = new.quote_id;
  if v_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    raise exception 'Solo un capostipite (Wedding Planner/Location) può impostare un ricarico.' using errcode = '42501';
  end if;
  return new;
end$$;

drop trigger if exists trg_enforce_quote_item_markup on quote_items;
create trigger trg_enforce_quote_item_markup
  before insert or update of item_markup_percent on quote_items
  for each row execute function enforce_quote_item_markup_capostipite();

create or replace function enforce_quote_supplier_markup_capostipite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if tg_op = 'UPDATE' and new.markup_percent is not distinct from old.markup_percent then
    return new;
  end if;
  select p.role::text into v_role
    from quotes q join profiles p on p.id = q.owner_id
   where q.id = new.quote_id;
  if v_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    raise exception 'Solo un capostipite (Wedding Planner/Location) può impostare un ricarico.' using errcode = '42501';
  end if;
  return new;
end$$;

drop trigger if exists trg_enforce_quote_supplier_markup on quote_supplier_markups;
create trigger trg_enforce_quote_supplier_markup
  before insert or update of markup_percent on quote_supplier_markups
  for each row execute function enforce_quote_supplier_markup_capostipite();
