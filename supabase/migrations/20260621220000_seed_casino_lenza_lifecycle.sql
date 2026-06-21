-- STRESS TEST · ciclo completo Casino Lenza: per ogni matrimonio gia' seedato (notes='lenza-demo')
-- popola TUTTI gli snodi commerciali/operativi:
--   · preventivo ACCETTATO/CONVERTITO con total_client (→ Bilancio si popola) collegato all'evento
--   · contratto FIRMATO (best-effort: avvolto in blocco eccezione per i trigger sul firmato)
--   · turni: supplier_team_events + assegnazioni staff + runsheet
--   · magazzino/packing con ROTAZIONE (stessi item su ogni evento)
-- + team interno (membri). Idempotente (marker notes='lenza-demo' sui team members).
do $life$
declare
  v_loc uuid; r record; m record; v_i int := 0; v_q uuid; v_tev uuid;
  v_cost numeric; v_signed date;
begin
  select id into v_loc from auth.users where lower(email)=lower('giovanni.scozzafava+lenza@gmail.com');
  if v_loc is null then raise notice 'Casino Lenza non trovato'; return; end if;

  if exists (select 1 from public.supplier_team_members where supplier_id=v_loc and notes='lenza-demo') then
    raise notice 'Casino Lenza lifecycle: gia seedato'; return;
  end if;

  -- TEAM interno
  insert into public.supplier_team_members(supplier_id, full_name, role_label, phone, active, notes) values
    (v_loc,'Antonio Lenza','Responsabile location','+39 333 1110001',true,'lenza-demo'),
    (v_loc,'Maria Greco','Accoglienza / Hostess','+39 333 1110002',true,'lenza-demo'),
    (v_loc,'Pino Rizzo','Tecnico audio-luci','+39 333 1110003',true,'lenza-demo'),
    (v_loc,'Saverio Costa','Allestimento / Manutenzione','+39 333 1110004',true,'lenza-demo'),
    (v_loc,'Rocco Bruno','Sicurezza','+39 333 1110005',true,'lenza-demo'),
    (v_loc,'Mimmo Gallo','Parcheggiatore','+39 333 1110006',true,'lenza-demo');

  for r in
    select ce.id, ce.title, ce.date_from, ce.event_kind, p.value_amount, p.client_name
    from public.calendar_entries ce join public.calendar_entries_private p on p.entry_id=ce.id
    where ce.owner_id=v_loc and p.notes='lenza-demo'
    order by ce.date_from
  loop
    v_i := v_i + 1;
    v_cost := round(r.value_amount * 0.55, 2);
    v_signed := r.date_from - 30;

    -- PREVENTIVO (3 convertiti in contratto, 1 solo accettato → testa anche "accettato senza contratto")
    insert into public.quotes(owner_id, title, client_name, client_email, status, event_kind, event_date,
                              guest_count, total_client, subtotal_client, total_cost, margin_amount, sent_at, accepted_at)
      values (v_loc, 'Ricevimento '||r.client_name, r.client_name, 'cliente'||v_i||'@example.com',
              (case when v_i <= 3 then 'CONVERTITO_IN_CONTRATTO' else 'ACCETTATO' end)::quote_status,
              r.event_kind, r.date_from,
              (select count(*) from public.event_guests g where g.entry_id=r.id),
              r.value_amount, r.value_amount, v_cost, r.value_amount - v_cost,
              (r.date_from - 60)::timestamptz, (r.date_from - 45)::timestamptz)
      returning id into v_q;
    update public.calendar_entries set quote_id = v_q where id = r.id;

    -- CONTRATTO firmato (best-effort: trigger sul FIRMATO non devono bloccare il seed)
    if v_i <= 3 then
      begin
        insert into public.contracts(owner_id, quote_id, entry_id, title, client_name, total_amount,
                                     status, signed_at, event_date, event_kind)
          values (v_loc, v_q, r.id, 'Contratto '||r.client_name, r.client_name, r.value_amount,
                  'FIRMATO', v_signed::timestamptz, r.date_from, r.event_kind);
      exception when others then raise notice 'contratto saltato per % (%)', r.client_name, sqlerrm;
      end;
    end if;

    -- TURNI: evento team + assegnazioni + runsheet
    insert into public.supplier_team_events(supplier_id, title, event_date, call_time, location, entry_id, quote_id, notes)
      values (v_loc, 'Servizio · '||r.client_name, r.date_from, '15:00 ritrovo staff',
              'Casino Lenza · Lamezia Terme (CZ)', r.id, v_q, 'lenza-demo')
      returning id into v_tev;
    for m in select id, role_label from public.supplier_team_members where supplier_id=v_loc and notes='lenza-demo' loop
      insert into public.supplier_team_assignments(event_id, member_id, supplier_id, presence, role_label)
        values (v_tev, m.id, v_loc, 'PRESENTE', m.role_label);
    end loop;
    insert into public.supplier_team_event_items(event_id, supplier_id, start_time, title, role_label, ord) values
      (v_tev, v_loc, '15:00','Allestimento sala e mise en place','Allestimento',1),
      (v_tev, v_loc, '17:30','Arrivo ospiti · accoglienza','Hostess',2),
      (v_tev, v_loc, '18:00','Aperitivo di benvenuto in giardino','Hostess',3),
      (v_tev, v_loc, '20:00','Servizio cena','Responsabile',4),
      (v_tev, v_loc, '23:30','Taglio torta e open bar','Responsabile',5),
      (v_tev, v_loc, '01:30','Riordino e riconsegna sala','Allestimento',6);

    -- MAGAZZINO / PACKING (rotazione: gli STESSI item escono per ogni evento e rientrano)
    insert into public.supplier_team_event_packing(event_id, supplier_id, name, category, qty, checked, ord) values
      (v_tev, v_loc, 'Sedie Chiavari', 'Allestimento', 160, false, 1),
      (v_tev, v_loc, 'Tavoli rotondi Ø180', 'Allestimento', 18, false, 2),
      (v_tev, v_loc, 'Tovagliato avorio', 'Allestimento', 20, false, 3),
      (v_tev, v_loc, 'Calici e bicchieri', 'Mise en place', 600, false, 4),
      (v_tev, v_loc, 'Piatti porcellana', 'Mise en place', 540, false, 5),
      (v_tev, v_loc, 'Gazebo 6x6 giardino', 'Strutture', 2, false, 6),
      (v_tev, v_loc, 'Banco bar mobile', 'Strutture', 1, false, 7),
      (v_tev, v_loc, 'Generatore + frigo service', 'Tecnico', 1, false, 8);
  end loop;

  raise notice 'Casino Lenza lifecycle: % eventi completati (preventivi/contratti/turni/magazzino)', v_i;
end$life$;
