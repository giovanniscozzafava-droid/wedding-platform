-- ============================================================================
-- P1 — Pipeline lead fornitore + origine preventivo
-- ----------------------------------------------------------------------------
--  • quotes.quote_origin            → da dove nasce il preventivo
--  • supplier_leads                 → singole richieste dirette (1 cliente : N lead)
--  • submit_public_lead (fornitore) → upsert anagrafica + riga supplier_leads
--  • create_quote_from_supplier_lead → conversione lead → preventivo diretto
-- ============================================================================

-- 1) Origine preventivo
alter table public.quotes add column if not exists quote_origin text;
comment on column public.quotes.quote_origin is
  'Origine: PUBLIC_LEAD | EMBED_LEAD | SUPPLIER_PUBLIC_LEAD | SUPPLIER_EMBED_LEAD | MANUAL_CREATE | FROM_EVENT | FROM_SUPPLIER_REQUEST | REVISION | DUPLICATED_TEMPLATE | IMPORTED | UNKNOWN';

-- 2) supplier_leads (richieste dirette al fornitore)
create table if not exists public.supplier_leads (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references public.profiles(id) on delete cascade,
  supplier_client_id uuid references public.supplier_clients(id) on delete set null,
  source             text,
  source_url         text,
  event_kind         text,
  event_date_from    date,
  event_date_to      date,
  event_location     text,
  city               text,
  province           text,
  estimated_guests   int,
  estimated_budget   text,
  message            text,
  questionnaire_payload jsonb not null default '{}'::jsonb,
  utm_payload        jsonb not null default '{}'::jsonb,
  status             text not null default 'NEW'
                      check (status in ('NEW','CONTACTED','QUALIFIED','QUOTE_CREATED','QUOTE_SENT','WON','LOST','ARCHIVED')),
  converted_quote_id uuid references public.quotes(id) on delete set null,
  converted_at       timestamptz,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_supplier_leads_supplier on public.supplier_leads(supplier_id, status, created_at desc);
create index if not exists idx_supplier_leads_client on public.supplier_leads(supplier_client_id);

drop trigger if exists trg_supplier_leads_upd on public.supplier_leads;
create trigger trg_supplier_leads_upd before update on public.supplier_leads
  for each row execute function public.set_updated_at();

alter table public.supplier_leads enable row level security;
drop policy if exists "supplier_leads_own" on public.supplier_leads;
create policy "supplier_leads_own" on public.supplier_leads
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());
drop policy if exists "supplier_leads_admin" on public.supplier_leads;
create policy "supplier_leads_admin" on public.supplier_leads
  for all using (is_admin()) with check (is_admin());

