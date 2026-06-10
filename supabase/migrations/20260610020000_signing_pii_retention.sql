-- ============================================================================
-- Minimizzazione PII di firma (quote_acceptances.doc_number / doc_issued_by)
-- ----------------------------------------------------------------------------
-- CONTESTO (deciso dopo aver tracciato il codice):
--   La cifratura app-level del numero documento è stata SCARTATA: doc_number è
--   riusato DB-side per il prefill di contratto/addendum
--   (contract_prefill_from_acceptance, addendum_on_close, contract_countersign)
--   e finisce in chiaro anche in contracts.signature_data. Cifrare una sola
--   copia sarebbe teatro; cifrarle tutte richiede un refactor della pipeline di
--   firma (il DB non potrebbe più decifrare per il prefill). La tabella è già
--   protetta: anon revocato, authenticated solo SELECT via RLS owner+admin
--   (qa_select_owner), + disk-encryption Supabase a riposo + URL firmati brevi.
--   Il residuo è la RITENZIONE perenne del numero: lo chiudiamo qui.
--
-- COSA FA:
--   1) doc_last4 — per mostrare le ultime 4 cifre nei log/UI senza il numero pieno.
--   2) purge_old_signing_pii() — azzera doc_number/doc_issued_by quando il dato
--      non serve più (default 24 mesi: copre eventuali contestazioni). Il prefill
--      avviene entro giorni dalla firma, non a mesi → azzerare i vecchi non rompe
--      nulla. Scrubba anche il numero dal jsonb dei contratti firmati da oltre N mesi.
--   3) schedule mensile via pg_cron.
-- ============================================================================

-- 1) doc_last4 (additivo) + backfill
alter table public.quote_acceptances
  add column if not exists doc_last4 text;

update public.quote_acceptances
   set doc_last4 = right(regexp_replace(doc_number, '\s', '', 'g'), 4)
 where doc_number is not null and doc_last4 is null;

-- per poter azzerare il numero sui record vecchi (l'app valida la presenza in
-- fase di firma, lato Edge Function: il NOT NULL DB non aggiunge garanzie).
alter table public.quote_acceptances
  alter column doc_number drop not null;

-- doc_last4 derivato automaticamente da doc_number ad ogni insert/update.
-- Guardia: quando il purge azzera doc_number (NEW.doc_number IS NULL) NON
-- sovrascrive last4 → le ultime 4 cifre restano nei log anche dopo il purge.
create or replace function public.tg_set_doc_last4()
returns trigger language plpgsql as $$
begin
  if new.doc_number is not null then
    new.doc_last4 := right(regexp_replace(new.doc_number, '\s', '', 'g'), 4);
  end if;
  return new;
end;
$$;

drop trigger if exists set_doc_last4 on public.quote_acceptances;
create trigger set_doc_last4
  before insert or update of doc_number on public.quote_acceptances
  for each row execute function public.tg_set_doc_last4();

-- 2) Funzione di purge (idempotente, ritorna il n. di righe azzerate)
create or replace function public.purge_old_signing_pii(p_months int default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update public.quote_acceptances
     set doc_number = null, doc_issued_by = null
   where doc_number is not null
     and created_at < now() - make_interval(months => p_months);
  get diagnostics v_n = row_count;

  -- scrub del numero documento dal jsonb dei contratti firmati da oltre N mesi
  update public.contracts
     set signature_data = signature_data - 'doc_number' - 'doc_issued_by'
   where signature_data ? 'doc_number'
     and coalesce(signed_at, created_at) < now() - make_interval(months => p_months);

  return v_n;
end;
$$;

revoke all on function public.purge_old_signing_pii(int) from public, anon, authenticated;

comment on function public.purge_old_signing_pii(int) is
  'Minimizzazione GDPR: azzera numero documento + doc_issued_by su quote_acceptances/contracts piu vecchi di N mesi (default 24). Schedulato via pg_cron.';

-- 3) Schedule mensile (1° del mese, 03:00 UTC). Idempotente.
do $sched$
begin
  if exists (select 1 from cron.job where jobname = 'purge-signing-pii') then
    perform cron.unschedule('purge-signing-pii');
  end if;
  perform cron.schedule('purge-signing-pii', '0 3 1 * *', 'select public.purge_old_signing_pii(24);');
exception when undefined_table or undefined_function then
  raise notice 'pg_cron non disponibile: schedulare purge_old_signing_pii() esternamente.';
end$sched$;
