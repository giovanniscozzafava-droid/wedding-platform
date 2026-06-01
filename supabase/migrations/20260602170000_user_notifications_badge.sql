-- ============================================================================
-- Notifiche utente + badge rosso: quando il cliente firma/accetta, il
-- professionista (owner) deve vederlo subito. Tabella generica indipendente
-- da calendar_entries (funziona anche per i flussi diretti fornitore→cliente).
-- ============================================================================

create table if not exists public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  ref_id     uuid,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_notif_unread on public.user_notifications(user_id, read_at, created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "user_notif_own" on public.user_notifications;
create policy "user_notif_own" on public.user_notifications
  for select using (user_id = auth.uid() or is_admin());
drop policy if exists "user_notif_update_own" on public.user_notifications;
create policy "user_notif_update_own" on public.user_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Helper interno per inserire (SECURITY DEFINER, usato dai trigger)
create or replace function public.push_user_notification(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.user_notifications(user_id, type, title, body, link, ref_id)
  values (p_user, p_type, p_title, p_body, p_link, p_ref);
end$$;

-- Trigger: preventivo ACCETTATO → notifica owner
create or replace function public.notify_on_quote_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACCETTATO' and (old.status is distinct from 'ACCETTATO') then
    perform public.push_user_notification(new.owner_id, 'QUOTE_ACCEPTED',
      'Preventivo accettato',
      coalesce(new.client_name,'Il cliente') || ' ha accettato "' || coalesce(new.title,'il preventivo') || '"',
      '/quotes/' || new.id::text, new.id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_quote_accepted on public.quotes;
create trigger trg_notify_quote_accepted after update of status on public.quotes
  for each row execute function public.notify_on_quote_accepted();

-- Trigger: contratto FIRMATO → notifica owner
create or replace function public.notify_on_contract_signed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') then
    perform public.push_user_notification(new.owner_id, 'CONTRACT_SIGNED',
      'Contratto firmato',
      coalesce(new.client_name,'Il cliente') || ' ha firmato "' || coalesce(new.title,'il contratto') || '"',
      '/contracts', new.id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_contract_signed on public.contracts;
create trigger trg_notify_contract_signed after update of status on public.contracts
  for each row execute function public.notify_on_contract_signed();

-- Trigger: nuova richiesta diretta (supplier_leads) → notifica fornitore
create or replace function public.notify_on_supplier_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_user_notification(new.supplier_id, 'NEW_LEAD',
    'Nuova richiesta diretta',
    'Hai ricevuto una nuova richiesta per ' || coalesce(new.event_kind,'un evento'),
    '/richieste', new.id);
  return new;
end$$;
drop trigger if exists trg_notify_supplier_lead on public.supplier_leads;
create trigger trg_notify_supplier_lead after insert on public.supplier_leads
  for each row execute function public.notify_on_supplier_lead();

-- Conteggio non lette
create or replace function public.unread_notifications_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.user_notifications where user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.unread_notifications_count() to authenticated;

-- Lista recenti
create or replace function public.list_notifications(p_limit int default 20)
returns setof public.user_notifications language sql stable security definer set search_path = public as $$
  select * from public.user_notifications where user_id = auth.uid()
  order by created_at desc limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.list_notifications(int) to authenticated;

-- Segna lette
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update public.user_notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any(p_ids));
end$$;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

comment on table public.user_notifications is 'Notifiche per professionista (badge rosso): preventivo accettato, contratto firmato, nuova richiesta.';
