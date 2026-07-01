-- REGOLA: quando il capostipite mette un fornitore in preventivo e il cliente ACCETTA la voce,
-- quel fornitore entra AUTOMATICAMENTE nel cerchio dell'evento (calendar_entry_participants).
-- Così non va aggiunto a mano (es. Stefano Severini, Daisy Lab si trovano già nel cerchio).
--
-- NB: su calendar_entry_participants esiste trg_entry_participant_block_busy che RAISE se il
-- fornitore è occupato in quella data. L'inserimento è quindi BEST-EFFORT: se il fornitore è
-- occupato salta, SENZA far fallire l'accettazione del cliente (né la migration/backfill).

create or replace function public._add_supplier_to_circle_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  if new.client_decision = 'ACCETTATO'
     and new.supplier_id is not null
     and coalesce(new.erogatore_e_capostipite, false) = false
     and (tg_op = 'INSERT' or old.client_decision is distinct from new.client_decision) then
    select id into v_entry from public.calendar_entries where quote_id = new.quote_id limit 1;
    if v_entry is not null then
      begin
        insert into public.calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
        values (v_entry, new.supplier_id,
                coalesce((select subrole from public.profiles where id = new.supplier_id), 'fornitore'), false)
        on conflict (entry_id, user_id) do nothing;
      exception when others then
        null; -- es. AVAILABILITY_CONFLICT (fornitore occupato): non blocca l'accettazione del cliente
      end;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_add_supplier_to_circle on public.quote_items;
create trigger trg_add_supplier_to_circle
  after insert or update of client_decision on public.quote_items
  for each row execute function public._add_supplier_to_circle_on_accept();

-- Backfill: fornitori già in voci ACCETTATE su preventivi accettati → nel cerchio adesso.
-- Loop per-riga con exception: i fornitori occupati sulla data vengono saltati, non abortiscono tutto.
do $$
declare r record;
begin
  for r in
    select distinct ce.id as entry_id, qi.supplier_id, coalesce(p.subrole, 'fornitore') as role
      from public.quote_items qi
      join public.quotes q on q.id = qi.quote_id
      join public.calendar_entries ce on ce.quote_id = q.id
      left join public.profiles p on p.id = qi.supplier_id
     where qi.supplier_id is not null
       and coalesce(qi.erogatore_e_capostipite, false) = false
       and qi.client_decision = 'ACCETTATO'
       and q.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
  loop
    begin
      insert into public.calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
      values (r.entry_id, r.supplier_id, r.role, false)
      on conflict (entry_id, user_id) do nothing;
    exception when others then
      null; -- fornitore occupato sulla data: saltato
    end;
  end loop;
end $$;
