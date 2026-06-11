-- Logica di ingresso nel cerchio differenziata per tempo dell'evento:
--  • EVENTO FUTURO (collaborazione) → "suggerisci" crea una RICHIESTA che gli sposi
--    devono ACCETTARE con una firma leggera; solo allora il fornitore entra.
--  • EVENTO PASSATO (solo foto) → aggiunta DIRETTA al cerchio (accesso alle foto).

create table if not exists public.event_circle_suggestions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  role_key text,
  suggested_by uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  signed_by uuid, signed_name text, signed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entry_id, supplier_id)
);
alter table public.event_circle_suggestions enable row level security;

-- lettura: sposi, membri del cerchio, il fornitore suggerito, admin. Scrittura: solo via RPC.
drop policy if exists ecs_read on public.event_circle_suggestions;
create policy ecs_read on public.event_circle_suggestions for select using (
  public.is_wedding_couple(entry_id) or public._photo_circle_member(entry_id)
  or supplier_id = auth.uid() or public.is_admin()
);

-- suggerisci: futuro → richiesta pendente; passato → aggiunta diretta.
create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text; v_future boolean;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'not_a_supplier');
  end if;
  select subrole into v_sub from public.profiles where id = p_supplier;
  select coalesce(date_to, date_from) >= current_date into v_future from public.calendar_entries where id = p_entry;

  if v_future then
    -- FUTURO: richiesta da far accettare agli sposi (con firma leggera)
    insert into public.event_circle_suggestions(entry_id, supplier_id, role_key, suggested_by, status)
    values (p_entry, p_supplier, v_sub, auth.uid(), 'PENDING')
    on conflict (entry_id, supplier_id) do update
      set status = 'PENDING', suggested_by = excluded.suggested_by, role_key = excluded.role_key
      where public.event_circle_suggestions.status <> 'ACCEPTED';
    return jsonb_build_object('ok', true, 'pending', true);
  end if;

  -- PASSATO: aggiunta diretta (accesso alle foto)
  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'pending', false, 'subrole', v_sub);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid) to authenticated;

-- gli sposi (o admin) rispondono alla richiesta: accettano (firma leggera) o rifiutano.
create or replace function public.respond_circle_suggestion(p_suggestion uuid, p_accept boolean, p_signed_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid;
begin
  select entry_id, supplier_id into v_entry, v_sup
    from public.event_circle_suggestions where id = p_suggestion and status = 'PENDING';
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_accept then
    if coalesce(btrim(p_signed_name), '') = '' then return jsonb_build_object('error', 'signature_required'); end if;
    begin
      insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, v_sup, 'fornitore', true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    exception when others then
      return jsonb_build_object('error', sqlerrm);
    end;
    update public.event_circle_suggestions
       set status = 'ACCEPTED', signed_by = auth.uid(), signed_name = p_signed_name, signed_at = now()
     where id = p_suggestion;
  else
    update public.event_circle_suggestions set status = 'REJECTED' where id = p_suggestion;
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_circle_suggestion(uuid, boolean, text) to authenticated;

-- elenco richieste (per gli sposi) con nome del fornitore e di chi ha suggerito.
create or replace function public.list_circle_suggestions(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.is_wedding_couple(p_entry) or public._photo_circle_member(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'role_key', s.role_key, 'status', s.status,
           'supplier_name', coalesce(nullif(ps.business_name,''), ps.full_name, 'Fornitore'),
           'suggested_by_name', coalesce(nullif(pb.business_name,''), pb.full_name, 'Un membro')
         ) order by s.created_at desc), '[]'::jsonb) into v
  from public.event_circle_suggestions s
  join public.profiles ps on ps.id = s.supplier_id
  left join public.profiles pb on pb.id = s.suggested_by
  where s.entry_id = p_entry and s.status = 'PENDING';
  return jsonb_build_object('suggestions', v);
end$$;
grant execute on function public.list_circle_suggestions(uuid) to authenticated;
