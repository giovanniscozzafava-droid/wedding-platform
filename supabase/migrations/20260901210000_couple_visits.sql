-- PRESENZE DEL CLIENTE NEL SUO EVENTO (Giovanni, 01/09/2026):
--   «monitorare ogni qualvolta un cliente entra dentro il proprio evento, per vedere
--    contratto, preventivo o vedere le foto. Monitorando anche quanto rimane dentro.
--    I dati sono dentro ogni singolo evento.»
--
-- Sapere che è entrato è metà informazione: quello che dice qualcosa è QUANTO è
-- rimasto e DOVE. Cinque secondi sul contratto e venti minuti sulle foto non sono la
-- stessa visita.

create table if not exists public.couple_visits (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  section      text not null,                 -- 'foto' | 'preventivo' | 'contratto' | ...
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_couple_visits_entry on public.couple_visits(entry_id, started_at desc);
create index if not exists idx_couple_visits_open on public.couple_visits(entry_id, user_id, section, last_seen_at desc);

alter table public.couple_visits enable row level security;

-- Legge chi sta dentro l'evento: il professionista proprietario, la cerchia, l'admin.
-- Il cliente non ha motivo di leggere le proprie presenze, ma deve poterle scrivere:
-- lo fa solo tramite la RPC (SECURITY DEFINER), quindi qui niente policy di insert.
drop policy if exists couple_visits_read on public.couple_visits;
create policy couple_visits_read on public.couple_visits
  for select using (
    public.is_admin()
    or exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or exists (select 1 from public.event_galleries g where g.entry_id = couple_visits.entry_id and g.owner_id = auth.uid())
  );

-- Un "battito" ogni tanto dalla pagina del cliente. Se l'ultimo battito è recente
-- prolunga la visita in corso, altrimenti ne apre una nuova. Così la durata esce da
-- sola e non dipende da eventi di chiusura pagina, che i browser non garantiscono
-- (chi chiude il portatile o cambia app non manda nessun addio).
create or replace function public.couple_visit_ping(p_entry uuid, p_section text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_sec text;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  -- Solo chi è davvero della coppia di QUESTO evento.
  if not exists (select 1 from wedding_couple_members m
                  where m.entry_id = p_entry and m.user_id = v_uid) then
    return jsonb_build_object('error','forbidden');
  end if;
  v_sec := coalesce(nullif(trim(p_section), ''), 'evento');
  if length(v_sec) > 40 then v_sec := left(v_sec, 40); end if;

  -- Stessa sezione, battito entro 3 minuti → è la stessa visita.
  select id into v_id from couple_visits
   where entry_id = p_entry and user_id = v_uid and section = v_sec
     and last_seen_at > now() - interval '3 minutes'
   order by last_seen_at desc limit 1;

  if v_id is null then
    insert into couple_visits (entry_id, user_id, section) values (p_entry, v_uid, v_sec)
    returning id into v_id;
  else
    update couple_visits set last_seen_at = now() where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

revoke all on function public.couple_visit_ping(uuid, text) from public;
grant execute on function public.couple_visit_ping(uuid, text) to authenticated;

-- Riepilogo per UN evento: quante volte è entrato, quanto è rimasto, dove, e quando
-- è stata l'ultima volta. Le visite sotto i 5 secondi non si contano: sono rimbalzi.
create or replace function public.couple_visits_summary(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  select public.is_admin()
      or exists (select 1 from calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
      or exists (select 1 from event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())
    into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('error','forbidden'); end if;

  return (
    with v as (
      select cv.*, greatest(0, extract(epoch from (cv.last_seen_at - cv.started_at)))::int as secondi
        from couple_visits cv where cv.entry_id = p_entry
    ), reali as (select * from v where secondi >= 5)
    select jsonb_build_object(
      'visite',        (select count(*) from reali),
      'rimbalzi',      (select count(*) from v where secondi < 5),
      'secondi_totali',(select coalesce(sum(secondi),0) from reali),
      'ultima',        (select max(last_seen_at) from v),
      'prima',         (select min(started_at) from v),
      'persone',       (select count(distinct user_id) from v),
      'sezioni',       coalesce((select jsonb_agg(x order by x->>'secondi' desc) from (
                          select jsonb_build_object('sezione', section, 'visite', count(*),
                                                    'secondi', sum(secondi), 'ultima', max(last_seen_at)) as x
                            from reali group by section) s), '[]'::jsonb),
      'ultime',        coalesce((select jsonb_agg(y order by y->>'quando' desc) from (
                          select jsonb_build_object('quando', last_seen_at, 'sezione', section,
                                                    'secondi', secondi,
                                                    'chi', coalesce((select full_name from profiles p where p.id = r.user_id), 'Cliente')) as y
                            from reali r order by last_seen_at desc limit 12) t), '[]'::jsonb)
    )
  );
end$$;

revoke all on function public.couple_visits_summary(uuid) from public;
grant execute on function public.couple_visits_summary(uuid) to authenticated;
