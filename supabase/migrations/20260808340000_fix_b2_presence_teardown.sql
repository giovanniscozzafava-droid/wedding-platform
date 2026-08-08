-- FIX B2 (il fix di ieri era rotto due volte):
--  1) il trigger trg_supplier_presence_participant aveva `when (new.supplier_presence = 'SI')`,
--     quindi sul cambio SI→NO/FORSE NON scattava mai → il ramo teardown era codice morto e il
--     participant (accesso PII/lista invitati/piantina/chat) restava. Ricreiamo il trigger SENZA
--     il WHEN: scatta a ogni cambio di supplier_presence.
--  2) la sottoquery usava `join calendar_entries ce on ce.quote_id = q.quote_id` ma `quotes` non ha
--     colonna `quote_id` (solo `id`) → se il trigger fosse scattato avrebbe dato errore. Fix: `q.id`.
create or replace function public.on_supplier_presence_participant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sub text;
begin
  if new.supplier_id is null then return new; end if;
  select id into v_entry from calendar_entries where quote_id = new.quote_id limit 1;
  if v_entry is null then return new; end if;

  if new.supplier_presence = 'SI' then
    if not exists (select 1 from calendar_entry_participants where entry_id = v_entry and user_id = new.supplier_id) then
      select subrole::text into v_sub from profiles where id = new.supplier_id;
      insert into calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, new.supplier_id, coalesce(v_sub, 'fornitore'), true);
    end if;
  else
    -- Presenza NO/FORSE/null: se il fornitore non ha piu' alcuna voce con presenza 'SI' in un
    -- preventivo VIVO di questo evento, togli il suo accesso.
    if not exists (
      select 1
        from quote_items qi
        join quotes q on q.id = qi.quote_id
        join calendar_entries ce on ce.quote_id = q.id
       where ce.id = v_entry
         and qi.supplier_id = new.supplier_id
         and qi.supplier_presence = 'SI'
         and q.archived_at is null
         and q.status <> 'RIFIUTATO'
    ) then
      delete from calendar_entry_participants
       where entry_id = v_entry and user_id = new.supplier_id;
    end if;
  end if;
  return new;
end$$;

-- Ricrea il trigger SENZA il WHEN: deve scattare anche su SI→NO/FORSE (il teardown).
drop trigger if exists trg_supplier_presence_participant on public.quote_items;
create trigger trg_supplier_presence_participant
  after insert or update of supplier_presence on public.quote_items
  for each row execute function public.on_supplier_presence_participant();
