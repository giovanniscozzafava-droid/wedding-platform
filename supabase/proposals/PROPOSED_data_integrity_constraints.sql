-- ============================================================================
-- Hardening data-integrity (conservativo) — dallo stress-audit 2026-06-01.
-- ----------------------------------------------------------------------------
-- Aggiunge CHECK solo sui casi INEQUIVOCABILI (valori che non possono mai
-- essere legittimi: quantità/prezzi/conteggi negativi, range di date
-- invertiti). Tutti NOT VALID: non validano le righe esistenti (nessun
-- rischio di fallimento migration), ma vengono applicati a INSERT/UPDATE
-- futuri. Esclusi di proposito i casi "soft" (margine negativo = perdita,
-- importi budget negativi = note di credito, overpay) che potrebbero avere
-- usi legittimi.
-- Idempotente: ogni vincolo aggiunto solo se non già presente.
-- ============================================================================

do $$
declare
  v_sql text;
  v_checks text[][] := array[
    -- tabella, nome vincolo, espressione
    ['quotes',             'chk_quotes_guest_count_nonneg',   'guest_count is null or guest_count >= 0'],
    ['quotes',             'chk_quotes_table_count_nonneg',   'table_count is null or table_count >= 0'],
    ['quote_items',        'chk_qitems_qty_nonneg',           'quantity is null or quantity >= 0'],
    ['quote_items',        'chk_qitems_price_nonneg',         'snapshot_price is null or snapshot_price >= 0'],
    ['quote_items',        'chk_qitems_paid_nonneg',          'paid_amount is null or paid_amount >= 0'],
    ['event_tables',       'chk_tables_seats_nonneg',         'seats is null or seats >= 0'],
    ['event_tables',       'chk_tables_no_pos',               'table_no is null or table_no >= 1'],
    ['event_guests',       'chk_guests_party_pos',            'party_size is null or party_size >= 1'],
    ['event_subevents',    'chk_subev_capacity_nonneg',       'capacity is null or capacity >= 0'],
    ['event_subevents',    'chk_subev_duration_nonneg',       'duration_min is null or duration_min >= 0'],
    ['insurance_policies', 'chk_ins_premium_nonneg',          'premium is null or premium >= 0'],
    ['insurance_policies', 'chk_ins_dates',                   'start_date is null or end_date is null or end_date >= start_date'],
    ['calendar_entries',   'chk_ce_dates',                    'date_from is null or date_to is null or date_to >= date_from'],
    ['calendar_entries',   'chk_ce_honeymoon_dates',          'honeymoon_start is null or honeymoon_end is null or honeymoon_end >= honeymoon_start'],
    ['lead_requests',      'chk_lead_guests_nonneg',          'guests_estimate is null or guests_estimate >= 0']
  ];
  i int;
  v_tab text; v_name text; v_expr text;
begin
  for i in 1 .. array_length(v_checks, 1) loop
    v_tab := v_checks[i][1]; v_name := v_checks[i][2]; v_expr := v_checks[i][3];
    -- salta se la colonna referenziata non esiste o il vincolo c'è già
    if exists (select 1 from pg_constraint where conname = v_name) then
      continue;
    end if;
    begin
      v_sql := format('alter table public.%I add constraint %I check (%s) not valid', v_tab, v_name, v_expr);
      execute v_sql;
      raise notice 'OK %', v_name;
    exception when undefined_column then
      raise notice 'SKIP % (colonna assente)', v_name;
    when others then
      raise notice 'SKIP % (%)', v_name, sqlerrm;
    end;
  end loop;
end$$;
