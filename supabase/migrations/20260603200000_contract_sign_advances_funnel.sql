-- ============================================================================
-- Alla FIRMA del contratto (status → FIRMATO) il funnel deve avanzare:
--   * la calendar_entry collegata passa a CONFERMATA (era ferma a OPZIONATA per
--     sempre → busy-check, ICS e routing rubrica restavano "solo opzionato");
--   * il preventivo collegato passa a CONVERTITO_IN_CONTRATTO (difensivo: oggi
--     viene già marcato alla generazione, ma se quell'update fallisce il quote
--     resta bloccato in ACCETTATO).
-- Implementato come trigger su contracts: copre TUTTE le RPC di firma
-- (contract_sign_full, contract_sign_by_token, contract_sign_offline) in un colpo.
-- Coerente con gli altri trigger su FIRMATO (es. auto_block_availability_from_contract).
-- ----------------------------------------------------------------------------

create or replace function public.advance_funnel_on_contract_signed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Evento → CONFERMATA. L'entry è collegata via quote_id oppure entry_id.
  update public.calendar_entries ce
     set status = 'CONFERMATA', updated_at = now()
   where ce.status in ('IN_TRATTATIVA', 'OPZIONATA')
     and (
       (new.quote_id is not null and ce.quote_id = new.quote_id)
       or (new.entry_id is not null and ce.id = new.entry_id)
     );

  -- Preventivo → CONVERTITO_IN_CONTRATTO (solo se ancora ACCETTATO).
  if new.quote_id is not null then
    update public.quotes q
       set status = 'CONVERTITO_IN_CONTRATTO'
     where q.id = new.quote_id and q.status = 'ACCETTATO';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_advance_funnel_on_contract_signed on public.contracts;
create trigger trg_advance_funnel_on_contract_signed
  after update of status on public.contracts
  for each row
  when (new.status = 'FIRMATO' and old.status is distinct from 'FIRMATO')
  execute function public.advance_funnel_on_contract_signed();

-- Niente più N contratti-quadro (CLIENT_WP) sullo stesso preventivo.
-- (Verificato: nessun duplicato esistente in produzione.)
create unique index if not exists uq_contracts_quote_client_wp
  on public.contracts (quote_id)
  where quote_id is not null and party_kind = 'CLIENT_WP';

-- Backfill: eventi con contratto GIÀ firmato ma entry rimasta OPZIONATA/IN_TRATTATIVA.
update public.calendar_entries ce
   set status = 'CONFERMATA', updated_at = now()
 from public.contracts c
 where c.status = 'FIRMATO'
   and ce.status in ('IN_TRATTATIVA', 'OPZIONATA')
   and (
     (c.quote_id is not null and ce.quote_id = c.quote_id)
     or (c.entry_id is not null and ce.id = c.entry_id)
   );
