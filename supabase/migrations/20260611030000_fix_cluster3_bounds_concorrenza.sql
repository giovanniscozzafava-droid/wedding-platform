-- ============================================================================
-- CLUSTER 3 — "Limiti economici e concorrenza"
-- Chiude: BRK-D-01/02/03/04/06/14/17(mitigato)/18 · BRK-B-01/B-03.
-- (D-07/08/09/11/16 NON sono nella lista del piano per questo cluster → restano
--  aperti e annotati: vanno con un cluster successivo dedicato a date/validazione.)
-- ============================================================================

-- ── 1) Allinea i tipi al CHECK del markup (D-06): numeric(5,2) max 999.99 ma il
--       CHECK ammette 1000 → overflow. Allargo a numeric(6,2). ────────────────
alter table public.quote_items            drop constraint if exists qitems_markup_range;
alter table public.quote_supplier_markups drop constraint if exists qsupmarkup_range;

alter table public.quote_items            alter column item_markup_percent  type numeric(6,2);
alter table public.quote_supplier_markups alter column markup_percent       type numeric(6,2);
-- NB: quotes.default_markup_percent resta numeric(5,2): è usata da un trigger
-- (alter type bloccato) e non rientra nello scope D-06 (item/supplier markup).

-- ── 2) CHECK economici sani ────────────────────────────────────────────────
-- markup ≥ 0 (niente vendita sotto-costo per markup negativo, D-02) e ≤ 1000
alter table public.quote_items
  add constraint qitems_markup_range
  check (item_markup_percent is null or (item_markup_percent >= 0 and item_markup_percent <= 1000));
alter table public.quote_supplier_markups
  add constraint qsupmarkup_range
  check (markup_percent is null or (markup_percent >= 0 and markup_percent <= 1000));

-- sconto voce 0..100 (D-01: prima ammetteva -1000 → prezzo 11×)
alter table public.quote_items drop constraint if exists quote_items_item_discount_pct_chk;
alter table public.quote_items
  add constraint quote_items_item_discount_pct_chk
  check (item_discount_percent is null or (item_discount_percent >= 0 and item_discount_percent <= 100));

-- sconto totale 0..100 (D-04)
alter table public.quotes drop constraint if exists quotes_total_discount_pct_chk;
alter table public.quotes
  add constraint quotes_total_discount_pct_chk
  check (total_discount_percent is null or (total_discount_percent >= 0 and total_discount_percent <= 100));

-- ── 3) D-18: lo sconto totale NON azzera il costo REALE dei servizi propri ──
create or replace function public.quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_cost_raw numeric; v_subtotal numeric; v_own_client numeric; v_cost_third numeric;
  v_client numeric; v_cost numeric; v_pct numeric; v_amt numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0)
    into v_cost_raw, v_subtotal, v_own_client
    from quote_items where quote_id = p_quote_id;

  v_cost_third := v_cost_raw - v_own_client;   -- per i propri line_cost = line_client

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0)
    into v_pct, v_amt from quotes where id = p_quote_id;

  v_client := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_client < 0 then v_client := 0; end if;

  -- Il COSTO reale (terzi + propri) NON si riduce con lo sconto al cliente:
  -- se il WP sconta, assorbe lui la differenza → la perdita resta visibile.
  v_cost := round(v_cost_third + v_own_client, 2);

  update quotes
     set subtotal_client = v_subtotal,
         total_cost      = v_cost,
         total_client    = v_client,
         margin_amount   = v_client - v_cost,
         margin_percent  = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at      = now()
   where id = p_quote_id;
end$function$;

