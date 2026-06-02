-- ============================================================================
-- Tracciamento comportamento cliente sul preventivo inviato (capostipite +
-- fornitore): inviato → aperto (quante volte) → registrato (consenso) →
-- accettato/rifiutato. "Che fine fa il preventivo che spedisco."
-- ============================================================================

alter table public.quotes
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count int not null default 0;

-- Registra un'apertura del preventivo (chiamata dalle pagine pubbliche via token)
create or replace function public.track_quote_open(p_token uuid)
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
    perform public.log_access('quotes', v_id::text, 'READ', jsonb_build_object('op','quote_open'));
  end if;
end$$;
grant execute on function public.track_quote_open(uuid) to anon, authenticated;

-- Vista attività del preventivo (solo owner): timeline + stato cliente
create or replace function public.quote_activity(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q public.quotes%rowtype; v_reg timestamptz; v_stage text;
begin
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;

  select min(created_at) into v_reg from public.quote_view_consents where quote_id = p_quote_id;

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
    'status', v_q.status
  );
end$$;
grant execute on function public.quote_activity(uuid) to authenticated;

-- Riepilogo per la LISTA preventivi: stato cliente per molti quote in un colpo
create or replace function public.quotes_activity_summary(p_quote_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_object_agg(id::text, jsonb_build_object(
    'stage', case
      when status='RIFIUTATO' then 'RIFIUTATO'
      when status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then 'ACCETTATO'
      when reg is not null then 'REGISTRATO'
      when open_count>0 then 'APERTO'
      when sent_at is not null or status='INVIATO' then 'INVIATO'
      else 'BOZZA' end,
    'open_count', open_count, 'last_opened_at', last_opened_at, 'registered', reg is not null)), '{}'::jsonb)
  into v_res
  from (
    select q.id, q.status, q.sent_at, q.open_count, q.last_opened_at,
           (select min(created_at) from public.quote_view_consents c where c.quote_id=q.id) as reg
    from public.quotes q
    where q.id = any(p_quote_ids) and (q.owner_id = v_uid or public.is_admin())
  ) x;
  return jsonb_build_object('ok', true, 'map', v_res);
end$$;
grant execute on function public.quotes_activity_summary(uuid[]) to authenticated;

comment on function public.quote_activity(uuid) is
  'Timeline comportamento cliente sul preventivo: inviato/aperto(N)/registrato/accettato/rifiutato. Solo owner.';
