-- ============================================================================
-- REVISIONE A.2 — Permetti importo 0 in tutti i flussi (incarico/preventivo
-- gratuito, caso "Location capostipite che propone l'incarico senza fee").
--
-- Stato attuale dello schema (verificato file-by-file):
--   - quotes.total_cost / total_client : check >= 0           (20260526030000) OK
--   - quote_items.snapshot_price       : check >= 0           (20260521150000) OK
--   - quote_items.quantity (col-level) : check >  0           (20260521150000) BLOCCANTE
--   - quote_items.quantity (constraint qitems_quantity_range) : check >= 0
--                                                              (20260526020000) OK
--   - scadenzario_voci.importo_eur     : check >= 0           (20260530300000) OK
--   - services.base_price              : check >= 0           (20260521150000) OK
--   - service_modifiers.price          : check >= 0           (20260521150000) OK
--
-- Unico vincolo che blocca esattamente 0: la check inline sul column-level di
-- quote_items.quantity (`quantity > 0`). Questo vincolo "anonimo" puo` essere
-- rimosso solo recuperandone il conname da pg_constraint (Postgres gli da` un
-- nome auto-generato del tipo `quote_items_quantity_check`). Idempotente.
-- ============================================================================

-- 1. Rilassa quote_items.quantity > 0 -> >= 0 -------------------------------
--    Cerchiamo TUTTE le check con conname che inizia per 'quote_items_quantity'
--    e contenenti '>' (ma non '>=') sul column-level e le sostituiamo.
do $$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'quote_items'
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%quantity%'
       and pg_get_constraintdef(c.oid) ilike '%>%'
       and pg_get_constraintdef(c.oid) not ilike '%>=%'
  loop
    execute format('alter table public.quote_items drop constraint %I', r.conname);
  end loop;
end$$;

-- Ricrea la check column-level come "quantity >= 0" (nominata, cosi` non
-- riappare la versione anonima). Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'qitems_quantity_non_negative'
  ) then
    alter table public.quote_items
      add constraint qitems_quantity_non_negative
        check (quantity >= 0);
  end if;
end$$;

comment on constraint qitems_quantity_non_negative on public.quote_items is
  'REVISIONE A: ammette quantity = 0 per voci gratuite (incarico Location 0 EUR).';

-- 2. Documenta esplicitamente che total_client / total_cost = 0 sono validi --
comment on column public.quotes.total_client is
  'Totale lato cliente del preventivo/incarico (numeric(12,2), default 0). REVISIONE A: 0 e` valido ed esprime un "incarico gratuito" (es. Location che propone l''incarico senza fee al cliente). Vincolo defense-in-depth: quotes_totals_non_negative (>= 0).';

comment on column public.quotes.total_cost is
  'Totale costo (somma costi fornitori) del preventivo. 0 e` valido (incarico gratuito o tutti i fornitori a costo zero).';

comment on column public.quotes.margin_amount is
  'Margine assoluto: total_client - total_cost. Puo` essere negativo (sconto sotto-costo intenzionale) o 0 (incarico gratuito).';

-- 3. Documenta scadenzario --------------------------------------------------
comment on column public.scadenzario_voci.importo_eur is
  'Importo della voce in EUR (numeric(10,2)). 0 e` valido (voce promemoria gratuita o saldo gia` a zero). Vincolo: importo_eur >= 0.';
