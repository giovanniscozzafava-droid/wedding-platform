-- ============================================================================
-- HOTFIX: wedding_site_rsvp() inseriva una nuova riga in event_guests ogni
-- volta che lo stesso ospite (stessa email) inviava il form. Risultato:
-- duplicati con party_size cumulato errato.
--
-- Fix: ON CONFLICT su (entry_id, lower(email)) DO UPDATE.
-- + unique partial index per supportare l'ON CONFLICT con email non-null.
-- + RSVP submit con email vuota: tratta come INSERT senza idempotency
--   (compatibilità con ospiti senza email).
-- ============================================================================

-- 1. Pulizia duplicati storici: tieni la riga piu recente per (entry_id, lower(email))
with ranked as (
  select id, entry_id, lower(trim(email)) as e,
         row_number() over (partition by entry_id, lower(trim(email))
                            order by created_at desc, id desc) as rn
    from event_guests
   where email is not null and email <> ''
)
delete from event_guests g
 using ranked r
 where g.id = r.id
   and r.rn > 1;

-- 2. Unique partial index su (entry_id, lower(email)) where email non-null/non-empty
create unique index if not exists uq_event_guests_entry_email
  on event_guests(entry_id, lower(trim(email)))
  where email is not null and trim(email) <> '';

-- 3. RPC idempotente
create or replace function wedding_site_rsvp(
  p_slug text,
  p_full_name text,
  p_email text,
  p_rsvp text,
  p_party int,
  p_diet text,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry uuid;
  v_party int := coalesce(p_party, 1);
  v_notes text := coalesce('RSVP web ricevuto. ' || nullif(p_notes, ''), 'RSVP web ricevuto');
  v_email text := nullif(trim(p_email), '');
begin
  select id into v_entry
    from calendar_entries
   where wedding_website_slug = p_slug
     and wedding_website_published = true;
  if v_entry is null then return false; end if;

  if v_email is not null then
    -- Idempotente per (entry_id, lower(email))
    insert into event_guests (entry_id, full_name, email, party_size, rsvp, diet, notes)
    values (v_entry, p_full_name, v_email, v_party, p_rsvp::rsvp_status, p_diet, v_notes)
    on conflict (entry_id, lower(trim(email))) where email is not null and trim(email) <> ''
    do update
      set full_name = excluded.full_name,
          party_size = excluded.party_size,
          rsvp = excluded.rsvp,
          diet = excluded.diet,
          notes = excluded.notes;
  else
    -- Ospite senza email: insert plain (impossibile distinguere dup)
    insert into event_guests (entry_id, full_name, email, party_size, rsvp, diet, notes)
    values (v_entry, p_full_name, null, v_party, p_rsvp::rsvp_status, p_diet, v_notes);
  end if;
  return true;
end$$;
grant execute on function wedding_site_rsvp(text, text, text, text, int, text, text) to anon, authenticated;

comment on function wedding_site_rsvp(text, text, text, text, int, text, text) is
  'RSVP pubblico via slug. v2: idempotente per (entry_id, lower(email)) — submit ripetuti aggiornano la riga esistente invece di duplicare. Ospite senza email: insert plain.';
