-- Il cerchio NON è chiuso: anche i membri del cerchio (fornitori) — non solo l'owner
-- dell'evento — possono aggiungere ruoli. Prima il gate era owner-only → un fornitore
-- non poteva ampliare il cerchio. Ora: membro del cerchio / sposi / owner / admin.
create or replace function public.set_event_ring_role(p_entry uuid, p_role_key text, p_active boolean, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;
  insert into public.event_ring_roles(entry_id, role_key, label, active, sort_order)
    values (p_entry, p_role_key, coalesce(p_label, initcap(replace(p_role_key,'_',' '))), p_active,
            coalesce((select max(sort_order)+1 from public.event_ring_roles where entry_id = p_entry), 99))
    on conflict (entry_id, role_key) do update set active = excluded.active,
            label = coalesce(excluded.label, public.event_ring_roles.label);
  return jsonb_build_object('ok', true);
end$$;
