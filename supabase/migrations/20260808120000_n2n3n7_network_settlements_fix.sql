-- ============================================================================
-- N2/N3/N7 — Correzioni ai settlement di rete (feature dietro flag network_finance,
-- spenta in beta, ma è il core: la rendiamo corretta).
--
-- N2: _populate_network_settlements sommava TUTTE le voci del fornitore, incluse le
--     RIFIUTATO, mentre il contratto/atto usano solo le ACCETTATO (R1). → filtro
--     client_decision='ACCETTATO'.
-- N3: i settlement erano popolati SOLO alla transizione →ACCETTATO. Nessun teardown
--     su →RIFIUTATO (conti fantasma dopo annulla_evento) e nessun ricalcolo quando le
--     voci cambiano su un preventivo già accettato (fornitore aggiunto/rimosso, voce
--     accettata/rifiutata nel preventivo vivo). → teardown + ricalcolo + rimozione
--     conti orfani.
-- N7: _populate_network_settlements (SECURITY DEFINER) era eseguibile da chiunque. →
--     revoke from public/anon/authenticated (gira solo dai trigger).
-- ============================================================================

-- ── N2 + N7 + rimozione orfani: popolamento idempotente e auto-pulente. ──
create or replace function public._populate_network_settlements(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mode text; v_entry uuid;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return; end if;
  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from public.profiles where id = v_owner;
  select id into v_entry from public.calendar_entries where quote_id = p_quote_id limit 1;

  insert into public.network_settlements (quote_id, entry_id, capostipite_id, supplier_id, direction, amount_due)
  select p_quote_id, v_entry, v_owner, t.supplier_id, t.direction, t.amount
  from (
    select qi.supplier_id,
           case when v_mode = 'ITEMIZED' then 'SUPPLIER_OWES_CAPOSTIPITE' else 'CAPOSTIPITE_OWES_SUPPLIER' end as direction,
           -- BUNDLE: il capostipite deve il COSTO; ITEMIZED: il fornitore deve il MARGINE.
           case when v_mode = 'ITEMIZED' then round(sum(qi.line_client - qi.line_cost), 2)
                else round(sum(qi.line_cost), 2) end as amount
      from public.quote_items qi
     where qi.quote_id = p_quote_id
       and qi.supplier_id is not null
       and qi.supplier_id <> v_owner                            -- non con te stesso
       and coalesce(qi.erogatore_e_capostipite, false) = false  -- non i servizi propri
       and qi.client_decision = 'ACCETTATO'                     -- N2: solo voci VENDUTE
     group by qi.supplier_id
  ) t
  where t.amount > 0
  on conflict (quote_id, supplier_id) do update
    set amount_due = excluded.amount_due,
        direction  = excluded.direction,
        status     = case when public.network_settlements.amount_paid >= excluded.amount_due then 'SALDATO'
                          when public.network_settlements.amount_paid > 0 then 'PARZIALE'
                          else 'MATURATO' end,
        updated_at = now();

  -- N3: rimuovi i conti orfani — fornitore non più tra le voci accettate — MA
  -- conserva quelli con un pagamento già registrato (traccia di denaro reale mosso).
  delete from public.network_settlements ns
   where ns.quote_id = p_quote_id
     and ns.amount_paid = 0
     and ns.supplier_id not in (
       select qi.supplier_id from public.quote_items qi
        where qi.quote_id = p_quote_id and qi.supplier_id is not null
          and qi.supplier_id <> v_owner
          and coalesce(qi.erogatore_e_capostipite, false) = false
          and qi.client_decision = 'ACCETTATO'
     );
end$$;
revoke all on function public._populate_network_settlements(uuid) from public, anon, authenticated;  -- N7

-- ── N3: teardown su preventivo non più vivo (RIFIUTATO). Conserva le righe già
--        (parzialmente) pagate come storico; azzera solo il residuo dovuto. ──
create or replace function public._teardown_network_settlements(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.network_settlements
   where quote_id = p_quote_id and amount_paid = 0;
  -- righe con pagamenti: il residuo non è più dovuto (evento annullato), status SALDATO.
  update public.network_settlements
     set amount_due = amount_paid, status = 'SALDATO', updated_at = now()
   where quote_id = p_quote_id and amount_paid > 0;
end$$;
revoke all on function public._teardown_network_settlements(uuid) from public, anon, authenticated;

-- ── N3: trigger su stato preventivo — popola su ACCETTATO/CONVERTITO, smonta su RIFIUTATO. ──
create or replace function public._tg_network_settlements_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')
     and coalesce(old.status::text,'') is distinct from new.status::text then
    perform public._populate_network_settlements(new.id);
  elsif new.status = 'RIFIUTATO' and coalesce(old.status::text,'') <> 'RIFIUTATO' then
    perform public._teardown_network_settlements(new.id);
  end if;
  return new;
end$$;

drop trigger if exists trg_network_settlements_on_accept on public.quotes;
drop trigger if exists trg_network_settlements_on_status on public.quotes;
create trigger trg_network_settlements_on_status
  after update of status on public.quotes
  for each row execute function public._tg_network_settlements_on_status();

-- ── N3: trigger su voci — ricalcola i settlement quando cambiano le voci di un
--        preventivo GIÀ accettato (fornitore aggiunto/rimosso, voce accettata/rifiutata). ──
create or replace function public._tg_network_settlements_on_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qid uuid; v_status text;
begin
  v_qid := coalesce(new.quote_id, old.quote_id);
  if v_qid is null then return coalesce(new, old); end if;
  select status::text into v_status from public.quotes where id = v_qid;
  if v_status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
    perform public._populate_network_settlements(v_qid);
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists trg_network_settlements_on_items on public.quote_items;
create trigger trg_network_settlements_on_items
  after insert or update or delete on public.quote_items
  for each row execute function public._tg_network_settlements_on_items();
