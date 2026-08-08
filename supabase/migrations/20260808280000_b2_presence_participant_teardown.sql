-- ============================================================================
-- B2: on_supplier_presence_participant aggiungeva il participant (accesso PII/lista
-- invitati) quando il fornitore dichiarava presenza='SI', ma NON lo rimuoveva al
-- ritorno a NO/FORSE. Un fornitore marcato-poi-smarcato manteneva l'accesso finché
-- il preventivo restava vivo. Fix: se dopo il cambio il fornitore non ha PIÙ alcuna
-- voce con presenza='SI' in quell'evento, rimuoviamo il suo participant (direzione
-- fail-safe: al più toglie accesso, mai lo espande).
-- ============================================================================

create or replace function public.on_supplier_presence_participant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sub text;
begin
  if new.supplier_id is null then return new; end if;
  select id into v_entry from calendar_entries where quote_id = new.quote_id limit 1;
  if v_entry is null then return new; end if;

  if new.supplier_presence = 'SI' then
    -- Aggiungi il participant (idempotente).
    if not exists (select 1 from calendar_entry_participants where entry_id = v_entry and user_id = new.supplier_id) then
      select subrole::text into v_sub from profiles where id = new.supplier_id;
      insert into calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, new.supplier_id, coalesce(v_sub, 'fornitore'), true);
    end if;
  else
    -- Presenza NO/FORSE/null: se il fornitore non ha più alcuna voce con presenza
    -- 'SI' in un preventivo vivo di questo evento, togli il suo accesso.
    if not exists (
      select 1
        from quote_items qi
        join quotes q on q.id = qi.quote_id
        join calendar_entries ce on ce.quote_id = q.quote_id
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
