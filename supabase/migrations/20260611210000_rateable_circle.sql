-- FIX feedback: chi posso valutare. Prima si basava SOLO su quote_items (i fornitori
-- sul preventivo), ignorando il cerchio reale (calendar_entry_participants). Risultato:
-- un fornitore aggiunto al cerchio (o il fotografo non a preventivo) non vedeva nessuno
-- da valutare. Ora la membership = partecipanti del cerchio + fornitori a preventivo +
-- WP owner; valuto gli ALTRI professionisti del cerchio, dopo la data dell'evento.
create or replace function public.rateable_users_for_entry(p_entry uuid)
returns table(user_id uuid, role text, display_name text)
language sql stable security definer set search_path = public as $function$
  with me as (select auth.uid() as uid),
       evt as (select ce.id, ce.owner_id, ce.quote_id, coalesce(ce.date_to, ce.date_from) as ev_date
                 from calendar_entries ce where ce.id = p_entry),
       members as (
         select user_id as uid from public.calendar_entry_participants where entry_id = p_entry and user_id is not null
         union
         select qi.supplier_id from evt join public.quote_items qi on qi.quote_id = evt.quote_id where qi.supplier_id is not null
         union
         select owner_id from evt where owner_id is not null
       )
  select p.id, p.role::text, coalesce(nullif(p.business_name, ''), p.full_name)
    from profiles p
   where p.id <> (select uid from me)
     and p.id in (select uid from members)
     and (select uid from me) in (select uid from members)          -- io devo essere nel cerchio
     and p.role in ('FORNITORE', 'WEDDING_PLANNER', 'LOCATION')      -- valuto professionisti, non gli sposi
     and (select ev_date from evt) <= current_date;                 -- solo a evento concluso
$function$;
grant execute on function public.rateable_users_for_entry(uuid) to authenticated;
