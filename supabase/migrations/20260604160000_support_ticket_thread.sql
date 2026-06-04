-- ============================================================================
-- Conversazione del ticket di assistenza (thread) + dashboard staff.
-- Il primo messaggio è support_tickets.message; le repliche vivono qui.
-- ----------------------------------------------------------------------------

alter table public.support_tickets
  add column if not exists assigned_to uuid references auth.users(id),
  add column if not exists last_activity_at timestamptz not null default now();

create table if not exists public.support_ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  is_staff   boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_messages on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

-- Visibile al proprietario del ticket o all'admin.
drop policy if exists "ticket_msg_select" on public.support_ticket_messages;
create policy "ticket_msg_select" on public.support_ticket_messages
  for select using (
    exists (select 1 from public.support_tickets t
            where t.id = ticket_id and (t.user_id = auth.uid() or is_admin()))
  );

-- Scrive il proprietario del ticket o l'admin (solo a proprio nome).
drop policy if exists "ticket_msg_insert" on public.support_ticket_messages;
create policy "ticket_msg_insert" on public.support_ticket_messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.support_tickets t
                where t.id = ticket_id and (t.user_id = auth.uid() or is_admin()))
  );

-- is_staff coerente col ruolo + aggiorna stato/attività del ticket.
create or replace function public.on_ticket_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_staff := is_admin();
  update public.support_tickets
     set last_activity_at = now(),
         status = case
                    when is_admin() and status = 'APERTO' then 'IN_LAVORAZIONE'
                    when not is_admin() and status = 'CHIUSO' then 'APERTO' -- riapre se il cliente ribatte
                    else status
                  end
   where id = new.ticket_id;
  return new;
end$$;

drop trigger if exists trg_on_ticket_message on public.support_ticket_messages;
create trigger trg_on_ticket_message
  before insert on public.support_ticket_messages
  for each row execute function public.on_ticket_message();
