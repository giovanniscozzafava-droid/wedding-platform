-- FASE 1.4 — Audit log
-- Tabella append-only per tracciare INSERT/UPDATE/DELETE sulle entita` critiche.
-- Lettura riservata agli admin.

create table if not exists public.audit_log (
  id              bigint generated always as identity primary key,
  tabella         text not null,
  record_id       uuid,
  operazione      text not null check (operazione in ('INSERT','UPDATE','DELETE')),
  valori_prima    jsonb,
  valori_dopo     jsonb,
  eseguito_da     uuid,
  eseguito_il     timestamptz not null default now()
);

comment on table public.audit_log is
  'Audit log append-only su entita` critiche (calendar_entries, quotes, quote_items, event_guests, event_tables). Letture: solo admin.';

create index if not exists idx_audit_log_tabella_record
  on public.audit_log(tabella, record_id, eseguito_il desc);
create index if not exists idx_audit_log_eseguito_da
  on public.audit_log(eseguito_da)
  where eseguito_da is not null;
create index if not exists idx_audit_log_eseguito_il
  on public.audit_log(eseguito_il desc);

-- Funzione generica di audit. security definer per bypassare RLS in scrittura
-- (la lettura resta protetta dalla policy admin-only sotto).
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id  uuid;
  v_prima      jsonb;
  v_dopo       jsonb;
  v_user       uuid;
begin
  begin
    v_user := auth.uid();
  exception when others then
    v_user := null;
  end;

  if tg_op = 'DELETE' then
    v_prima := to_jsonb(old);
    v_dopo  := null;
    begin v_record_id := (old).id::uuid; exception when others then v_record_id := null; end;
  elsif tg_op = 'UPDATE' then
    v_prima := to_jsonb(old);
    v_dopo  := to_jsonb(new);
    begin v_record_id := (new).id::uuid; exception when others then v_record_id := null; end;
  else
    v_prima := null;
    v_dopo  := to_jsonb(new);
    begin v_record_id := (new).id::uuid; exception when others then v_record_id := null; end;
  end if;

  insert into public.audit_log(
    tabella, record_id, operazione, valori_prima, valori_dopo, eseguito_da
  ) values (
    tg_table_name, v_record_id, tg_op, v_prima, v_dopo, v_user
  );

  return null; -- after trigger
end;
$$;

comment on function public.fn_audit() is
  'Trigger AFTER generico: registra le mutazioni della tabella corrente nell''audit_log.';

-- Attacchiamo il trigger AFTER INSERT/UPDATE/DELETE su ciascuna tabella sensibile.
do $$
declare
  t text;
begin
  foreach t in array array[
    'calendar_entries',
    'quotes',
    'quote_items',
    'event_guests',
    'event_tables'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
      execute format(
        'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
           for each row execute function public.fn_audit()',
        t
      );
    end if;
  end loop;
end$$;

-- RLS: lettura riservata agli admin. Inserimenti solo via trigger SECURITY DEFINER:
-- nessuna policy di INSERT diretta -> deny by default (RLS attiva).
alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select
  using (public.is_admin());

-- Niente INSERT/UPDATE/DELETE da client: la tabella e` append-only e si popola
-- solo via fn_audit() che gira come security definer.
