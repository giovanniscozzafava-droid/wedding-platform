-- ============================================================================
-- Decisione di Giovanni (06/09/2026, dopo il quarto giro di stress test):
-- dei 28 contratti FIRMATO trovati senza rate (trigger tg_contract_payments_
-- on_insert esiste solo dal 01/09, mai un backfill per i contratti firmati
-- prima), genera le rate SOLO sui 10 confermati come clienti reali (Rosella
-- Elia, Antonio Mancuso, Giangianni Flowers — €25.660 di esposizione reale).
-- Gli altri 18 (7 seed/demo dichiarati + 11 su account dai timestamp sospetti,
-- mai chiariti) restano intoccati.
--
-- Stessa aritmetica di tg_contract_payments_on_insert/contract_payments_sync
-- (Art. 2.2: acconto+seconda rata+saldo, dal piano per-professionista, saldo
-- = resto per non avere derive di arrotondamento). ON CONFLICT DO NOTHING:
-- se una qualunque di queste righe esistesse già, non la tocca.
-- ============================================================================

do $$
declare
  v_ids uuid[] := array[
    '73739dc6-e4af-4fab-bb2e-9d6a4e56963e',  -- Rosella Elia · Francesco Mezzacapa · 4500€
    'fa624a35-b7de-4a72-a5f9-41d775b12071',  -- Rosella Elia · Renzo e Lucia · 16800€
    '955e7b2b-dbd6-4b5d-aa59-1a3c6400f262',  -- Rosella Elia · Gennaro Ruoppolo · 1200€
    'a65ba999-dbb9-4c73-b6a4-5b613729b455',  -- Rosella Elia · Rino Rinello · 0€
    '8484cf75-c98b-4a6d-86e8-2dad4eb461f9',  -- Rosella Elia · Giulia Belpanno · 1200€
    '819d296c-5fae-40d0-bcf2-803d92c19cd6',  -- Giangianni Flowers · Giovanni Scozzafava · 0€
    '22c15915-0d3c-41da-9019-b499f86d0e73',  -- Antonio Mancuso · Benedetta Signorelli · 680€
    'f6e24ada-1154-48e4-8748-b4ccadb4cd95',  -- Antonio Mancuso · Egle · 350€
    '50f90f68-adeb-470d-993f-9cf7169c1746',  -- Antonio Mancuso · Elisa e Amedeo · 650€
    'cc7181b9-42ed-48c0-bab4-fcc4847263e9'   -- Antonio Mancuso · Angela · 280€
  ];
  v_c record; v_dep numeric; v_sec numeric; v_r1 numeric; v_r2 numeric; v_n int := 0;
begin
  for v_c in select * from public.contracts where id = any(v_ids) and status = 'FIRMATO' loop
    select coalesce(p.pay_deposit_pct,30), coalesce(p.pay_second_pct,50)
      into v_dep, v_sec from public.profiles p where p.id = v_c.owner_id;
    v_r1 := round(coalesce(v_c.total_amount,0) * v_dep / 100.0, 2);
    v_r2 := round(coalesce(v_c.total_amount,0) * v_sec / 100.0, 2);

    insert into public.contract_payments (contract_id, owner_id, seq, label, percent, amount, due_hint, due_date)
    values
      (v_c.id, v_c.owner_id, 1, 'Acconto alla firma', v_dep, v_r1,
       'alla sottoscrizione del contratto', v_c.signed_at::date),
      (v_c.id, v_c.owner_id, 2, 'Seconda rata', v_sec, v_r2,
       'entro 60 giorni prima dell''Evento', case when v_c.event_date is not null then v_c.event_date - 60 end),
      (v_c.id, v_c.owner_id, 3, 'Saldo', 100 - v_dep - v_sec,
       round(coalesce(v_c.total_amount,0) - v_r1 - v_r2, 2),
       'entro 7 giorni prima dell''Evento', case when v_c.event_date is not null then v_c.event_date - 7 end)
    on conflict (contract_id, seq) do nothing;
    v_n := v_n + 1;
  end loop;
  raise notice 'Backfill rate: % contratti reali confermati processati', v_n;
end$$;
