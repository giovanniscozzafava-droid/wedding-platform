-- METRICHE preventivo: oltre al contatore (open_count) e first/last, salviamo UNA RIGA per OGNI
-- apertura del cliente in quote_views (event_type='OPEN') → timeline completa "ogni volta che viene
-- a vederlo". quote_activity ora restituisce anche l'elenco delle viste.

-- Rimuove la vecchia firma a 1 argomento: tenere entrambe (uuid) e (uuid,text default null)
-- renderebbe ambigua la chiamata con il solo p_token via PostgREST. La nuova firma (default null)
-- copre comunque le chiamate a un solo argomento.
drop function if exists public.track_quote_open(uuid);

create or replace function public.track_quote_open(p_token uuid, p_ua text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.quotes
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where access_token = p_token
     and token_revoked_at is null
   returning id into v_id;
  if v_id is not null then
    -- una riga per ogni vista (timeline). SECURITY DEFINER → bypassa la RLS in insert.
    insert into public.quote_views (quote_id, event_type, payload, user_agent)
    values (v_id, 'OPEN', '{}'::jsonb, left(p_ua, 300));
    perform public.log_access('quotes', v_id::text, 'READ', jsonb_build_object('op','quote_open'));
  end if;
end$$;
grant execute on function public.track_quote_open(uuid, text) to anon, authenticated;

-- quote_activity: aggiunge l'array "views" (aperture recenti, max 100) per la timeline lato owner.
create or replace function public.quote_activity(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q public.quotes%rowtype; v_reg timestamptz; v_stage text; v_views jsonb;
begin
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;

  select min(created_at) into v_reg from public.quote_view_consents where quote_id = p_quote_id;

  select coalesce(jsonb_agg(jsonb_build_object('at', created_at, 'ua', user_agent) order by created_at desc), '[]'::jsonb)
    into v_views
  from (
    select created_at, user_agent from public.quote_views
     where quote_id = p_quote_id and event_type = 'OPEN'
     order by created_at desc limit 100
  ) s;

  v_stage := case
    when v_q.status = 'RIFIUTATO' then 'RIFIUTATO'
    when v_q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then 'ACCETTATO'
    when v_reg is not null then 'REGISTRATO'
    when v_q.open_count > 0 then 'APERTO'
    when v_q.sent_at is not null or v_q.status = 'INVIATO' then 'INVIATO'
    else 'BOZZA' end;

  return jsonb_build_object(
    'ok', true,
    'stage', v_stage,
    'sent_at', v_q.sent_at,
    'email_sent', (v_q.sent_at is not null) or (jsonb_typeof(v_q.sent_email_log) = 'array' and jsonb_array_length(v_q.sent_email_log) > 0),
    'open_count', v_q.open_count,
    'first_opened_at', v_q.first_opened_at,
    'last_opened_at', v_q.last_opened_at,
    'registered_at', v_reg,
    'accepted_at', v_q.accepted_at,
    'rejected_at', v_q.rejected_at,
    'status', v_q.status,
    'views', v_views
  );
end$$;
grant execute on function public.quote_activity(uuid) to authenticated;
