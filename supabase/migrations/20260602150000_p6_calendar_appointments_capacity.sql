-- ============================================================================
-- P6 — Calendario a orari, appuntamenti multipli/giorno, agenda personale,
--      blocchi/vacanze, capacità giornaliera, contratto suggerito + disclaimer
-- ----------------------------------------------------------------------------
-- Molti fornitori gestiscono PIÙ appuntamenti in un giorno (parrucchiere: 2
-- spose; fiorista: più eventi). La disponibilità non è quindi binaria per
-- giorno: introduciamo appuntamenti a orari + capacità giornaliera. Il giorno
-- diventa "Occupato" solo quando si raggiunge la capacità.
-- ============================================================================

-- Capacità giornaliera del fornitore (null = illimitata)
alter table public.profiles add column if not exists daily_capacity int default 1;
comment on column public.profiles.daily_capacity is
  'Quanti eventi/appuntamenti il fornitore può gestire in un giorno. 1 = esclusivo; >1 = multiplo; null = illimitato.';

-- Appuntamenti / agenda / blocchi (time-aware)
create table if not exists public.supplier_appointments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'APPUNTAMENTO'
               check (kind in ('EVENTO','APPUNTAMENTO','PERSONALE','BLOCCO','VACANZA','TODO')),
  title        text not null,
  date         date not null,
  end_date     date,                 -- per blocchi/vacanze multi-giorno
  start_time   time,
  end_time     time,
  all_day      boolean not null default false,
  location     text,
  notes        text,
  color        text,
  supplier_client_id uuid references public.supplier_clients(id) on delete set null,
  source_quote_id    uuid references public.quotes(id) on delete set null,
  source_contract_id uuid references public.contracts(id) on delete set null,
  done         boolean not null default false,  -- per TODO
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_appointments_owner_date on public.supplier_appointments(owner_id, date);
create index if not exists idx_appointments_quote on public.supplier_appointments(source_quote_id) where source_quote_id is not null;

drop trigger if exists trg_appointments_upd on public.supplier_appointments;
create trigger trg_appointments_upd before update on public.supplier_appointments
  for each row execute function public.set_updated_at();

alter table public.supplier_appointments enable row level security;
drop policy if exists "appointments_own" on public.supplier_appointments;
create policy "appointments_own" on public.supplier_appointments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "appointments_admin" on public.supplier_appointments;
create policy "appointments_admin" on public.supplier_appointments
  for all using (is_admin()) with check (is_admin());

-- Ricalcolo della disponibilità giornaliera in base a capacità + appuntamenti
create or replace function public.recompute_day_availability(p_owner uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap int; v_events int; v_blocked boolean;
begin
  select coalesce(daily_capacity, 999) into v_cap from public.profiles where id = p_owner;
  if v_cap is null then v_cap := 999; end if;
  -- Blocco esplicito (BLOCCO/VACANZA) → giorno non disponibile a prescindere
  select exists(select 1 from public.supplier_appointments
                 where owner_id = p_owner and kind in ('BLOCCO','VACANZA')
                   and p_date between date and coalesce(end_date, date)) into v_blocked;
  -- Eventi "che occupano" (EVENTO + APPUNTAMENTO verso clienti)
  select count(*) into v_events from public.supplier_appointments
    where owner_id = p_owner and date = p_date and kind in ('EVENTO','APPUNTAMENTO');

  if v_blocked then
    insert into public.supplier_availability(fornitore_id, date, status, notes)
      values (p_owner, p_date, 'UNAVAILABLE', 'Blocco/vacanza')
    on conflict (fornitore_id, date) do update set status='UNAVAILABLE'::supplier_avail_status, notes='Blocco/vacanza';
  elsif v_events >= v_cap then
    insert into public.supplier_availability(fornitore_id, date, status, notes)
      values (p_owner, p_date, 'BUSY', 'Capacità giornaliera raggiunta')
    on conflict (fornitore_id, date) do update set status='BUSY'::supplier_avail_status;
  else
    -- Sotto capacità: il giorno resta disponibile (slot liberi) se non c'è blocco manuale
    update public.supplier_availability
       set status = 'AVAILABLE'::supplier_avail_status
     where fornitore_id = p_owner and date = p_date
       and status in ('BUSY','TENTATIVE');
  end if;
end$$;

-- Trigger: ogni modifica di un appuntamento ricalcola il giorno
create or replace function public.appointment_recompute_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_day_availability(old.owner_id, old.date);
    return old;
  end if;
  perform public.recompute_day_availability(new.owner_id, new.date);
  if tg_op = 'UPDATE' and old.date <> new.date then
    perform public.recompute_day_availability(old.owner_id, old.date);
  end if;
  return new;
end$$;
drop trigger if exists trg_appointment_recompute on public.supplier_appointments;
create trigger trg_appointment_recompute after insert or update or delete on public.supplier_appointments
  for each row execute function public.appointment_recompute_trigger();

-- ── Auto-block reso capacity-aware: registra un appuntamento EVENTO e lascia
--    al recompute la decisione sul giorno (multiplo/giorno supportato). ───────
create or replace function auto_block_availability_from_quote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.event_date is null then return NEW; end if;

  -- Direct quote: owner_id è il fornitore.
  if NEW.direct_client_id is not null then
    if NEW.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
      insert into public.supplier_appointments(owner_id, kind, title, date, supplier_client_id, source_quote_id, notes)
      select NEW.owner_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.direct_client_id, NEW.id, 'Da preventivo accettato'
      where not exists (select 1 from public.supplier_appointments where source_quote_id = NEW.id);
      perform public.recompute_day_availability(NEW.owner_id, NEW.event_date);
    elsif NEW.status = 'INVIATO' then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'TENTATIVE', 'Preventivo diretto INVIATO: ' || coalesce(NEW.title,''))
      on conflict (fornitore_id, date) do nothing;
    end if;
  end if;

  -- Quote dentro wedding: blocca i fornitori delle voci (capacity-aware per ognuno)
  if NEW.direct_client_id is null and NEW.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
    insert into public.supplier_appointments(owner_id, kind, title, date, source_quote_id, notes)
    select distinct qi.supplier_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.id, 'Voce preventivo accettato'
      from quote_items qi
     where qi.quote_id = NEW.id and qi.supplier_id is not null
       and not exists (select 1 from public.supplier_appointments a where a.source_quote_id = NEW.id and a.owner_id = qi.supplier_id);
    perform public.recompute_day_availability(qi.supplier_id, NEW.event_date)
      from (select distinct supplier_id from quote_items where quote_id = NEW.id and supplier_id is not null) qi;
  end if;

  return NEW;
