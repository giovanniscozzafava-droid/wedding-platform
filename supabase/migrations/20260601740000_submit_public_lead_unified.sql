-- ============================================================================
-- Form lead pubblico UNIFICATO + embeddabile (Wix & co.)
-- ----------------------------------------------------------------------------
-- Finora submit_lead_request accettava SOLO WP/LOCATION (lead_requests).
-- L'utente vuole che il form della landing sia disponibile per TUTTI i
-- professionisti, fornitori compresi, ed embeddabile via <iframe> nel proprio
-- sito (Wix, Squarespace, WordPress, Webflow...).
--
-- Nuova RPC anon `submit_public_lead(p_slug, ...)` che instrada per ruolo:
--   • WEDDING_PLANNER / LOCATION / ADMIN  → lead_requests   (flusso wedding)
--   • FORNITORE                            → supplier_clients (cliente diretto)
-- Ritorna { ok, id, kind } dove kind ∈ {'wp','fornitore'}.
--
-- Aggiunge anche supplier_clients.profile_answers (jsonb) per propagare la
-- profilazione nel preventivo diretto del fornitore.
-- ============================================================================

alter table public.supplier_clients
  add column if not exists profile_answers jsonb not null default '{}'::jsonb;

comment on column public.supplier_clients.profile_answers is
  'Risposte di profilazione raccolte nel form pubblico del fornitore. Propagate nel questionario del preventivo diretto.';

create or replace function public.submit_public_lead(
  p_slug            text,
  p_client_name     text,
  p_client_email    text,
  p_client_phone    text,
  p_event_kind      text,
  p_event_date      date,
  p_event_location  text,
  p_guests_estimate int,
  p_budget_range    text,
  p_message         text,
  p_honeypot        text,
  p_source          text,
  p_profile_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_role  user_role;
  v_new   uuid;
begin
  -- honeypot: bot → finto successo, nessuna scrittura
  if p_honeypot is not null and p_honeypot <> '' then
    return jsonb_build_object('ok', true, 'id', gen_random_uuid(), 'kind', 'noop');
  end if;
  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_client_email is null or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'invalid_email');
  end if;

  select id, role into v_id, v_role from profiles where slug = p_slug limit 1;
  if v_id is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if v_role in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    insert into lead_requests (
      wp_id, client_name, client_email, client_phone, event_kind, event_date,
      event_location, guests_estimate, budget_range, message, source, profile_answers
    ) values (
      v_id, trim(p_client_name), lower(trim(p_client_email)),
      nullif(trim(coalesce(p_client_phone,'')),''),
      coalesce(p_event_kind, 'matrimonio'),
      p_event_date, p_event_location, p_guests_estimate, p_budget_range, p_message,
      coalesce(p_source, 'public_form'), coalesce(p_profile_answers, '{}'::jsonb)
    )
    returning id into v_new;
    return jsonb_build_object('ok', true, 'id', v_new, 'kind', 'wp');

  elsif v_role = 'FORNITORE' then
    insert into supplier_clients (
      supplier_id, full_name, email, phone, event_date, event_kind,
      location_text, guest_estimate, notes, source, status, profile_answers
    ) values (
      v_id, trim(p_client_name), lower(trim(p_client_email)),
      nullif(trim(coalesce(p_client_phone,'')),''),
      p_event_date, coalesce(p_event_kind, 'altro'),
      p_event_location, p_guests_estimate,
      concat_ws(E'\n',
        nullif(trim(coalesce(p_message,'')),''),
        case when p_budget_range is not null and p_budget_range <> 'undecided'
             then concat('Budget indicato: ', p_budget_range) end
      ),
      coalesce(p_source, 'sito_web'), 'LEAD', coalesce(p_profile_answers, '{}'::jsonb)
    )
    returning id into v_new;
    return jsonb_build_object('ok', true, 'id', v_new, 'kind', 'fornitore');
  end if;

  return jsonb_build_object('error', 'role_not_supported');
end$$;

grant execute on function public.submit_public_lead(
  text, text, text, text, text, date, text, int, text, text, text, text, jsonb
) to anon, authenticated;

comment on function public.submit_public_lead(text, text, text, text, text, date, text, int, text, text, text, text, jsonb) is
  'Form lead pubblico unificato, embeddabile via iframe. Instrada il lead a lead_requests (WP/Location) o supplier_clients (Fornitore) in base al ruolo dello slug. Anon-callable.';
