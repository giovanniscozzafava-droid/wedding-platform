-- "Suggerisci fornitore" dal cerchio dell'evento.
-- Un membro del cerchio (o gli sposi) sceglie un fornitore: questo entra SUBITO
-- nell'evento come partecipante → copre il ruolo nell'anello e ottiene accesso alla
-- dashboard evento (organizzazione + foto, niente preventivi/contratti/pagamenti).
-- Gate: solo chi è già nel cerchio, gli sposi, o admin.

-- Elenco fornitori selezionabili: quelli del ruolo richiesto in cima ("consigliato"),
-- marca chi è già nell'evento. SECURITY DEFINER per non dipendere dalla RLS di profiles.
create or replace function public.list_suggestable_suppliers(p_entry uuid, p_role_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select coalesce(jsonb_agg(x order by x.matches desc, x.name), '[]'::jsonb) into v
  from (
    select pr.id,
           coalesce(nullif(pr.business_name, ''), pr.full_name, 'Fornitore') as name,
           pr.subrole,
           (p_role_key is not null and pr.subrole = p_role_key) as matches,
           exists (select 1 from public.calendar_entry_participants p
                   where p.entry_id = p_entry and p.user_id = pr.id) as in_event
    from public.profiles pr
    where pr.role = 'FORNITORE'
  ) x;
  return jsonb_build_object('suppliers', v);
end$$;
grant execute on function public.list_suggestable_suppliers(uuid, text) to authenticated;

-- Aggiunge il fornitore all'evento (partecipante confermato). Idempotente.
create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'not_a_supplier');
  end if;
  select subrole into v_sub from public.profiles where id = p_supplier;
  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    -- es. trigger block_busy: il fornitore è occupato in quella data
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'subrole', v_sub);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid) to authenticated;
