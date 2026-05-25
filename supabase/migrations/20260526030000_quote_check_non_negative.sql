-- ============================================================================
-- Hardening: total_client/total_cost non negativi su quotes.
-- Wave 7 W-2 ha trovato che markup negativo + edit manuale potevano portare
-- total_client a valore negativo (es. -50€). CHECK constraint defense in depth.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotes_totals_non_negative') then
    alter table quotes
      add constraint quotes_totals_non_negative
        check (total_cost >= 0 and total_client >= 0);
  end if;
end$$;

-- margin_amount puo` essere negativo (sconto sotto-costo intenzionale del WP),
-- non lo vincoliamo per non bloccare flussi promozionali.

comment on constraint quotes_totals_non_negative on quotes is
  'Defense in depth: total_cost e total_client devono essere >= 0. margin_amount puo essere negativo (sconto sotto-costo).';