-- 3) submit_public_lead: per FORNITORE, upsert anagrafica + riga supplier_leads
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
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_role user_role; v_new uuid; v_client uuid; v_email text;
begin
  if p_honeypot is not null and p_honeypot <> '' then
    return jsonb_build_object('ok', true, 'id', gen_random_uuid(), 'kind', 'noop');
  end if;
  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_client_email is null or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'invalid_email');
  end if;
  v_email := lower(trim(p_client_email));

  select id, role into v_id, v_role from profiles where slug = p_slug limit 1;
  if v_id is null then return jsonb_build_object('error', 'profile_not_found'); end if;

  if v_role in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    insert into lead_requests (wp_id, client_name, client_email, client_phone, event_kind, event_date,
      event_location, guests_estimate, budget_range, message, source, profile_answers)
    values (v_id, trim(p_client_name), v_email, nullif(trim(coalesce(p_client_phone,'')),''),
      coalesce(p_event_kind,'matrimonio'), p_event_date, p_event_location, p_guests_estimate,
      p_budget_range, p_message, coalesce(p_source,'public_form'), coalesce(p_profile_answers,'{}'::jsonb))
    returning id into v_new;
    return jsonb_build_object('ok', true, 'id', v_new, 'kind', 'wp');

  elsif v_role = 'FORNITORE' then
    -- Upsert anagrafica cliente diretto (per email)
    select id into v_client from supplier_clients
      where supplier_id = v_id and lower(email) = v_email limit 1;
    if v_client is null then
      insert into supplier_clients (supplier_id, full_name, email, phone, event_date, event_kind,
        location_text, guest_estimate, notes, source, status, profile_answers)
      values (v_id, trim(p_client_name), v_email, nullif(trim(coalesce(p_client_phone,'')),''),
        p_event_date, coalesce(p_event_kind,'altro'), p_event_location, p_guests_estimate,
        nullif(trim(coalesce(p_message,'')),''), coalesce(p_source,'sito_web'), 'LEAD',
        coalesce(p_profile_answers,'{}'::jsonb))
      returning id into v_client;
    else
      update supplier_clients set
        phone = coalesce(nullif(trim(coalesce(p_client_phone,'')),''), phone),
        event_date = coalesce(p_event_date, event_date),
        event_kind = coalesce(p_event_kind, event_kind),
        profile_answers = coalesce(p_profile_answers, profile_answers),
        updated_at = now()
      where id = v_client;
    end if;
    -- Nuova richiesta nel pipeline
    insert into supplier_leads (supplier_id, supplier_client_id, source, event_kind, event_date_from,
      event_location, estimated_guests, estimated_budget, message, questionnaire_payload, status)
    values (v_id, v_client, coalesce(p_source,'sito_web'), coalesce(p_event_kind,'altro'), p_event_date,
      p_event_location, p_guests_estimate, p_budget_range, nullif(trim(coalesce(p_message,'')),''),
      coalesce(p_profile_answers,'{}'::jsonb), 'NEW')
    returning id into v_new;
    return jsonb_build_object('ok', true, 'id', v_new, 'kind', 'fornitore', 'client_id', v_client);
  end if;

  return jsonb_build_object('error', 'role_not_supported');
end$$;
grant execute on function public.submit_public_lead(text,text,text,text,text,date,text,int,text,text,text,text,jsonb) to anon, authenticated;

-- 4) Conversione supplier_lead → preventivo diretto
create or replace function public.create_quote_from_supplier_lead(p_lead_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lead public.supplier_leads%rowtype;
  v_client public.supplier_clients%rowtype;
  v_quote uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_lead from public.supplier_leads where id = p_lead_id;
  if v_lead.id is null then return jsonb_build_object('error','lead_not_found'); end if;
  if v_lead.supplier_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  if v_lead.converted_quote_id is not null then
    return jsonb_build_object('ok', true, 'quote_id', v_lead.converted_quote_id, 'reused', true);
  end if;
  if v_lead.supplier_client_id is not null then
    select * into v_client from public.supplier_clients where id = v_lead.supplier_client_id;
  end if;

  insert into public.quotes (owner_id, title, client_name, client_email, event_date, event_location,
    event_kind, status, revision, default_markup_percent, total_cost, total_client, margin_amount, margin_percent,
    direct_client_id, quote_origin)
  values (v_uid,
    coalesce(nullif(trim(v_client.full_name),''), 'Nuovo cliente') || ' — preventivo',
    v_client.full_name, coalesce(v_client.email, ''), v_lead.event_date_from, v_lead.event_location,
    coalesce(v_lead.event_kind,'altro'), 'BOZZA', 1, 0, 0, 0, 0, 0,
    v_lead.supplier_client_id, 'SUPPLIER_PUBLIC_LEAD')
  returning id into v_quote;

  -- Propaga la profilazione nel questionario del preventivo
  if v_lead.questionnaire_payload is not null and v_lead.questionnaire_payload <> '{}'::jsonb then
    insert into public.quote_questionnaire_answers (quote_id, event_kind, answers, completed_at)
    values (v_quote, coalesce(v_lead.event_kind,'altro'), v_lead.questionnaire_payload, null)
    on conflict (quote_id) do update set answers = excluded.answers, event_kind = excluded.event_kind;
  end if;

  update public.supplier_leads
     set status = 'QUOTE_CREATED', converted_quote_id = v_quote, converted_at = now()
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'reused', false);
end$$;
grant execute on function public.create_quote_from_supplier_lead(uuid) to authenticated;

comment on table public.supplier_leads is
  'Richieste dirette ricevute da un fornitore (1 cliente : N richieste). Pipeline NEW→…→WON/LOST. Convertibili in preventivo diretto.';
