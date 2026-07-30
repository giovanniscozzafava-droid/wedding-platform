-- MOTORE RICONOSCIMENTO EVENTO (cross-professionista).
-- Lo stesso evento reale puo' esistere come N preventivi creati da professionisti diversi. Lo
-- riconosciamo con una CHIAVE EVENTO stabile = email cliente (reale, risolta anche dal preventivo
-- cieco via i contatti privati del suggerimento) + data evento. Serve a impedire i LOOP di
-- controsuggerimento: chi e' stato SUGGERITO per un evento puo' essere suggerito ancora, ma NON
-- puo' controsuggerire per quello stesso evento (nemmeno da un proprio preventivo dello stesso evento).

-- Chiave evento di un preventivo: 'email|data' minuscola/trim; null se non identificabile.
create or replace function public.quote_event_key(p_quote_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when e.email <> '' and e.dt is not null then e.email || '|' || e.dt::text else null end
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

-- Chiave evento di un SUGGERIMENTO ricevuto (dai contatti privati + data del suggerimento).
create or replace function public.suggestion_event_key(p_suggestion_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when e.email <> '' and e.dt is not null then e.email || '|' || e.dt::text else null end
  from (
    select lower(btrim(coalesce(sp.client_email,''))) as email, ss.event_date as dt
    from public.supplier_suggestions ss
    left join public.supplier_suggestions_private sp on sp.suggestion_id = ss.id
    where ss.id = p_suggestion_id
  ) e;
$$;
revoke all on function public.suggestion_event_key(uuid) from anon, public;
grant execute on function public.suggestion_event_key(uuid) to authenticated;

-- Il chiamante e' un DESTINATARIO (suggerito) per lo stesso evento di questo preventivo?
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
      and (lower(btrim(coalesce(sp.client_email,''))) || '|' || coalesce(ss.event_date::text,'')) = v_key
  );
end$$;
revoke all on function public.is_suggested_recipient_for_quote(uuid, uuid) from anon, public;
grant execute on function public.is_suggested_recipient_for_quote(uuid, uuid) to authenticated;

-- Guard per il frontend: posso suggerire i miei professionisti su questo preventivo?
-- No se: non sono owner; o sono io stesso un suggerito per questo evento (loop controsuggerimento).
create or replace function public.suggest_guard_for_quote(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_uid uuid := auth.uid();
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('can_suggest', false, 'reason', 'not_found'); end if;
  if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('can_suggest', false, 'reason', 'not_owner'); end if;
  if public.is_suggested_recipient_for_quote(p_quote_id, v_uid) then
    return jsonb_build_object('can_suggest', false, 'reason', 'is_recipient');
  end if;
  return jsonb_build_object('can_suggest', true);
end$$;
revoke all on function public.suggest_guard_for_quote(uuid) from anon, public;
grant execute on function public.suggest_guard_for_quote(uuid) to authenticated;
