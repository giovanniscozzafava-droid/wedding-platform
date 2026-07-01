-- BUG FIX: "Errore conversione lead" cliccando "Crea evento + preventivo da questo lead"
-- (es. lead Compleanno con profilazione). Il frontend mostrava un errore generico perché la RPC
-- lanciava un'eccezione SQL nascosta. Cause difensive:
--   1) la propagazione della PROFILAZIONE nel questionario (quote_questionnaire_answers) non deve
--      MAI rompere la conversione: è un di più → resa best-effort (inner exception).
--   2) qualunque altro errore ora torna come {error: '...SQLERRM...'} → il gestore lo mostra,
--      niente più "Errore conversione lead" opaco.

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

  -- Riuso: se esiste già un evento+preventivo per lo stesso cliente/data, riapri quello.
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
    'IN_TRATTATIVA', coalesce(nullif(v_lead.event_kind, ''), 'matrimonio'), 'LEAD',
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
    v_lead.event_date, v_lead.event_location, coalesce(nullif(v_lead.event_kind, ''), 'matrimonio'),
    v_lead.guests_estimate,
    'BOZZA', 1, 0, 0, 0, 0, 0
  );

  update public.calendar_entries set quote_id = v_quote_id where id = v_entry_id;

  -- Propaga la profilazione nel questionario del preventivo. BEST-EFFORT: se fallisce
  -- (schema questionario diverso, ecc.) la conversione NON deve saltare.
  if v_lead.profile_answers is not null and v_lead.profile_answers <> '{}'::jsonb then
    begin
      insert into public.quote_questionnaire_answers (quote_id, event_kind, answers, completed_at)
      values (v_quote_id, coalesce(nullif(v_lead.event_kind, ''), 'matrimonio'), v_lead.profile_answers, null)
      on conflict (quote_id) do update set answers = excluded.answers, event_kind = excluded.event_kind;
    exception when others then
      null; -- profilazione non propagata: non blocca la conversione
    end;
  end if;

  update public.lead_requests
     set status = 'QUOTED', quoted_at = coalesce(quoted_at, now())
   where id = p_lead_id and status in ('NEW','VIEWED','CONTACTED');

  return jsonb_build_object('quote_id', v_quote_id, 'entry_id', v_entry_id, 'reused', false);

exception when others then
  -- Superficie l'errore reale invece del generico "Errore conversione lead".
  return jsonb_build_object('error', 'conversione: ' || SQLERRM);
end$$;
