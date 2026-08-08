-- Reminder ai fornitori suggeriti: se dopo 48h dal suggerimento non hanno inviato il preventivo né
-- declinato ("non ci sono"), un promemoria via email (UNO solo). Flag di de-dup per non insistere.
alter table public.supplier_suggestions
  add column if not exists reminder_sent_at timestamptz;
