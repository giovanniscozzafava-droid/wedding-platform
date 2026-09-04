-- «Se il contratto dice 1000 diviso tre, fatturo quella parte — magari
-- riconciliando, perché potrebbe essere stata già emessa» (Giovanni, 04/09/2026).
--
-- Ripensamento rispetto a stamattina: la fattura non è UNA per contratto, è UNA
-- per RATA (contract_payments). Un contratto a saldo unico ha comunque una sola
-- rata (contract_payments_sync ne crea sempre almeno una): il modello per-rata
-- copre anche quel caso, non serve un percorso separato "fattura sul contratto".
-- Le colonne fic_invoice_* già su contracts restano (innocue, non usate: nessuna
-- fattura reale è mai stata emessa prima d'ora — collegamento OAuth non ancora
-- fatto), il flusso vero è questo.

alter table public.contract_payments
  add column if not exists fic_invoice_id         text,
  add column if not exists fic_invoice_number      text,
  add column if not exists fic_invoice_created_at  timestamptz;

comment on column public.contract_payments.fic_invoice_id is
  'Fattura Fatture in Cloud per QUESTA rata: creata da Planfully o riconciliata a mano (già emessa altrove).';
