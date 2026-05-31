-- ============================================================================
-- Profilazione lead: domande "giuste" raccolte gia` nella richiesta preventivo
-- dalla landing pubblica, e propagate nel questionario del matrimonio.
-- ----------------------------------------------------------------------------
--  1) lead_requests.profile_answers jsonb  (storia, stile, priorita`, must-have…)
--  2) submit_lead_request(..., p_profile_answers)  overload pubblico
--  3) create_event_from_lead  scrive quelle risposte in quote_questionnaire_answers
--     cosi` il preventivo/matrimonio nasce gia` profilato (la coppia potra`
--     comunque rivederle/completarle).
-- ============================================================================

-- 1) Colonna profilazione ----------------------------------------------------
alter table public.lead_requests
  add column if not exists profile_answers jsonb not null default '{}'::jsonb;

comment on column public.lead_requests.profile_answers is
  'Risposte di profilazione raccolte nel form pubblico (storia, stile, priorita`, must-have, no-thanks…). Propagate al questionario del matrimonio.';

-- 2) Overload submit_lead_request con profilazione ---------------------------
create or replace function public.submit_lead_request(
  p_wp_slug        text,
  p_client_name    text,
  p_client_email   text,
  p_client_phone   text,
  p_event_kind     text,
  p_event_date     date,
  p_event_location text,
  p_guests_estimate int,
  p_budget_range   text,
  p_message        text,
  p_honeypot       text,
  p_source         text,
  p_profile_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wp_id uuid;
  v_wp_role user_role;
  v_id uuid;
begin
  if p_honeypot is not null and p_honeypot <> '' then
    return jsonb_build_object('ok', true, 'id', gen_random_uuid());
  end if;
  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_client_email is null or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'invalid_email');
  end if;

  select id, role into v_wp_id, v_wp_role from profiles where slug = p_wp_slug limit 1;
  if v_wp_id is null then
    return jsonb_build_object('error', 'wp_not_found');
  end if;
  if v_wp_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    return jsonb_build_object('error', 'not_a_wp_or_location');
  end if;

  insert into lead_requests (
    wp_id, client_name, client_email, client_phone, event_kind, event_date,
    event_location, guests_estimate, budget_range, message, source, profile_answers
  ) values (
    v_wp_id, trim(p_client_name), lower(trim(p_client_email)),
    nullif(trim(coalesce(p_client_phone,'')),''),
    coalesce(p_event_kind, 'matrimonio'),
    p_event_date, p_event_location, p_guests_estimate, p_budget_range, p_message, p_source,
    coalesce(p_profile_answers, '{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

grant execute on function public.submit_lead_request(text, text, text, text, text, date, text, int, text, text, text, text, jsonb) to anon, authenticated;

-- 3) create_event_from_lead: propaga profile_answers nel questionario ---------
create or replace function public.create_event_from_lead(p_lead_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lead public.lead_requests%rowtype;
  v_entry_id uuid;
  v_quote_id uuid;
  v_title text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  select * into v_lead from public.lead_requests where id = p_lead_id;
  if v_lead.id is null then
    return jsonb_build_object('error', 'lead_not_found');
  end if;
  if v_lead.wp_id <> v_uid and not public.is_admin() then
    return jsonb_build_object('error', 'not_lead_owner');
  end if;

  v_title := coalesce(nullif(trim(v_lead.client_name), ''), 'Nuovo evento');

  select ce.id, ce.quote_id into v_entry_id, v_quote_id
    from public.calendar_entries ce
    join public.quotes q on q.id = ce.quote_id
   where ce.owner_id = v_uid
     and q.client_email is not distinct from v_lead.client_email
     and q.event_date is not distinct from v_lead.event_date
     and v_lead.client_email is not null
   limit 1;

  if v_quote_id is not null then
    return jsonb_build_object('quote_id', v_quote_id, 'entry_id', v_entry_id, 'reused', true);
  end if;

  v_entry_id := gen_random_uuid();
  insert into public.calendar_entries (
    id, owner_id, title, client_name, client_email,
    date_from, date_to, status, event_kind, evento_stato, notes
  ) values (
    v_entry_id, v_uid, v_title, v_lead.client_name, v_lead.client_email,
    coalesce(v_lead.event_date, current_date), coalesce(v_lead.event_date, current_date),
    'IN_TRATTATIVA', coalesce(v_lead.event_kind, 'matrimonio'), 'LEAD',
    concat_ws(E'\n',
      'Origine: lead dal portale pubblico.',
      nullif(v_lead.event_location, ''),
      case when v_lead.budget_range is not null then concat('Budget indicato: ', v_lead.budget_range) end,
      nullif(v_lead.message, '')
    )
  );

  v_quote_id := gen_random_uuid();
  insert into public.quotes (
    id, owner_id, title, client_name, client_email,
    event_date, event_location, event_kind, guest_count,
    status, revision, default_markup_percent,
    total_cost, total_client, margin_amount, margin_percent
  ) values (
    v_quote_id, v_uid, v_title, v_lead.client_name, v_lead.client_email,
    v_lead.event_date, v_lead.event_location, coalesce(v_lead.event_kind, 'matrimonio'),
    v_lead.guests_estimate,
    'BOZZA', 1, 0, 0, 0, 0, 0
  );

  update public.calendar_entries set quote_id = v_quote_id where id = v_entry_id;

  -- Propaga la profilazione del lead nel questionario del preventivo (non
  -- completato: la coppia potra` rivederlo/integrarlo). Solo se ci sono dati.
  if v_lead.profile_answers is not null and v_lead.profile_answers <> '{}'::jsonb then
    insert into public.quote_questionnaire_answers (quote_id, event_kind, answers, completed_at)
    values (v_quote_id, coalesce(v_lead.event_kind, 'matrimonio'), v_lead.profile_answers, null)
    on conflict (quote_id) do update set answers = excluded.answers, event_kind = excluded.event_kind;
  end if;

  update public.lead_requests
     set status = 'QUOTED', quoted_at = coalesce(quoted_at, now())
   where id = p_lead_id and status in ('NEW','VIEWED','CONTACTED');

  return jsonb_build_object('quote_id', v_quote_id, 'entry_id', v_entry_id, 'reused', false);
end$$;

grant execute on function public.create_event_from_lead(uuid) to authenticated;
