-- REGRESSIONE (re-introdotta da m3m6 20260808130000, drop+create): couple_received_quotes torna a
-- fallire a runtime perché business_name/full_name/subrole/quote_origin sono varchar mentre la
-- RETURNS TABLE li dichiara text → "structure of query does not match function result type:
-- character varying(160) does not match text". La coppia NON vede più i preventivi dei suggeriti.
-- Già chiuso una volta (20260730180000) coi cast ::text, persi ricreando la funzione per aggiungere
-- total_client_selected. Qui li rimetto (mantenendo la nuova colonna).
create or replace function public.couple_received_quotes(p_entry uuid)
returns table (quote_id uuid, professionista text, subrole text, role text, status text,
               total_client numeric, total_client_selected numeric, is_main boolean, quote_origin text)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_main uuid; v_key text;
begin
  if v_uid is null then return; end if;
  if not public.is_admin() and not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry and m.user_id = v_uid) then
    return;
  end if;
  select ce.quote_id into v_main from public.calendar_entries ce where ce.id = p_entry;
  v_key := public.quote_event_key(v_main);
  return query
    select q.id,
           coalesce(pr.business_name, pr.full_name)::text as professionista,
           pr.subrole::text, pr.role::text, q.status::text,
           q.total_client::numeric, q.total_client_selected::numeric,
           (q.id = v_main) as is_main, q.quote_origin::text
    from public.quotes q
    join public.profiles pr on pr.id = q.owner_id
    where (q.id = v_main)
       or (v_key is not null
           and public.quote_event_key(q.id) = v_key
           and q.quote_origin = 'SUPPLIER_SUGGESTION'
           and q.status in ('INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO'))
    order by (q.id = v_main) desc, pr.subrole::text nulls last, coalesce(pr.business_name, pr.full_name)::text;
end$$;
revoke all on function public.couple_received_quotes(uuid) from anon, public;
grant execute on function public.couple_received_quotes(uuid) to authenticated;
