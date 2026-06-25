-- Ricorda quando il professionista ha collegato il feed al proprio calendario,
-- così la UI mostra "già collegato" invece del pulsante di collegamento.
alter table public.booking_settings add column if not exists feed_linked_at timestamptz;
