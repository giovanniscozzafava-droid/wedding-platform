-- REGALI per INSIEMI: gli invitati si raggruppano in insiemi (famiglie, coppie, gruppi di amici) e il
-- regalo (soldi o cosa) si registra per insieme, perché si regala per nucleo, non per singolo.
create table if not exists public.guest_gift_groups (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.calendar_entries(id) on delete cascade,
  name       text not null,
  kind       text not null default 'FAMIGLIA' check (kind in ('FAMIGLIA','COPPIA','AMICI','COLLEGHI','SINGOLO','ALTRO')),
  created_at timestamptz not null default now()
);
create index if not exists idx_gift_groups_entry on public.guest_gift_groups(entry_id);
alter table public.event_guests add column if not exists gift_group_id uuid references public.guest_gift_groups(id) on delete set null;

create table if not exists public.event_gifts (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  group_id    uuid references public.guest_gift_groups(id) on delete set null,
  kind        text not null check (kind in ('MONEY','THING')),
  amount      numeric(12,2),
  description text,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid not null default auth.uid()
);
create index if not exists idx_gifts_entry on public.event_gifts(entry_id);

-- accesso: la coppia dell'evento, il proprietario del calendario (WP/location), o admin
create or replace function public.gift_can_manage(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_wedding_couple(p_entry)
      or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
      or public.is_admin();
$$;

alter table public.guest_gift_groups enable row level security;
alter table public.event_gifts       enable row level security;
drop policy if exists gg_all on public.guest_gift_groups;
create policy gg_all on public.guest_gift_groups for all using (public.gift_can_manage(entry_id)) with check (public.gift_can_manage(entry_id));
drop policy if exists gift_all on public.event_gifts;
create policy gift_all on public.event_gifts for all using (public.gift_can_manage(entry_id)) with check (public.gift_can_manage(entry_id));

-- riepilogo regali per insieme + totale raccolto
create or replace function public.event_gifts_summary(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.gift_can_manage(p_entry) then return jsonb_build_object('error','forbidden'); end if;
  return jsonb_build_object(
    'totale_soldi', coalesce((select sum(amount) from public.event_gifts where entry_id = p_entry and kind = 'MONEY'), 0),
    'totale_regali', (select count(*) from public.event_gifts where entry_id = p_entry),
    'insiemi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'nome', g.name, 'tipo', g.kind,
        'invitati', (select count(*) from public.event_guests eg where eg.gift_group_id = g.id),
        'soldi', coalesce((select sum(amount) from public.event_gifts gi where gi.group_id = g.id and gi.kind = 'MONEY'), 0),
        'regali', coalesce((select jsonb_agg(jsonb_build_object('id', gi.id, 'kind', gi.kind, 'amount', gi.amount, 'descrizione', gi.description, 'note', gi.note) order by gi.created_at)
                            from public.event_gifts gi where gi.group_id = g.id), '[]'::jsonb))
        order by g.name)
      from public.guest_gift_groups g where g.entry_id = p_entry), '[]'::jsonb),
    'senza_insieme', coalesce((select jsonb_agg(jsonb_build_object('id', gi.id, 'kind', gi.kind, 'amount', gi.amount, 'descrizione', gi.description, 'note', gi.note))
                               from public.event_gifts gi where gi.entry_id = p_entry and gi.group_id is null), '[]'::jsonb)
  );
end$$;
grant execute on function public.event_gifts_summary(uuid) to authenticated;
