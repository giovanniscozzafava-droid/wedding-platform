-- Il vincolo su `source` non conosceva la nuova sorgente CONTRACT_PAYMENT:
-- la sync appena corretta (20260908100000) cadeva sul CHECK. Trovato
-- ri-eseguendo lo scenario Baronella subito dopo il fix.
alter table public.prima_nota_entries drop constraint if exists prima_nota_entries_source_check;
alter table public.prima_nota_entries
  add constraint prima_nota_entries_source_check
  check (source = any (array['MANUAL'::text, 'QUOTE_ITEM'::text, 'FB_PO'::text, 'CONTRACT_PAYMENT'::text]));
