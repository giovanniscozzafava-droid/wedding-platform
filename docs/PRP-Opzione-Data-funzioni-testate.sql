-- ============ RIFERIMENTO (NON MIGRATION) — ponte preventivo → opzione → calendario condiviso ============
-- Funzioni del PRP-Opzione-Data-v1 (CONGELATO). Testate end-to-end su Postgres reale.
-- NON è in supabase/migrations/ apposta: non deve auto-applicarsi. Da adattare allo schema reale
-- quando il gate si apre. Vedi PRP-Opzione-Data-v1.md.

-- 1) colonne per il countdown sull'evento condiviso
alter table public.calendar_entries
  add column if not exists option_expires_at timestamptz,
  add column if not exists option_requested_by text;   -- email cliente che ha chiesto

-- tabella richieste opzione (il cliente CHIEDE, il pro CONCEDE) — con FK, mai id di testo
create table if not exists public.quote_option_requests (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  client_email text not null,
  status       text not null default 'RICHIESTA' check (status in ('RICHIESTA','CONCESSA','RIFIUTATA','SCADUTA')),
  requested_at timestamptz not null default now(),
  granted_days int,
  option_id    uuid references public.supplier_date_options(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 2) CLIENTE chiede l'opzione dal preventivo (via access_token, no auth)
create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record;
begin
  select q.id, q.entry_id, q.owner_id, q.client_email into v_q
    from public.quotes q where q.access_token = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if exists (select 1 from public.quote_option_requests where quote_id = v_q.id and status='RICHIESTA') then
    return jsonb_build_object('error','gia_richiesta');
  end if;
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status)
    values (v_q.id, v_q.entry_id, v_q.owner_id, v_q.client_email, 'RICHIESTA');
  return jsonb_build_object('ok', true);
end$$;

-- 3) PROFESSIONISTA concede N giorni: crea opzione + blocca calendario con countdown
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

  v_exp := now() + make_interval(days => greatest(1, coalesce(p_days,7)));
  v_opt := public.opziona_data(v_r.date_from, v_r.date_from, greatest(1,coalesce(p_days,7)),
                               'Opzione da preventivo', null, null);
  if v_opt ? 'error' then return v_opt; end if;   -- es. data già opzionata da altri

  update public.calendar_entries
     set status = 'OPZIONATA', option_expires_at = v_exp, option_requested_by = v_r.client_email
   where id = v_r.entry_id;
  update public.quote_option_requests
     set status='CONCESSA', granted_days = greatest(1,coalesce(p_days,7)),
         option_id = (v_opt->>'id')::uuid
   where id = p_request_id;
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;

-- 4) CRON: fa scadere le opzioni, libera la data, segna per notifica
create or replace function public.scadi_opzioni()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.supplier_date_options set status='EXPIRED', updated_at=now()
   where status='OPTIONED' and expires_at < now();
  update public.calendar_entries
     set status='IN_TRATTATIVA', option_expires_at=null
   where status='OPZIONATA' and option_expires_at is not null and option_expires_at < now();
  get diagnostics v_n = row_count;
  update public.quote_option_requests r set status='SCADUTA'
   from public.calendar_entries ce
   where r.entry_id = ce.id and r.status='CONCESSA' and ce.status='IN_TRATTATIVA';
  return v_n;
end$$;