-- ── 4) D-03/D-14: una voce di TERZI non può finire sotto-costo (prezzo cliente
--       < costo fornitore). Blocco nel ricalcolo riga. ─────────────────────────
create or replace function public.quote_items_recalc_lines_v2()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_base numeric; v_mod jsonb; v_type text; v_value numeric; v_markup_pct numeric; v_include boolean;
begin
  v_base := coalesce(new.snapshot_price, 0) * coalesce(new.quantity, 0);
  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type := v_mod->>'type'; v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then v_base := v_base + v_value; end if;
    end loop;
  end if;
  v_include := not coalesce(new.is_optional, false) or coalesce(new.selected_by_client, false);
  if not v_include then v_base := 0; end if;
  new.line_cost := round(v_base, 2);

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_client := new.line_cost;
  else
    v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
    new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);
  end if;

  if coalesce(new.item_discount_percent, 0) <> 0 then
    new.line_client := round(new.line_client * (1 - new.item_discount_percent / 100.0), 2);
    if new.line_client < 0 then new.line_client := 0; end if;
  end if;

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_cost := new.line_client;
  else
    -- voce di terzi: il prezzo al cliente non può scendere sotto il costo fornitore
    if v_include and new.line_client < new.line_cost then
      raise exception 'item_below_cost'
        using hint = 'Voce di terzi sotto-costo: prezzo cliente ' || new.line_client || ' < costo ' || new.line_cost || '. Riduci lo sconto o alza il markup.';
    end if;
  end if;

  if coalesce(new.paid_amount, 0) > new.line_client then new.paid_amount := new.line_client; end if;
  if coalesce(new.paid_amount, 0) <= 0 then
    new.paid_amount := 0; new.payment_status := 'NON_PAGATO'; new.paid_at := null;
  end if;
  return new;
end$function$;

-- ── 5) B-01: niente doppia opzione attiva su date sovrapposte (stesso fornitore) ─
create extension if not exists btree_gist;
alter table public.supplier_date_options drop constraint if exists sdo_no_overlap_active;
alter table public.supplier_date_options
  add constraint sdo_no_overlap_active
  exclude using gist (
    supplier_id with =,
    daterange(date_from, coalesce(date_to, date_from), '[]') with &&
  ) where (status in ('OPTIONED','CONFIRMED'));

create or replace function public.opziona_data(p_date_from date, p_date_to date default null, p_days integer default 7, p_reason text default null, p_client_id uuid default null, p_lead_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_id uuid; d date;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if coalesce(p_date_to, p_date_from) < p_date_from then
    return jsonb_build_object('error','invalid_range');   -- D-07: range invertito
  end if;
  begin
    insert into public.supplier_date_options(supplier_id, supplier_client_id, supplier_lead_id, date_from, date_to, expires_at, reason)
    values (v_uid, p_client_id, p_lead_id, p_date_from, coalesce(p_date_to, p_date_from),
            now() + make_interval(days => greatest(1, coalesce(p_days,7))), p_reason)
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('error','date_already_optioned');   -- B-01: data già opzionata
  end;
  d := p_date_from;
  while d <= coalesce(p_date_to, p_date_from) loop
    insert into public.supplier_availability(fornitore_id, date, status, notes)
      values (v_uid, d, 'OPTIONED', coalesce(p_reason,'Data opzionata'))
    on conflict (fornitore_id, date) do update
      set status = case when supplier_availability.status = 'AVAILABLE' then 'OPTIONED'::supplier_avail_status
                        else supplier_availability.status end,
          notes = coalesce(excluded.notes, supplier_availability.notes);
    d := d + 1;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end$function$;

-- ── 6) B-03: optimistic lock su quotes (niente lost-update silenzioso) ──────
alter table public.quotes add column if not exists version integer not null default 0;

create or replace function public.tg_quotes_bump_version()
returns trigger language plpgsql as $function$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end$function$;

drop trigger if exists trg_quotes_bump_version on public.quotes;
create trigger trg_quotes_bump_version before update on public.quotes
  for each row execute function tg_quotes_bump_version();

-- salvataggio "a versione": fallisce se la riga è cambiata sotto (concorrenza/2 tab)
create or replace function public.quote_save_guarded(p_id uuid, p_expected_version integer, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_new integer;
begin
  if auth.uid() is null then return jsonb_build_object('error','unauthorized'); end if;
  update public.quotes set
    title                  = coalesce(p_patch->>'title', title),
    event_date             = coalesce((p_patch->>'event_date')::date, event_date),
    default_markup_percent = coalesce((p_patch->>'default_markup_percent')::numeric, default_markup_percent),
    total_discount_percent = coalesce((p_patch->>'total_discount_percent')::numeric, total_discount_percent),
    total_discount_amount  = coalesce((p_patch->>'total_discount_amount')::numeric, total_discount_amount)
  where id = p_id
    and (owner_id = auth.uid() or is_admin())
    and version = p_expected_version
  returning version into v_new;
  if v_new is null then
    return jsonb_build_object('error','stale_version', 'current_version', (select version from public.quotes where id = p_id));
  end if;
  return jsonb_build_object('ok', true, 'version', v_new);
end$function$;
grant execute on function public.quote_save_guarded(uuid, integer, jsonb) to authenticated;
