-- ============================================================================
-- PREV-07: erogatore_e_capostipite non era vincolato a supplier_id = owner del
-- preventivo da nessun CHECK/trigger. Il trigger di ricalcolo azzera il
-- margine (line_cost := line_client) su qualunque voce con questo flag a
-- true, e _populate_network_settlements la esclude dal calcolo di quanto è
-- dovuto ai fornitori esterni: un flag mal impostato su una voce di un vero
-- fornitore esterno azzererebbe il suo margine ED escluderebbe il fornitore
-- dal settlement dovuto, senza alcuna barriera server-side. Nessuna riga
-- esistente viola il vincolo (verificato: 483 righe con flag=true, 0 con
-- supplier_id diverso dall'owner del preventivo).
-- ============================================================================

create or replace function enforce_erogatore_e_capostipite_matches_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if coalesce(new.erogatore_e_capostipite, false) = false then
    return new;
  end if;
  if new.supplier_id is null then
    return new; -- servizio proprio senza fornitore associato: coerente col flag
  end if;
  select owner_id into v_owner from quotes where id = new.quote_id;
  if new.supplier_id is distinct from v_owner then
    raise exception 'erogatore_e_capostipite=true richiede supplier_id = owner del preventivo (o nullo).' using errcode = '23514';
  end if;
  return new;
end$$;

drop trigger if exists trg_enforce_erogatore_capostipite on quote_items;
create trigger trg_enforce_erogatore_capostipite
  before insert or update of erogatore_e_capostipite, supplier_id, quote_id on quote_items
  for each row execute function enforce_erogatore_e_capostipite_matches_owner();
