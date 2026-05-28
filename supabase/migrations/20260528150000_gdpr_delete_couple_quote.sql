-- ============================================================================
-- GDPR 196/2003: eliminazione completa preventivo + dati coppia
-- ----------------------------------------------------------------------------
-- Espone due RPC SECURITY DEFINER che permettono al WP (owner) di eliminare
-- un preventivo o un intero matrimonio + tutta la cascata dei dati personali
-- della coppia. Le RPC ritornano la lista dei path Storage da rimuovere
-- (il client li passa a supabase.storage.from(...).remove(...)).
-- ============================================================================

-- 1) Helper: estrae i path di firme/PDF dalle quote_acceptances di una quote
create or replace function _quote_storage_paths(p_quote_id uuid)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public
as $$
  select 'quote-signatures'::text, regexp_replace(qa.signature_url, '^.*/quote-signatures/', '')
    from quote_acceptances qa
   where qa.quote_id = p_quote_id and qa.signature_url is not null
   union all
  select 'quote-signatures'::text, regexp_replace(qa.acceptance_pdf_url, '^.*/quote-signatures/', '')
    from quote_acceptances qa
   where qa.quote_id = p_quote_id and qa.acceptance_pdf_url is not null
$$;

-- 2) Helper: tutti i path Storage di un wedding (event-documents + quote signatures di eventuale quote linkata)
create or replace function _wedding_storage_paths(p_entry_id uuid)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public
as $$
  select 'event-documents'::text, ed.storage_path
    from event_documents ed
   where ed.entry_id = p_entry_id and ed.storage_path is not null
   union all
  select sp.bucket, sp.path
    from calendar_entries ce
   cross join lateral _quote_storage_paths(ce.quote_id) sp
   where ce.id = p_entry_id and ce.quote_id is not null
$$;

-- 3) RPC pubblica: elimina un preventivo + tutta la cascata
create or replace function delete_quote_cascade(p_quote_id uuid)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select owner_id into v_owner from quotes where id = p_quote_id;
  if v_owner is null then raise exception 'quote_not_found'; end if;

  select is_admin() into v_is_admin;
  if v_owner <> auth.uid() and not coalesce(v_is_admin, false) then
    raise exception 'forbidden';
  end if;

  -- snapshot path prima del delete (cascade porterà via le righe)
  create temporary table _tmp_paths on commit drop as
    select * from _quote_storage_paths(p_quote_id);

  -- Disancora dal calendar_entry (FK SET NULL già)
  update calendar_entries set quote_id = null where quote_id = p_quote_id;

  -- Disancora i contracts (FK SET NULL già) e cancellali se sono del medesimo owner
  delete from contracts where quote_id = p_quote_id;

  -- Cancella la quote: cascade su quote_items, quote_supplier_markups,
  -- quote_views, quote_acceptances.
  delete from quotes where id = p_quote_id;

  return query select t.bucket, t.path from _tmp_paths t where t.path is not null and t.path <> '';
end$$;

grant execute on function delete_quote_cascade(uuid) to authenticated;

-- 4) RPC pubblica: elimina interamente un matrimonio + dati coppia
create or replace function delete_wedding_cascade(p_entry_id uuid)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_is_admin boolean;
  v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select owner_id, quote_id into v_owner, v_quote_id from calendar_entries where id = p_entry_id;
  if v_owner is null then raise exception 'entry_not_found'; end if;

  select is_admin() into v_is_admin;
  if v_owner <> auth.uid() and not coalesce(v_is_admin, false) then
    raise exception 'forbidden';
  end if;

  -- snapshot path Storage prima del delete (cascade li perderebbe)
  create temporary table _tmp_paths on commit drop as
    select * from _wedding_storage_paths(p_entry_id);

  -- Cancella la calendar_entry: cascade su wedding_couple_members,
  -- couple_preferences, event_guests, event_accommodations, event_transport,
  -- event_subevents, event_tables, event_playlist, event_gadgets,
  -- mood_images, wedding_tasks, budget_categories, budget_entries,
  -- event_documents, couple_change_requests.
  -- Il calendar_entry ha FK SET NULL su quote_id quindi non cascada la quote;
  -- la cancelliamo esplicitamente se presente.
  delete from calendar_entries where id = p_entry_id;
  if v_quote_id is not null then
    -- cascade su quote_items/markups/views/acceptances/contracts
    delete from contracts where quote_id = v_quote_id;
    delete from quotes where id = v_quote_id;
  end if;

  return query select t.bucket, t.path from _tmp_paths t where t.path is not null and t.path <> '';
end$$;

grant execute on function delete_wedding_cascade(uuid) to authenticated;
