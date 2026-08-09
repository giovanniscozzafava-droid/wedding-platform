-- ============================================================================
-- #5 (decisione Giovanni): "i contratti vanno sempre salvati. Crea però una voce
-- 'test' — anche il contratto in test può essere cancellato."
--
-- Prima: contracts.owner_id ON DELETE CASCADE -> cancellando un profilo sparivano
-- anche i contratti FIRMATI (e nessuna guardia sul delete diretto).
-- Ora: flag is_test su contratti/preventivi/eventi ("test tutto"), e una guardia
-- BEFORE DELETE che BLOCCA la cancellazione di un contratto FIRMATO reale
-- (is_test=false) — anche via cascade dalla cancellazione del profilo. I contratti
-- FIRMATI di test (is_test=true) restano cancellabili, così i dati di prova si
-- possono ripulire.
-- ============================================================================

alter table public.contracts        add column if not exists is_test boolean not null default false;
alter table public.quotes           add column if not exists is_test boolean not null default false;
alter table public.calendar_entries add column if not exists is_test boolean not null default false;

comment on column public.contracts.is_test is
  'Dato di TEST: un contratto is_test=true è cancellabile anche se FIRMATO. I contratti reali firmati sono protetti dalla cancellazione.';

create or replace function public._block_delete_signed_contract()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Un contratto FIRMATO reale non si cancella (né direttamente né per cascade
  -- dalla rimozione del profilo): i contratti vanno sempre conservati.
  if old.status = 'FIRMATO' and not coalesce(old.is_test, false) then
    raise exception 'Contratto firmato: non è cancellabile (va conservato). Solo i contratti di test possono essere rimossi.'
      using errcode = 'P0001';
  end if;
  return old;
end$$;

drop trigger if exists trg_block_delete_signed_contract on public.contracts;
create trigger trg_block_delete_signed_contract
  before delete on public.contracts
  for each row execute function public._block_delete_signed_contract();
