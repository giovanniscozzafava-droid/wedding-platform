-- ============================================================================
-- Staff dell'agenzia: accesso al pannello Assistenza SENZA diventare ADMIN
-- globale. Flag dedicato `is_support_staff` su profiles, così un utente può
-- restare WEDDING_PLANNER/FORNITORE e gestire comunque i ticket.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_support_staff boolean not null default false;

-- True se l'utente corrente è staff di supporto (o admin pieno).
create or replace function public.is_support_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_support_staff from public.profiles where id = auth.uid()), false)
         or is_admin();
$$;
grant execute on function public.is_support_staff() to authenticated;

-- ── Ricablo le policy/funzioni dell'assistenza su is_support_staff() ─────────
drop policy if exists "support_tickets_select_own_or_admin" on public.support_tickets;
create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or is_support_staff());

drop policy if exists "support_tickets_update_admin" on public.support_tickets;
create policy "support_tickets_update_staff" on public.support_tickets
  for update using (is_support_staff());

drop policy if exists "ticket_msg_select" on public.support_ticket_messages;
create policy "ticket_msg_select" on public.support_ticket_messages
  for select using (
    exists (select 1 from public.support_tickets t
            where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))
  );

drop policy if exists "ticket_msg_insert" on public.support_ticket_messages;
create policy "ticket_msg_insert" on public.support_ticket_messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.support_tickets t
                where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))
  );

-- is_staff del messaggio segue il flag (non più solo admin).
create or replace function public.on_ticket_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_staff := is_support_staff();
  update public.support_tickets
     set last_activity_at = now(),
         status = case
                    when is_support_staff() and status = 'APERTO' then 'IN_LAVORAZIONE'
                    when not is_support_staff() and status = 'CHIUSO' then 'APERTO'
                    else status
                  end
   where id = new.ticket_id;
  return new;
end$$;

-- ── Promuovo Elisabetta a staff di supporto (resta WEDDING_PLANNER) ─────────
update public.profiles p
   set is_support_staff = true
  from auth.users u
 where u.id = p.id and u.email = 'elisabettacitraro1998@gmail.com';
