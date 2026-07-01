-- REGOLA: quando il capostipite mette un fornitore in preventivo e il cliente ACCETTA la voce,
-- quel fornitore entra AUTOMATICAMENTE nel cerchio dell'evento (calendar_entry_participants).
-- Così non va aggiunto a mano (es. Stefano Severini, Daisy Lab si trovano già nel cerchio).

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
      insert into public.calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, new.supplier_id,
              coalesce((select subrole from public.profiles where id = new.supplier_id), 'fornitore'), false)
      on conflict (entry_id, user_id) do nothing;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_add_supplier_to_circle on public.quote_items;
create trigger trg_add_supplier_to_circle
  after insert or update of client_decision on public.quote_items
  for each row execute function public._add_supplier_to_circle_on_accept();

-- Backfill: fornitori già in voci ACCETTATE su preventivi accettati → nel cerchio adesso.
insert into public.calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
select ce.id, qi.supplier_id, coalesce(p.subrole, 'fornitore'), false
  from public.quote_items qi
  join public.quotes q on q.id = qi.quote_id
  join public.calendar_entries ce on ce.quote_id = q.id
  left join public.profiles p on p.id = qi.supplier_id
 where qi.supplier_id is not null
   and coalesce(qi.erogatore_e_capostipite, false) = false
   and qi.client_decision = 'ACCETTATO'
   and q.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
on conflict (entry_id, user_id) do nothing;
