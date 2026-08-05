-- SICUREZZA (H2): quote_event_key / suggestion_event_key erano SECURITY DEFINER + grant a
-- `authenticated` e restituivano l'EMAIL CLIENTE IN CHIARO ('email|data'), senza alcun controllo di
-- proprietà. Qualsiasi utente autenticato poteva chiamare quote_event_key(<uuid>) e leggere
-- l'email del cliente di QUALSIASI preventivo della piattaforma (bypass RLS via definer).
--
-- Le chiavi-evento servono SOLO come confronto di UGUAGLIANZA (quote_event_key(a) = quote_event_key(b)
-- e il confronto inline in is_suggested_recipient_for_quote); nessun chiamante legge il valore come
-- email. Le trasformiamo in un HASH stabile (md5 di 'email|data'): stessa semantica di matching, ma
-- l'email non è più ricostruibile dal risultato. Aggiorniamo i TRE punti con la STESSA formula così
-- l'uguaglianza resta identica.

create or replace function public.quote_event_key(p_quote_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when e.email <> '' and e.dt is not null
              then md5(e.email || '|' || e.dt::text) else null end
  from (
    select
      lower(btrim(coalesce(
        nullif(btrim(q.client_email), ''),
        (select btrim(sp.client_email)
           from public.supplier_suggestions ss
           join public.supplier_suggestions_private sp on sp.suggestion_id = ss.id
          where ss.quote_id = q.id and coalesce(btrim(sp.client_email),'') <> '' limit 1),
        ''))) as email,
      q.event_date as dt
    from public.quotes q where q.id = p_quote_id
  ) e;
$$;
revoke all on function public.quote_event_key(uuid) from anon, public;
grant execute on function public.quote_event_key(uuid) to authenticated;

create or replace function public.suggestion_event_key(p_suggestion_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when e.email <> '' and e.dt is not null
              then md5(e.email || '|' || e.dt::text) else null end
  from (
    select lower(btrim(coalesce(sp.client_email,''))) as email, ss.event_date as dt
    from public.supplier_suggestions ss
    left join public.supplier_suggestions_private sp on sp.suggestion_id = ss.id
    where ss.id = p_suggestion_id
  ) e;
$$;
revoke all on function public.suggestion_event_key(uuid) from anon, public;
grant execute on function public.suggestion_event_key(uuid) to authenticated;

-- Stessa formula hash nel confronto inline, così il match resta invariato.
create or replace function public.is_suggested_recipient_for_quote(p_quote_id uuid, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_key text;
begin
  v_key := public.quote_event_key(p_quote_id);
  if v_key is null then return false; end if;  -- evento non identificabile → nessun blocco
  return exists (
    select 1 from public.supplier_suggestions ss
    left join public.supplier_suggestions_private sp on sp.suggestion_id = ss.id
    where ss.supplier_id = p_user
      and coalesce(btrim(sp.client_email),'') <> '' and ss.event_date is not null
      and md5(lower(btrim(sp.client_email)) || '|' || ss.event_date::text) = v_key
  );
end$$;
revoke all on function public.is_suggested_recipient_for_quote(uuid, uuid) from anon, public;
grant execute on function public.is_suggested_recipient_for_quote(uuid, uuid) to authenticated;
