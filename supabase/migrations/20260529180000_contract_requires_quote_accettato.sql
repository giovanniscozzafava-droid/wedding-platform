-- ============================================================================
-- Fase A — Chain enforcement: contratto CLIENT_WP richiede quote ACCETTATO
-- ============================================================================
-- Spec workflow lead → questionario → preventivo → contratto.
--
-- Regola: un contratto WP↔coppia (party_kind='CLIENT_WP') non puo' essere
-- creato senza un preventivo firmato/accettato dalla coppia. Il contratto NON
-- e' "forzabile" (a differenza del preventivo).
--
-- Eccezioni: SUPPLIER_WP (mini-contratto WP↔fornitore) e SUPPLIER_CLIENT
-- (fornitore↔coppia, modello BROKER) NON sono soggetti al vincolo: hanno
-- semantica diversa, non c'e' un quote cliente preliminare.
-- ============================================================================

create or replace function public.contracts_enforce_quote_accettato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status quote_status;
begin
  -- Solo CLIENT_WP soggetto al vincolo
  if coalesce(new.party_kind::text, 'CLIENT_WP') <> 'CLIENT_WP' then
    return new;
  end if;

  -- ADMIN bypass (override emergenze)
  if exists (select 1 from public.profiles p
              where p.id = auth.uid() and p.role = 'ADMIN') then
    return new;
  end if;

  if new.quote_id is null then
    raise exception 'Contratto CLIENT_WP richiede un preventivo collegato (quote_id mancante).'
      using errcode = 'P0001', hint = 'Genera/collega prima il preventivo, falo firmare dalla coppia, poi crea il contratto.';
  end if;

  select status into v_status from public.quotes where id = new.quote_id;
  if v_status is null then
    raise exception 'Preventivo % non trovato.', new.quote_id
      using errcode = 'P0001';
  end if;

  if v_status not in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    raise exception 'Il preventivo collegato e'' in stato %, devi farlo firmare prima di creare il contratto.', v_status
      using errcode = 'P0001',
            hint = 'Fai firmare il preventivo dalla coppia (status ACCETTATO) prima di generare il contratto.';
  end if;

  return new;
end$$;

drop trigger if exists trg_contracts_enforce_quote on public.contracts;
create trigger trg_contracts_enforce_quote
  before insert on public.contracts
  for each row execute function public.contracts_enforce_quote_accettato();

comment on function public.contracts_enforce_quote_accettato() is
  'Fase A workflow: contratti CLIENT_WP non creabili senza preventivo ACCETTATO (o CONVERTITO_IN_CONTRATTO). ADMIN bypass. SUPPLIER_WP/SUPPLIER_CLIENT esenti.';
