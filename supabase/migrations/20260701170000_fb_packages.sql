-- Pacchetti "tutto incluso" (percorsi) multipli per location. Ogni piatto (fb_menu_items) può
-- essere inserito in uno o più pacchetti. Base = prezzo/coperto; le voci possono essere incluse,
-- integrazioni opzionali (+surcharge a scelta) o obbligatorie (+surcharge sempre). Da qui la
-- calcolatrice del prezzo per intero buffet (escludi voci / integra add-on).

create table if not exists public.fb_packages (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  price_per_guest numeric(10,2) not null default 0,
  notes           text,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
alter table public.fb_packages enable row level security;
drop policy if exists fb_packages_owner on public.fb_packages;
create policy fb_packages_owner on public.fb_packages for all
  using (location_id = auth.uid()) with check (location_id = auth.uid());

create table if not exists public.fb_package_items (
  id           uuid primary key default gen_random_uuid(),
  package_id   uuid not null references public.fb_packages(id) on delete cascade,
  menu_item_id uuid not null references public.fb_menu_items(id) on delete cascade,
  role         text not null default 'INCLUSO' check (role in ('INCLUSO','OPZIONALE','OBBLIGATORIO')),
  surcharge    numeric(10,2) not null default 0,
  created_at   timestamptz not null default now(),
  unique (package_id, menu_item_id)
);
alter table public.fb_package_items enable row level security;
drop policy if exists fb_package_items_owner on public.fb_package_items;
create policy fb_package_items_owner on public.fb_package_items for all
  using (exists (select 1 from public.fb_packages p where p.id = package_id and p.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_packages p where p.id = package_id and p.location_id = auth.uid()));

-- Vista pacchetti dell'evento (la location è l'owner dell'evento): pacchetti + voci con nome piatto.
create or replace function public.fb_event_packages(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  return jsonb_build_object('ok', true, 'pacchetti', coalesce((
    select jsonb_agg(jsonb_build_object('id', pk.id, 'nome', pk.name, 'prezzo', pk.price_per_guest, 'note', pk.notes,
      'voci', coalesce((select jsonb_agg(jsonb_build_object('menu_item_id', pi.menu_item_id, 'piatto', rc.name,
                'portata', mi.course, 'role', pi.role, 'surcharge', pi.surcharge) order by mi.course, mi.sort_order, rc.name)
              from public.fb_package_items pi
              join public.fb_menu_items mi on mi.id = pi.menu_item_id
              join public.fb_recipes rc on rc.id = mi.recipe_id
              where pi.package_id = pk.id), '[]'::jsonb))
      order by pk.sort_order, pk.name)
    from public.fb_packages pk where pk.location_id = v_owner and pk.is_active), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_packages(uuid) to authenticated;

-- Upsert pacchetto (owner) — id null = nuovo.
create or replace function public.fb_package_save(p_id uuid, p_name text, p_price numeric, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then return jsonb_build_object('error','forbidden'); end if;
  if p_id is null then
    insert into public.fb_packages(location_id, name, price_per_guest, notes)
      values (auth.uid(), coalesce(nullif(btrim(p_name),''),'Pacchetto'), coalesce(p_price,0), p_notes)
      returning id into v_id;
  else
    update public.fb_packages set name = coalesce(nullif(btrim(p_name),''), name),
           price_per_guest = coalesce(p_price, price_per_guest), notes = p_notes
     where id = p_id and location_id = auth.uid() returning id into v_id;
    if v_id is null then return jsonb_build_object('error','not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.fb_package_save(uuid, text, numeric, text) to authenticated;

-- Assegna/aggiorna/rimuove un piatto in un pacchetto (owner). p_role null = rimuovi.
create or replace function public.fb_package_set_item(p_package_id uuid, p_menu_item_id uuid, p_role text default 'INCLUSO', p_surcharge numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.fb_packages where id = p_package_id and location_id = auth.uid()) then
    return jsonb_build_object('error','forbidden'); end if;
  if p_role is null then
    delete from public.fb_package_items where package_id = p_package_id and menu_item_id = p_menu_item_id;
    return jsonb_build_object('ok', true, 'removed', true);
  end if;
  if p_role not in ('INCLUSO','OPZIONALE','OBBLIGATORIO') then return jsonb_build_object('error','bad_role'); end if;
  insert into public.fb_package_items(package_id, menu_item_id, role, surcharge)
    values (p_package_id, p_menu_item_id, p_role, coalesce(p_surcharge,0))
  on conflict (package_id, menu_item_id) do update set role = excluded.role, surcharge = excluded.surcharge;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_package_set_item(uuid, uuid, text, numeric) to authenticated;

-- Elimina pacchetto (owner).
create or replace function public.fb_package_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.fb_packages where id = p_id and location_id = auth.uid();
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_package_delete(uuid) to authenticated;