end$$;

comment on table public.supplier_appointments is
  'Agenda del fornitore: eventi (da preventivi), appuntamenti a orari, voci personali, blocchi/vacanze, TODO. Più appuntamenti per giorno.';

-- ── Contratto suggerito + modello per subrole + disclaimer legale ───────────
create table if not exists public.suggested_contract_templates (
  id          uuid primary key default gen_random_uuid(),
  subrole     text not null unique,
  title       text not null,
  sections    jsonb not null default '[]'::jsonb,
  legal_disclaimer text not null,
  version     int not null default 1,
  updated_at  timestamptz not null default now()
);
alter table public.suggested_contract_templates enable row level security;
drop policy if exists "suggested_tpl_read" on public.suggested_contract_templates;
create policy "suggested_tpl_read" on public.suggested_contract_templates for select using (true);
drop policy if exists "suggested_tpl_admin" on public.suggested_contract_templates;
create policy "suggested_tpl_admin" on public.suggested_contract_templates for all using (is_admin()) with check (is_admin());

-- Disclaimer legale standard (non siamo avvocati)
do $$
declare
  v_disc text := 'AVVISO IMPORTANTE: Planfully non è uno studio legale e non fornisce consulenza legale. Questo è un modello generico fornito a scopo organizzativo. Si raccomanda vivamente di far revisionare e redigere il contratto definitivo da un avvocato di fiducia, per adeguarlo al caso concreto e alla normativa vigente.';
  r record;
  v_title text;
begin
  for r in select distinct subrole from public.profiles where role='FORNITORE' and subrole is not null loop
    v_title := 'Modello contratto — ' || initcap(replace(r.subrole,'_',' '));
    insert into public.suggested_contract_templates(subrole, title, sections, legal_disclaimer)
    values (r.subrole, v_title,
      jsonb_build_array(
        jsonb_build_object('title','Premesse','body','Tra il Fornitore e il Committente, per il servizio di '||replace(r.subrole,'_',' ')||' in occasione dell''evento indicato.'),
        jsonb_build_object('title','Oggetto','body','Descrizione del servizio, data, luogo, orari e prestazioni incluse.'),
        jsonb_build_object('title','Corrispettivo','body','Importo, modalità e tempi di pagamento (es. acconto 30%, saldo a fine servizio).'),
        jsonb_build_object('title','Recesso e annullamento','body','Condizioni di recesso, penali e gestione cambio data.'),
        jsonb_build_object('title','Forza maggiore','body','Eventi imprevedibili che impediscono l''esecuzione.'),
        jsonb_build_object('title','Privacy e immagini','body','Trattamento dati (GDPR) ed eventuale uso delle immagini.'),
        jsonb_build_object('title','Foro competente','body','Foro e legge applicabile.')
      ), v_disc)
    on conflict (subrole) do update set title=excluded.title, sections=excluded.sections, legal_disclaimer=excluded.legal_disclaimer, updated_at=now();
  end loop;
end$$;

-- Clona il modello suggerito nei template del fornitore
create or replace function public.clone_suggested_contract_template(p_subrole text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sub text; v_tpl public.suggested_contract_templates%rowtype; v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(p_subrole, subrole) into v_sub from public.profiles where id = v_uid;
  select * into v_tpl from public.suggested_contract_templates where subrole = v_sub;
  if v_tpl.id is null then return jsonb_build_object('error','no_template_for_subrole'); end if;
  insert into public.supplier_contract_templates(fornitore_id, title, category, sections, is_default)
  values (v_uid, v_tpl.title, v_sub, v_tpl.sections, false)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'template_id', v_id, 'legal_disclaimer', v_tpl.legal_disclaimer);
end$$;
grant execute on function public.clone_suggested_contract_template(text) to authenticated;

comment on table public.suggested_contract_templates is
  'Modelli di contratto suggeriti per subrole, con disclaimer legale (non siamo avvocati). Clonabili nei template del fornitore.';
