-- TRACCIA le aperture del cliente anche dalla DASHBOARD COPPIA (non solo dal link pubblico /p/preview).
-- Prima le viste della coppia via couple_get_quote_for_entry non incrementavano open_count → il pannello
-- "Attività del cliente" restava su BOZZA "il cliente non l'ha visto" anche se la coppia era entrata.
-- Ora: incrementa il contatore (open_count/first/last) e registra una riga in quote_views (timeline).
-- Auth: solo un membro della coppia dell'evento. Dedup per-sessione lato frontend (una vista per visita).
create or replace function public.track_couple_quote_open(p_entry_id uuid, p_ua text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_qid uuid;
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry_id and m.user_id = v_uid) then
    return;
  end if;
  select quote_id into v_qid from public.calendar_entries where id = p_entry_id;
  if v_qid is null then return; end if;

  update public.quotes
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where id = v_qid;

  insert into public.quote_views (quote_id, event_type, payload, user_agent)
  values (v_qid, 'OPEN', jsonb_build_object('via','couple_dashboard'), left(p_ua, 300));
end$$;
grant execute on function public.track_couple_quote_open(uuid, text) to authenticated;
