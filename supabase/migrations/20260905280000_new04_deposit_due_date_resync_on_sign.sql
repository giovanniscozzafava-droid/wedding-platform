-- ============================================================================
-- NEW-04 (trovato dal collaudo dal vivo 05/09): la rata 1 "Acconto alla
-- firma" nasce con due_date calcolata da contracts.signed_at, ma al momento
-- della creazione del contratto (sempre BOZZA) signed_at è sempre NULL — e
-- nessun codice risincronizza dopo la firma. Risultato: la prima rata non ha
-- mai una scadenza visibile nello scadenzario. Fix: trigger AFTER UPDATE su
-- contracts, quando signed_at passa da null a valorizzato, aggiorna la
-- due_date della rata 1 SOLO se non incassata e SOLO se ancora null (non
-- sovrascrive una scadenza scelta a mano dal professionista).
-- Nessuna riga esistente da correggere: verificato che nessun contratto già
-- firmato ha oggi una rata 1 con due_date null (0 righe in questo stato).
-- ============================================================================

create or replace function tg_contract_payments_resync_deposit_due_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.signed_at is not null and old.signed_at is null then
    update contract_payments
       set due_date = new.signed_at::date, updated_at = now()
     where contract_id = new.id
       and seq = 1
       and paid = false
       and due_date is null;
  end if;
  return new;
end$$;

drop trigger if exists trg_contract_payments_resync_deposit_due_date on contracts;
create trigger trg_contract_payments_resync_deposit_due_date
  after update of signed_at on contracts
  for each row execute function tg_contract_payments_resync_deposit_due_date();
