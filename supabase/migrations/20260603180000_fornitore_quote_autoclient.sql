-- ============================================================================
-- Quando un FORNITORE riceve un "sì" su un preventivo (ACCETTATO o
-- CONVERTITO_IN_CONTRATTO), il cliente deve comparire da solo nella rubrica
-- "Clienti" (supplier_clients) con stato CLIENTE — senza inserimento manuale.
-- Collega anche il preventivo al cliente (direct_client_id) per le statistiche.
-- I capostipiti (WP/LOCATION) gestiscono i clienti via coppia/evento, non qui.
-- ----------------------------------------------------------------------------

create or replace function public.fornitore_quote_to_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_cid  uuid;
begin
  if new.status not in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then return new; end if;
  if coalesce(btrim(new.client_name), '') = '' then return new; end if;
  if new.direct_client_id is not null then return new; end if;

  select role::text into v_role from public.profiles where id = new.owner_id;
  if v_role is distinct from 'FORNITORE' then return new; end if;

  -- Cerco un cliente già in rubrica (per email o, in mancanza, per nome).
  select id into v_cid
  from public.supplier_clients
  where supplier_id = new.owner_id
    and (
      (new.client_email is not null and lower(email) = lower(new.client_email))
      or lower(full_name) = lower(new.client_name)
    )
  limit 1;

  if v_cid is null then
    insert into public.supplier_clients
      (supplier_id, full_name, email, event_date, event_kind, location_text, status, source)
    values
      (new.owner_id, new.client_name, new.client_email, new.event_date,
       new.event_kind::text, new.event_location, 'CLIENTE', 'preventivo')
    returning id into v_cid;
  else
    update public.supplier_clients
       set status     = 'CLIENTE',
           email      = coalesce(email, new.client_email),
           event_date = coalesce(event_date, new.event_date),
           event_kind = coalesce(event_kind, new.event_kind::text),
           updated_at = now()
     where id = v_cid;
  end if;

  new.direct_client_id := v_cid;
  return new;
end;
$$;

drop trigger if exists trg_fornitore_quote_to_client on public.quotes;
create trigger trg_fornitore_quote_to_client
  before insert or update of status on public.quotes
  for each row execute function public.fornitore_quote_to_client();

-- ── Backfill: clienti già "vinti" ma non ancora in rubrica ──────────────────
do $$
declare
  q record;
  v_cid uuid;
begin
  for q in
    select qt.id, qt.owner_id, qt.client_name, qt.client_email,
           qt.event_date, qt.event_kind::text as event_kind, qt.event_location
    from public.quotes qt
    join public.profiles p on p.id = qt.owner_id
    where p.role::text = 'FORNITORE'
      and qt.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
      and qt.direct_client_id is null
      and coalesce(btrim(qt.client_name), '') <> ''
  loop
    select id into v_cid
    from public.supplier_clients
    where supplier_id = q.owner_id
      and (
        (q.client_email is not null and lower(email) = lower(q.client_email))
        or lower(full_name) = lower(q.client_name)
      )
    limit 1;

    if v_cid is null then
      insert into public.supplier_clients
        (supplier_id, full_name, email, event_date, event_kind, location_text, status, source)
      values
        (q.owner_id, q.client_name, q.client_email, q.event_date,
         q.event_kind, q.event_location, 'CLIENTE', 'preventivo')
      returning id into v_cid;
    else
      update public.supplier_clients set status = 'CLIENTE', updated_at = now() where id = v_cid;
    end if;

    update public.quotes set direct_client_id = v_cid where id = q.id;
  end loop;
end $$;
