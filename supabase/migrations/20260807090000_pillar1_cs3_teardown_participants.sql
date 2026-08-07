-- ════════════════════════════════════════════════════════════════════════════
-- PILASTRO 1 — CONSENSO FORNITORE, increment 3-bis: COMPLETA il teardown CS-3.
--
-- Il fix precedente (20260807080000) gattava SOLO il ramo (b) di
-- is_collab_supplier_of_entry. Ma le letture più sensibili — lista invitati (PII),
-- piantina, mood/playlist — sono gattate in OR con is_entry_participant (ramo a),
-- che il fix non toccava. E la riga calendar_entry_participants(role='fornitore'),
-- creata da quote-send all'INVIO (e da supplier_to_circle_on_accept), NON viene mai
-- rimossa da annulla_evento / rifiuto cliente / rimozione voce. Risultato: dopo un
-- evento annullato o un preventivo rifiutato, il fornitore continuava a leggere la
-- lista invitati/piantina via il ramo (a). (Trovato dallo stress test — il teardown
-- era chiuso su (b) ma aperto su (a).)
--
-- Fix: smontare la riga participant del fornitore quando il suo impegno muore.
-- Filtro robusto INDIPENDENTE DAL RUOLO: rimuoviamo solo le righe di chi ERA un
-- fornitore-via-preventivo su quell'evento MA non ha più una voce VIVA (preventivo
-- non RIFIUTATO e non archiviato). Coppie/planner/location non hanno voci di
-- preventivo → mai toccati. Le righe si ricreano da sole al prossimo quote-send.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._teardown_dead_supplier_participants(p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.calendar_entry_participants p
   where p.entry_id = p_entry
     -- era un fornitore-via-preventivo su questo evento (aveva/ha una voce):
     and exists (
       select 1
         from public.calendar_entries ce
         join public.quote_items qi on qi.quote_id = ce.quote_id
        where ce.id = p_entry
          and qi.supplier_id = p.user_id
     )
     -- ...ma NON ha più una voce in un preventivo VIVO:
     and not exists (
       select 1
         from public.calendar_entries ce
         join public.quotes q on q.id = ce.quote_id
         join public.quote_items qi on qi.quote_id = ce.quote_id
        where ce.id = p_entry
          and qi.supplier_id = p.user_id
          and q.status <> 'RIFIUTATO'
          and q.archived_at is null
     );
end$$;

-- Trigger 1: preventivo → RIFIUTATO (rifiuto cliente o annulla_evento che porta a RIFIUTATO).
create or replace function public._tg_teardown_supplier_participants_on_quote_dead()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  if new.status = 'RIFIUTATO' and coalesce(old.status::text, '') <> 'RIFIUTATO' then
    select id into v_entry from public.calendar_entries where quote_id = new.id limit 1;
    if v_entry is not null then
      perform public._teardown_dead_supplier_participants(v_entry);
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_teardown_supplier_on_quote_dead on public.quotes;
create trigger trg_teardown_supplier_on_quote_dead
  after update of status on public.quotes
  for each row execute function public._tg_teardown_supplier_participants_on_quote_dead();

-- Trigger 2: rimozione di una voce fornitore (il capostipite lo toglie dal preventivo).
create or replace function public._tg_teardown_supplier_participants_on_item_del()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  if old.supplier_id is not null then
    select id into v_entry from public.calendar_entries where quote_id = old.quote_id limit 1;
    if v_entry is not null then
      perform public._teardown_dead_supplier_participants(v_entry);
    end if;
  end if;
  return old;
end$$;

drop trigger if exists trg_teardown_supplier_on_item_del on public.quote_items;
create trigger trg_teardown_supplier_on_item_del
  after delete on public.quote_items
  for each row execute function public._tg_teardown_supplier_participants_on_item_del();
