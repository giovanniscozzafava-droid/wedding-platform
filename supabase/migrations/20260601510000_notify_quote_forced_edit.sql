-- ============================================================================
-- Notifica in-app alla coppia quando il WP fa "Modifica forzata" preventivo
-- ----------------------------------------------------------------------------
-- Bug dogfood: il WP modifica forzatamente un preventivo accettato (con
-- motivo), la coppia riceve email Resend ma NESSUNA notifica in-app.
-- Fix: RPC notify_couple_quote_forced_edit(p_quote_id, p_reason) che inserisce
-- una notifica per ogni membro coppia del wedding collegato al quote.
-- ============================================================================

create or replace function public.notify_couple_quote_forced_edit(
  p_quote_id uuid,
  p_reason text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_owner uuid;
  v_quote_title text;
  v_revision int;
  v_count int := 0;
  v_couple_user uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select q.title, q.revision, q.owner_id into v_quote_title, v_revision, v_owner
    from public.quotes q where q.id = p_quote_id;
  if v_quote_title is null then return 0; end if;

  -- Solo il proprietario del quote puo` triggerare la notifica
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'not_quote_owner';
  end if;

  select ce.id into v_entry_id
    from public.calendar_entries ce
   where ce.quote_id = p_quote_id
   limit 1;

  if v_entry_id is null then return 0; end if;

  -- Inserisce/aggiorna una notifica per ciascun membro della coppia
  for v_couple_user in
    select m.user_id
      from public.wedding_couple_members m
     where m.entry_id = v_entry_id
  loop
    insert into public.notifiche (
      destinatario_id, evento_id, tipo, titolo, descrizione,
      link_action, owner_della_mossa, stato, priorita
    )
    values (
      v_couple_user,
      v_entry_id,
      'PREVENTIVO_MODIFICATO_FORZATAMENTE',
      concat('Preventivo aggiornato · rev. v', v_revision),
      concat('Il tuo wedding planner ha modificato il preventivo "', v_quote_title, '". Motivo: ', coalesce(p_reason, '—')),
      '/couple',
      v_owner,
      'PENDING',
      8
    )
    on conflict (destinatario_id, evento_id, tipo) do update
      set titolo      = excluded.titolo,
          descrizione = excluded.descrizione,
          stato       = 'PENDING',
          creato_il   = now(),
          letto_il    = null,
          priorita    = excluded.priorita;
    v_count := v_count + 1;
  end loop;

  return v_count;
end$$;

grant execute on function public.notify_couple_quote_forced_edit(uuid, text) to authenticated;

comment on function public.notify_couple_quote_forced_edit(uuid, text) is
  'Inserisce notifica in-app PREVENTIVO_MODIFICATO_FORZATAMENTE per i membri della coppia del wedding collegato al quote. Solo il proprietario del quote (o admin) puo` chiamarla.';
