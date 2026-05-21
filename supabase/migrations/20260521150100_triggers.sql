-- ============================================================================
-- Wedding Platform — Functions e Trigger automatici
-- ============================================================================

-- 1. updated_at universale ----------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles','collaborations','service_categories','services',
      'service_modifiers','calendar_entries','quotes','quote_items',
      'quote_supplier_markups'
    ])
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s ' ||
      'for each row execute function set_updated_at();', t);
  end loop;
end$$;

-- 2. price_versions: snapshot iniziale + chiusura su update prezzo -----------
create or replace function services_after_insert_price()
returns trigger language plpgsql as $$
begin
  insert into price_versions (service_id, price, valid_from, valid_until)
  values (new.id, new.base_price, now(), null);
  return new;
end$$;

create trigger trg_services_init_price
  after insert on services
  for each row execute function services_after_insert_price();

create or replace function services_after_update_price()
returns trigger language plpgsql as $$
begin
  if new.base_price is distinct from old.base_price then
    update price_versions
       set valid_until = now()
     where service_id = new.id
       and valid_until is null;
    insert into price_versions (service_id, price, valid_from, valid_until)
    values (new.id, new.base_price, now(), null);
  end if;
  return new;
end$$;

create trigger trg_services_close_price
  after update of base_price on services
  for each row execute function services_after_update_price();

-- 3. Calcolo markup effettivo per voce preventivo ----------------------------
-- Ordine: item override -> supplier override (quote_supplier_markups) -> quote default.
create or replace function calcola_markup_effettivo(
  p_quote_id      uuid,
  p_supplier_id   uuid,
  p_item_markup   numeric
) returns numeric
language plpgsql stable as $$
declare
  v_supplier_markup numeric;
  v_quote_default   numeric;
begin
  if p_item_markup is not null then
    return p_item_markup;
  end if;

  if p_supplier_id is not null then
    select markup_percent into v_supplier_markup
      from quote_supplier_markups
     where quote_id = p_quote_id
       and supplier_id = p_supplier_id;
    if v_supplier_markup is not null then
      return v_supplier_markup;
    end if;
  end if;

  select coalesce(default_markup_percent, 0) into v_quote_default
    from quotes where id = p_quote_id;
  return coalesce(v_quote_default, 0);
end$$;

-- 4. Calcolo line_cost e line_client per ogni quote_item ---------------------
-- Cost = snapshot_price * qty con modifiers applicati in ordine.
-- Modifiers JSON shape: [{ "type":"PERCENT|FIXED", "value": <n> }, ...]
create or replace function quote_items_recalc_lines()
returns trigger language plpgsql as $$
declare
  v_base       numeric;
  v_mod        jsonb;
  v_type       text;
  v_value      numeric;
  v_markup_pct numeric;
begin
  v_base := coalesce(new.snapshot_price,0) * coalesce(new.quantity,0);

  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type  := v_mod->>'type';
      v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then
        v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then
        v_base := v_base + v_value;
      end if;
    end loop;
  end if;

  new.line_cost := round(v_base, 2);

  v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
  new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);

  return new;
end$$;

create trigger trg_qitems_recalc_lines
  before insert or update on quote_items
  for each row execute function quote_items_recalc_lines();

-- 5. Ricalcolo totali quote dopo qualsiasi cambio voci -----------------------
create or replace function quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql as $$
declare
  v_cost   numeric;
  v_client numeric;
begin
  select coalesce(sum(line_cost),0), coalesce(sum(line_client),0)
    into v_cost, v_client
    from quote_items where quote_id = p_quote_id;

  update quotes
     set total_cost     = v_cost,
         total_client   = v_client,
         margin_amount  = v_client - v_cost,
         margin_percent = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2)
                                else 0 end,
         updated_at     = now()
   where id = p_quote_id;
end$$;

create or replace function quote_items_after_change()
returns trigger language plpgsql as $$
declare v_quote uuid;
begin
  v_quote := coalesce(new.quote_id, old.quote_id);
  perform quotes_recalc_totals(v_quote);
  return coalesce(new, old);
end$$;

create trigger trg_qitems_totals_after
  after insert or update or delete on quote_items
  for each row execute function quote_items_after_change();

-- Anche quando cambia il markup-per-supplier o il default sul quote, ricalcola.
create or replace function quote_supplier_markup_after_change()
returns trigger language plpgsql as $$
declare v_quote uuid;
begin
  v_quote := coalesce(new.quote_id, old.quote_id);
  -- ritrigger lineare di tutti gli items del fornitore
  update quote_items
     set updated_at = now()
   where quote_id = v_quote
     and (supplier_id = coalesce(new.supplier_id, old.supplier_id));
  perform quotes_recalc_totals(v_quote);
  return coalesce(new, old);
end$$;

create trigger trg_qsm_after_change
  after insert or update or delete on quote_supplier_markups
  for each row execute function quote_supplier_markup_after_change();

create or replace function quotes_default_markup_after_update()
returns trigger language plpgsql as $$
begin
  if new.default_markup_percent is distinct from old.default_markup_percent then
    update quote_items set updated_at = now() where quote_id = new.id;
    perform quotes_recalc_totals(new.id);
  end if;
  return new;
end$$;

create trigger trg_quote_default_markup
  after update of default_markup_percent on quotes
  for each row execute function quotes_default_markup_after_update();

-- 6. Enforce limite 10 preventivi attivi per owner tier FREE -----------------
create or replace function enforce_free_quote_limit()
returns trigger language plpgsql as $$
declare
  v_tier   subscription_tier;
  v_count  int;
begin
  select subscription_tier into v_tier from profiles where id = new.owner_id;
  if v_tier = 'FREE' then
    select count(*) into v_count
      from quotes
     where owner_id = new.owner_id
       and status in ('BOZZA','INVIATO','ACCETTATO');
    if v_count >= 10 then
      raise exception
        'Hai raggiunto il limite di 10 preventivi attivi del piano FREE. Aggiorna a PREMIUM o archivia preventivi vecchi.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end$$;

create trigger trg_quotes_free_limit
  before insert on quotes
  for each row execute function enforce_free_quote_limit();

-- 7. View calendar_entries ridotta per participant ---------------------------
-- Esclude client_name/client_email, value_amount, notes (campi sensibili).
create or replace view calendar_entries_for_participants as
  select
    ce.id,
    ce.owner_id,
    ce.title,
    ce.date_from,
    ce.date_to,
    ce.status,
    ce.quote_id,
    ce.created_at,
    ce.updated_at
  from calendar_entries ce;

-- 8. Auto-create profile alla registrazione di auth.users -------------------
-- raw_user_meta_data deve contenere { role: 'WEDDING_PLANNER'|'LOCATION'|'FORNITORE', subrole?, full_name? }.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role     user_role;
  v_subrole  text;
  v_full     text;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  insert into public.profiles (id, role, subrole, full_name)
  values (new.id, v_role, v_subrole, v_full)
  on conflict (id) do nothing;
  return new;
end$$;

create trigger trg_auth_user_to_profile
  after insert on auth.users
  for each row execute function handle_new_auth_user();
