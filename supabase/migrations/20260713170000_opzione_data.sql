-- ============================================================================
-- OPZIONE / BLOCCA-DATA SENZA IMPEGNO dal preventivo (PRP-Opzione-Data-v1, funzioni già testate).
-- Il professionista, a sua discrezione su ogni preventivo, blocca la data SENZA impegno per N giorni
-- (default 15): l'evento va OPZIONATA + countdown → la data risulta bloccata sul calendario (OPZIONATA
-- blocca già la disponibilità), ma senza vincolo. Si scioglie da sola alla scadenza (cron), diventa
-- CONFERMATA se il cliente firma (event_confirmed_on_quote_accepted esistente), o si rilascia a mano.
-- Riusa opziona_data + supplier_date_options + il vincolo anti-overlap esistenti.
-- ============================================================================

alter table public.calendar_entries
  add column if not exists option_expires_at timestamptz,
  add column if not exists option_requested_by text;

create table if not exists public.quote_option_requests (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  client_email text not null,
  status       text not null default 'RICHIESTA' check (status in ('RICHIESTA','CONCESSA','RIFIUTATA','SCADUTA','RILASCIATA')),
  requested_at timestamptz not null default now(),
  granted_days int,
  option_id    uuid references public.supplier_date_options(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_qor_owner on public.quote_option_requests(owner_id);
create index if not exists idx_qor_quote on public.quote_option_requests(quote_id);
alter table public.quote_option_requests enable row level security;
drop policy if exists qor_owner_read on public.quote_option_requests;
create policy qor_owner_read on public.quote_option_requests for select using (owner_id = auth.uid());

-- CLIENTE chiede l'opzione dal preventivo (via access_token, no auth)
create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record;
begin
  select q.id, q.entry_id, q.owner_id, q.client_email into v_q
    from public.quotes q where q.access_token::text = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if exists (select 1 from public.quote_option_requests where quote_id = v_q.id and status='RICHIESTA') then
    return jsonb_build_object('error','gia_richiesta');
  end if;
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'RICHIESTA');
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.richiedi_opzione_da_preventivo(text) to anon, authenticated;

-- PROFESSIONISTA concede N giorni su una richiesta esistente
create or replace function public.concedi_opzione(p_request_id uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_r record; v_opt jsonb; v_exp timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select r.*, ce.date_from into v_r
    from public.quote_option_requests r join public.calendar_entries ce on ce.id = r.entry_id
    where r.id = p_request_id;
  if v_r.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_r.owner_id <> v_uid then return jsonb_build_object('error','forbidden'); end if;
  if v_r.status <> 'RICHIESTA' then return jsonb_build_object('error','stato_non_valido'); end if;

  v_exp := now() + make_interval(days => greatest(1, coalesce(p_days,15)));
  v_opt := public.opziona_data(v_r.date_from, v_r.date_from, greatest(1,coalesce(p_days,15)), 'Opzione da preventivo', null, null);
  if v_opt ? 'error' then return v_opt; end if;

  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_r.client_email where id=v_r.entry_id;
  update public.quote_option_requests set status='CONCESSA', granted_days=greatest(1,coalesce(p_days,15)), option_id=(v_opt->>'id')::uuid where id=p_request_id;
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;
grant execute on function public.concedi_opzione(uuid, int) to authenticated;

-- PROFESSIONISTA blocca la data direttamente dal preventivo (a sua discrezione, senza richiesta cliente)
create or replace function public.blocca_data_preventivo(p_quote_id uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q record; v_opt jsonb; v_exp timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select q.id, q.entry_id, q.owner_id, q.client_email, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.id = q.entry_id
    where q.id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> v_uid then return jsonb_build_object('error','forbidden'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;

  v_exp := now() + make_interval(days => greatest(1, coalesce(p_days,15)));
  v_opt := public.opziona_data(v_q.date_from, v_q.date_from, greatest(1,coalesce(p_days,15)), 'Blocco data senza impegno (dal preventivo)', null, null);
  if v_opt ? 'error' then return v_opt; end if;

  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email where id=v_q.entry_id;
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days, option_id)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', greatest(1,coalesce(p_days,15)), (v_opt->>'id')::uuid);
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;
grant execute on function public.blocca_data_preventivo(uuid, int) to authenticated;

-- PROFESSIONISTA rilascia il blocco (torna disponibile)
create or replace function public.sblocca_data_preventivo(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select q.entry_id, q.owner_id into v_q from public.quotes q where q.id = p_quote_id;
  if v_q.entry_id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> v_uid then return jsonb_build_object('error','forbidden'); end if;

  update public.supplier_date_options o set status='RELEASED', updated_at=now()
    from public.quote_option_requests r
   where r.quote_id = p_quote_id and r.option_id = o.id and o.status='OPTIONED';
  update public.calendar_entries set status='IN_TRATTATIVA', option_expires_at=null, option_requested_by=null
   where id = v_q.entry_id and status='OPZIONATA';
  update public.quote_option_requests set status='RILASCIATA' where quote_id = p_quote_id and status='CONCESSA';
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.sblocca_data_preventivo(uuid) to authenticated;

-- CRON: fa scadere le opzioni e libera la data
create or replace function public.scadi_opzioni()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.supplier_date_options set status='EXPIRED', updated_at=now()
   where status='OPTIONED' and expires_at < now();
  update public.calendar_entries set status='IN_TRATTATIVA', option_expires_at=null
   where status='OPZIONATA' and option_expires_at is not null and option_expires_at < now();
  get diagnostics v_n = row_count;
  update public.quote_option_requests r set status='SCADUTA'
   from public.calendar_entries ce
   where r.entry_id = ce.id and r.status='CONCESSA' and ce.status='IN_TRATTATIVA';
  return v_n;
end$$;

-- Schedula la scadenza ogni 15 minuti (best-effort: se pg_cron non c'è, non blocca la migration)
do $$ begin
  perform cron.unschedule('scadi-opzioni');
exception when others then null; end $$;
do $$ begin
  perform cron.schedule('scadi-opzioni', '*/15 * * * *', 'select public.scadi_opzioni();');
exception when others then null; end $$;
