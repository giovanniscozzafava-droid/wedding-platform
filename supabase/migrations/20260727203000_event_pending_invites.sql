-- Cerchio evento: mostrare "inviata" sul ruolo per cui e' partito un invito email a un fornitore
-- non ancora iscritto (supplier_invites PENDING, legato a entry_id + role_key). Ritorna i role_key
-- con invito pendente, SOLO a chi fa parte dell'evento (owner/partecipante/admin).

create or replace function public.event_pending_invites(p_entry uuid)
returns table (role_key text)
language sql stable security definer set search_path = public as $$
  select distinct si.role_key
  from public.supplier_invites si
  where si.entry_id = p_entry
    and si.status = 'PENDING'
    and si.role_key is not null
    and (
      public.is_admin()
      or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
      or exists (select 1 from public.calendar_entry_participants p where p.entry_id = p_entry and p.user_id = auth.uid())
    );
$$;
revoke all on function public.event_pending_invites(uuid) from anon, public;
grant execute on function public.event_pending_invites(uuid) to authenticated;
