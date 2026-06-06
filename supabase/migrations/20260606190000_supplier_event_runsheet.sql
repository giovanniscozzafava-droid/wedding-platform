-- ============================================================================
-- "Piano operativo" del fornitore: ogni turno/evento ha una run-sheet (timeline
-- di momenti con orario, titolo, chi se ne occupa, nota). Da qui si generano due
-- PDF brandizzati: una VETRINA per il cliente e un OPERATIVO per il team.
-- La timeline può essere importata dal programma evento condiviso (event_timeline)
-- quando il turno è collegato a un preventivo.
-- ============================================================================

create table if not exists public.supplier_team_event_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.supplier_team_events(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  start_time  text,           -- es. "18:30" (testo: niente vincoli di fuso)
  title       text not null,  -- es. "Ingresso sposi", "Primo ballo"
  role_label  text,           -- chi se ne occupa, es. "Voce + Sax"
  note        text,
  ord         int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_team_event_items_event on public.supplier_team_event_items(event_id, ord);

drop trigger if exists trg_team_event_items_upd on public.supplier_team_event_items;
create trigger trg_team_event_items_upd before update on public.supplier_team_event_items
  for each row execute function set_updated_at();

alter table public.supplier_team_event_items enable row level security;
drop policy if exists "team_event_items_own" on public.supplier_team_event_items;
create policy "team_event_items_own" on public.supplier_team_event_items
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

comment on table public.supplier_team_event_items is 'Run-sheet (timeline operativa) di un turno/evento del fornitore.';

-- RPC: importa la timeline dal programma evento condiviso.
-- Dal turno (supplier_team_events) risale al preventivo → calendar_entry →
-- event_timeline, e restituisce i momenti (preferendo quelli assegnati al
-- fornitore stesso, ma includendo anche i momenti generali). Solo il proprietario
-- del turno può chiamarla.
create or replace function public.supplier_event_program(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sup uuid := auth.uid();
  v_quote uuid;
  v_entry uuid;
  v_rows jsonb;
begin
  if v_sup is null then return jsonb_build_object('error','auth_required'); end if;

  select quote_id into v_quote
    from public.supplier_team_events
   where id = p_event_id and supplier_id = v_sup;
  if not found then return jsonb_build_object('error','not_owner'); end if;
  if v_quote is null then return jsonb_build_object('error','no_quote_linked'); end if;

  select id into v_entry from public.calendar_entries where quote_id = v_quote limit 1;
  if v_entry is null then return jsonb_build_object('error','no_event'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'start_time',  to_char(t.start_time, 'HH24:MI'),
    'title',       t.title,
    'note',        t.description,
    'location',    t.location,
    'mine',        (t.supplier_id = v_sup)
  ) order by t.ord, t.start_time), '[]'::jsonb)
  into v_rows
  from public.event_timeline t
  where t.entry_id = v_entry
    and (t.supplier_id is null or t.supplier_id = v_sup);

  return jsonb_build_object('ok', true, 'items', v_rows);
end$$;

grant execute on function public.supplier_event_program(uuid) to authenticated;
