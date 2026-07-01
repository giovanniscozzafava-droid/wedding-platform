-- NUOVA REGOLA (01/07): un evento diventa "tale" (status CONFERMATA) già a PREVENTIVO
-- ACCETTATO/firmato — non serve più il contratto, che resta "un di più" per chi lo fa.
-- Prima: solo la firma del contratto (trigger advance_funnel_on_contract_signed) portava a
-- CONFERMATA; il preventivo accettato restava a OPZIONATA (fuori da "Eventi", busy-check/ICS spenti).
--
-- Trigger gemello su quotes → copre TUTTE le vie di accettazione in un colpo:
--   * quote_accept_by_token (link pubblico)
--   * edge quote-accept-sign (firma cliente)
--   * accettazione manuale del WP/Location (update diretto su quotes.status)
-- Il trigger contratto resta invariato: se l'entry è già CONFERMATA la sua WHERE non matcha (no-op).

create or replace function public.advance_funnel_on_quote_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.calendar_entries ce
     set status = 'CONFERMATA', updated_at = now()
   where ce.quote_id = new.id
     and ce.status in ('IN_TRATTATIVA', 'OPZIONATA');
  return new;
end;
$$;

drop trigger if exists trg_advance_funnel_on_quote_accepted on public.quotes;
create trigger trg_advance_funnel_on_quote_accepted
  after update of status on public.quotes
  for each row
  when (new.status = 'ACCETTATO' and old.status is distinct from 'ACCETTATO')
  execute function public.advance_funnel_on_quote_accepted();

-- Backfill: preventivi già ACCETTATO (o CONVERTITO_IN_CONTRATTO) la cui entry è rimasta
-- OPZIONATA/IN_TRATTATIVA → ora CONFERMATA (diventano eventi retroattivamente).
update public.calendar_entries ce
   set status = 'CONFERMATA', updated_at = now()
  from public.quotes q
 where q.id = ce.quote_id
   and q.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
   and ce.status in ('IN_TRATTATIVA', 'OPZIONATA');
