-- ============================================================================
-- Immutabilità del contenuto di un contratto FIRMATO.
-- La policy di UPDATE (contracts_update_supplier_or_owner) non ha vincolo di
-- stato né WITH CHECK: l'owner poteva riscrivere sections/title/total_amount di
-- un contratto già FIRMATO via update diretto, mentre signature_data/hash
-- attestano il documento vecchio. L'immutabilità era garantita SOLO dalla UI.
-- Qui la spostiamo a livello DB (backstop, come i vincoli "FIRMATO terminale"
-- già esistenti). Esenti: privileged_write (RPC admin), is_admin(), is_test.
-- La controfirma (countersign_at/countersign_data) e gli aggiornamenti PDF NON
-- toccano sections/title/total_amount → restano permessi.
-- ============================================================================
create or replace function public.contracts_block_firmato_edit() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('sec.privileged_write', true), '') = 'on' then return new; end if;
  if coalesce(old.is_test, false) then return new; end if;
  begin
    if public.is_admin() then return new; end if;
  exception when others then null; -- is_admin non disponibile in qualche contesto → prosegui col controllo
  end;

  if old.status = 'FIRMATO'
     and (new.sections     is distinct from old.sections
       or new.title        is distinct from old.title
       or new.total_amount is distinct from old.total_amount) then
    raise exception 'CONTRACT_FIRMATO_IMMUTABLE: il contenuto di un contratto firmato non è modificabile'
      using errcode = 'check_violation',
            hint = 'Per modifiche sostanziali: annulla il contratto e generane uno nuovo.';
  end if;
  return new;
end$$;

drop trigger if exists trg_contracts_block_firmato_edit on public.contracts;
create trigger trg_contracts_block_firmato_edit
  before update on public.contracts
  for each row execute function public.contracts_block_firmato_edit();
