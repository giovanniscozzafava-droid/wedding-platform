-- ============================================================================
-- Invito fornitore LEGATO A UN EVENTO (per condividere le foto con i colleghi).
-- ----------------------------------------------------------------------------
-- Oggi l'invito email (supplier_invites) è "di rete": una volta iscritto, il
-- capostipite deve aggiungerlo a mano al cerchio. Nuova regola: se l'invito è
-- legato a un EVENTO e l'evento è PASSATO, all'iscrizione il fornitore entra
-- SUBITO nel cerchio (confirmed=true), senza vidimazione degli sposi — così si
-- ritrova le foto condivise. Per gli eventi futuri resta il flusso a due passi.
-- ============================================================================

alter table public.supplier_invites
  add column if not exists entry_id uuid references public.calendar_entries(id) on delete set null,
  add column if not exists role_key text;

create or replace function public.accept_supplier_invite(p_token uuid)
returns boolean
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_invite supplier_invites%rowtype;
  v_past boolean;
  v_role text;
begin
  if auth.uid() is null then return false; end if;

  select * into v_invite from public.supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return false; end if;

  if v_invite.target_role = 'FORNITORE' then
    insert into public.collaborations (capostipite_id, fornitore_id, status)
    values (v_invite.capostipite_id, auth.uid(), 'PENDING')
    on conflict (capostipite_id, fornitore_id) do nothing;
  else
    insert into public.referrals (referrer_id, referee_id, referee_role, source)
    values (v_invite.capostipite_id, auth.uid(), v_invite.target_role::user_role, 'wp_invite_link')
    on conflict (referee_id) do nothing;
  end if;

  -- Invito legato a un EVENTO PASSATO → dentro al cerchio subito (niente vidimazione).
  if v_invite.entry_id is not null then
    select coalesce(date_to, date_from) < current_date into v_past
      from public.calendar_entries where id = v_invite.entry_id;
    if v_past then
      v_role := coalesce(nullif(v_invite.role_key, ''), (select subrole from public.profiles where id = auth.uid()), 'fornitore');
      insert into public.calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
      values (v_invite.entry_id, auth.uid(), v_role, true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    end if;
  end if;

  update public.supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return true;
end$function$;
