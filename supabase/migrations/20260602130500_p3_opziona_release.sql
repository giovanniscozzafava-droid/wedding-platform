-- ============================================================================
-- P3 — "Opziona data" + rilascio disponibilità su regressione preventivo
-- ============================================================================

-- 1) Opzioni data (data tenuta per N giorni in attesa di conferma)
create table if not exists public.supplier_date_options (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references public.profiles(id) on delete cascade,
  supplier_client_id uuid references public.supplier_clients(id) on delete set null,
  supplier_lead_id   uuid references public.supplier_leads(id) on delete set null,
  date_from          date not null,
  date_to            date,
  expires_at         timestamptz not null,
  reason             text,
  status             text not null default 'OPTIONED' check (status in ('OPTIONED','CONFIRMED','RELEASED','EXPIRED')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_date_options_supplier on public.supplier_date_options(supplier_id, status, expires_at);

drop trigger if exists trg_date_options_upd on public.supplier_date_options;
create trigger trg_date_options_upd before update on public.supplier_date_options
  for each row execute function public.set_updated_at();

alter table public.supplier_date_options enable row level security;
drop policy if exists "date_options_own" on public.supplier_date_options;
create policy "date_options_own" on public.supplier_date_options
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());
drop policy if exists "date_options_admin" on public.supplier_date_options;
create policy "date_options_admin" on public.supplier_date_options
  for all using (is_admin()) with check (is_admin());

-- RPC opziona data (owner fornitore)
create or replace function public.opziona_data(
  p_date_from date, p_date_to date default null, p_days int default 7,
  p_reason text default null, p_client_id uuid default null, p_lead_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; d date;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  insert into public.supplier_date_options(supplier_id, supplier_client_id, supplier_lead_id, date_from, date_to, expires_at, reason)
  values (v_uid, p_client_id, p_lead_id, p_date_from, coalesce(p_date_to, p_date_from),
          now() + make_interval(days => greatest(1, coalesce(p_days,7))), p_reason)
  returning id into v_id;
  -- Segna le date come OPTIONED se attualmente libere
  d := p_date_from;
  while d <= coalesce(p_date_to, p_date_from) loop
    insert into public.supplier_availability(fornitore_id, date, status, notes)
      values (v_uid, d, 'OPTIONED', coalesce(p_reason,'Data opzionata'))
    on conflict (fornitore_id, date) do update
      set status = case when supplier_availability.status = 'AVAILABLE' then 'OPTIONED'::supplier_avail_status
                        else supplier_availability.status end,
          notes = coalesce(excluded.notes, supplier_availability.notes);
    d := d + 1;
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.opziona_data(date, date, int, text, uuid, uuid) to authenticated;

-- 2) Rilascio disponibilità su regressione del preventivo:
--    quando un quote esce da ACCETTATO/CONVERTITO e NON c'è contratto FIRMATO
--    per quel quote, libera le date BUSY agganciate (per fornitore diretto:
--    owner=fornitore, date=event_date) se non esistono altri blocchi attivi.
create or replace function public.release_availability_on_quote_regression()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_has_signed boolean;
begin
  if (old.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
     and (new.status not in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
     and new.event_date is not null then
    select exists(select 1 from public.contracts c where c.quote_id = new.id and c.status = 'FIRMATO')
      into v_has_signed;
    if not v_has_signed then
      -- libera la data del fornitore-owner se non c'è un altro quote ACCETTATO
      -- o contratto FIRMATO sulla stessa data
      update public.supplier_availability sa
         set status = 'AVAILABLE'::supplier_avail_status,
             notes = 'Liberata: trattativa non confermata', updated_at = now()
       where sa.fornitore_id = new.owner_id
         and sa.date = new.event_date
         and sa.status in ('BUSY','BLOCKED_BY_ACCEPTED_QUOTE','OPTIONED','TENTATIVE')
         and not exists (
           select 1 from public.quotes q2
            where q2.owner_id = new.owner_id and q2.event_date = new.event_date
              and q2.id <> new.id and q2.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
         and not exists (
           select 1 from public.contracts c2
            where c2.owner_id = new.owner_id and c2.status = 'FIRMATO'
              and exists (select 1 from public.calendar_entries ce where ce.id = c2.entry_id and ce.date_from = new.event_date));
      perform public.log_access('quotes', new.id::text, 'WRITE', jsonb_build_object('op','availability_released_on_regression'));
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_release_avail_on_regression on public.quotes;
create trigger trg_release_avail_on_regression after update of status on public.quotes
  for each row execute function public.release_availability_on_quote_regression();

comment on function public.opziona_data(date, date, int, text, uuid, uuid) is
  'Opziona una data (o intervallo) per N giorni: crea supplier_date_options + segna OPTIONED le date libere.';
comment on function public.release_availability_on_quote_regression() is
  'Libera la disponibilità del fornitore quando un preventivo regredisce da ACCETTATO senza contratto firmato, se non esistono altri blocchi attivi sulla stessa data.';
