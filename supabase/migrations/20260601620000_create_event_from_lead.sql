-- ============================================================================
-- create_event_from_lead: converte un lead profilato in evento + preventivo
-- bozza, propagando TUTTI i dati di profilazione raccolti dal form pubblico.
-- ----------------------------------------------------------------------------
-- Obiettivo (richiesta dogfood): i dati del lead (nome, contatto, data, tipo
-- evento, invitati, location) devono "ritrovarsi ovunque" lungo tutto il
-- matrimonio. Questa RPC e` il ponte: crea il calendar_entry (evento) e il
-- quote (preventivo bozza) gia` pre-compilati, e collega il lead come sorgente.
--
-- Idempotente-soft: se il lead ha gia` generato un evento collegato, ritorna
-- quello esistente invece di duplicare.
-- ============================================================================

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

  -- Solo il WP destinatario del lead (o admin) puo` convertirlo.
  if v_lead.wp_id <> v_uid and not public.is_admin() then
    return jsonb_build_object('error', 'not_lead_owner');
  end if;

  v_title := coalesce(nullif(trim(v_lead.client_name), ''), 'Nuovo evento');

  -- Se esiste gia` un quote di questo WP con stesso client_email + event_date
  -- collegato a un evento, riusa (evita duplicati da doppio click).
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

  -- 1. Evento (calendar_entry) in stato LEAD
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
      nullif(v_lead.event_location, '') ,
      case when v_lead.budget_range is not null then concat('Budget indicato: ', v_lead.budget_range) end,
      nullif(v_lead.message, '')
    )
  );

  -- 2. Preventivo (quote) bozza pre-compilato
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

  -- 3. Collega evento <-> preventivo
  update public.calendar_entries set quote_id = v_quote_id where id = v_entry_id;

  -- 4. Avanza il lead a QUOTED (preventivo in lavorazione)
  update public.lead_requests
     set status = 'QUOTED', quoted_at = coalesce(quoted_at, now())
   where id = p_lead_id and status in ('NEW','VIEWED','CONTACTED');

  return jsonb_build_object('quote_id', v_quote_id, 'entry_id', v_entry_id, 'reused', false);
end$$;

grant execute on function public.create_event_from_lead(uuid) to authenticated;

comment on function public.create_event_from_lead(uuid) is
  'Converte un lead profilato in evento + preventivo bozza pre-compilati, propagando i dati del lead. Riusa l''esistente se gia` convertito.';
