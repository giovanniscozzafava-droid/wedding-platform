-- PROVA MENU + VOTI + SCELTA: la location propone menu a un evento, organizza una giornata di prova
-- menu, gli ospiti votano (1–5) da un link pubblico, i voti si aggregano e si conferma la scelta che
-- alimenta fabbisogno→food cost→magazzino. RLS owner per la location; voto/lettura pubblici via token.

create table if not exists public.fb_menu_proposals (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete cascade,
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  menu_id     uuid not null references public.fb_menus(id) on delete cascade,
  is_chosen   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (entry_id, menu_id)
);

create table if not exists public.fb_tastings (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.profiles(id) on delete cascade,
  entry_id     uuid not null references public.calendar_entries(id) on delete cascade,
  scheduled_at timestamptz,
  sala         text,
  notes        text,
  vote_token   text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status       text not null default 'PIANIFICATA' check (status in ('PIANIFICATA','CONCLUSA')),
  created_at   timestamptz not null default now()
);

create table if not exists public.fb_tasting_votes (
  id         uuid primary key default gen_random_uuid(),
  tasting_id uuid not null references public.fb_tastings(id) on delete cascade,
  menu_id    uuid not null references public.fb_menus(id) on delete cascade,
  voter_name text,
  score      int not null check (score between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);
create index if not exists idx_fb_tasting_votes_t on public.fb_tasting_votes(tasting_id);

alter table public.fb_menu_proposals enable row level security;
alter table public.fb_tastings       enable row level security;
alter table public.fb_tasting_votes  enable row level security;
drop policy if exists fb_proposals_owner on public.fb_menu_proposals;
create policy fb_proposals_owner on public.fb_menu_proposals for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_tastings_owner on public.fb_tastings;
create policy fb_tastings_owner on public.fb_tastings for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_votes_owner on public.fb_tasting_votes;
create policy fb_votes_owner on public.fb_tasting_votes for select using (exists (select 1 from public.fb_tastings t where t.id = tasting_id and t.location_id = auth.uid()));

-- la location propone una lista di menu a un evento
create or replace function public.fb_propose_menus(p_entry uuid, p_menu_ids jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); m jsonb; n int := 0;
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from public.calendar_entries where id = p_entry and owner_id = v_loc) then return jsonb_build_object('error','forbidden'); end if;
  for m in select * from jsonb_array_elements(coalesce(p_menu_ids,'[]'::jsonb)) loop
    insert into public.fb_menu_proposals(location_id, entry_id, menu_id) values (v_loc, p_entry, (m#>>'{}')::uuid)
      on conflict (entry_id, menu_id) do nothing;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'proposti', n);
end$$;
grant execute on function public.fb_propose_menus(uuid, jsonb) to authenticated;

-- crea la giornata di prova menu (ritorna il token del link pubblico)
create or replace function public.fb_create_tasting(p_entry uuid, p_when timestamptz, p_sala text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_id uuid; v_tok text;
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from public.calendar_entries where id = p_entry and owner_id = v_loc) then return jsonb_build_object('error','forbidden'); end if;
  insert into public.fb_tastings(location_id, entry_id, scheduled_at, sala) values (v_loc, p_entry, p_when, p_sala)
    returning id, vote_token into v_id, v_tok;
  return jsonb_build_object('ok', true, 'tasting_id', v_id, 'token', v_tok);
end$$;
grant execute on function public.fb_create_tasting(uuid, timestamptz, text) to authenticated;

-- PUBBLICO: la pagina di voto carica prova + menu proposti (per token, niente login)
create or replace function public.fb_tasting_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_t record;
begin
  select t.id, t.entry_id, t.scheduled_at, t.sala, t.location_id, ce.title
    into v_t from public.fb_tastings t join public.calendar_entries ce on ce.id = t.entry_id
    where t.vote_token = p_token;
  if v_t.id is null then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true,
    'tasting_id', v_t.id, 'titolo', v_t.title, 'quando', v_t.scheduled_at, 'sala', v_t.sala,
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object('menu_id', mm.id, 'nome', mm.name,
        'piatti', coalesce((select jsonb_agg(rc.name order by mi.sort_order, rc.name)
          from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id where mi.menu_id = mm.id), '[]'::jsonb)) order by mm.name)
      from public.fb_menu_proposals p join public.fb_menus mm on mm.id = p.menu_id where p.entry_id = v_t.entry_id), '[]'::jsonb));
end$$;
grant execute on function public.fb_tasting_public(text) to anon, authenticated;

-- PUBBLICO: un ospite invia il voto (per token)
create or replace function public.fb_submit_vote(p_token text, p_voter text, p_menu_id uuid, p_score int, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tid uuid; v_entry uuid;
begin
  select id, entry_id into v_tid, v_entry from public.fb_tastings where vote_token = p_token;
  if v_tid is null then return jsonb_build_object('error','not_found'); end if;
  if not exists (select 1 from public.fb_menu_proposals where entry_id = v_entry and menu_id = p_menu_id) then return jsonb_build_object('error','menu_non_in_prova'); end if;
  insert into public.fb_tasting_votes(tasting_id, menu_id, voter_name, score, comment)
    values (v_tid, p_menu_id, nullif(btrim(p_voter),''), greatest(1, least(5, coalesce(p_score,3))), nullif(btrim(p_comment),''));
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_submit_vote(text, text, uuid, int, text) to anon, authenticated;

-- risultati aggregati della prova (per la location)
create or replace function public.fb_tasting_results(p_tasting uuid)
returns table (menu_id uuid, name text, avg_score numeric, votes int)
language sql stable security invoker set search_path = public as $$
  select v.menu_id, mm.name, round(avg(v.score), 2), count(*)::int
  from public.fb_tasting_votes v join public.fb_menus mm on mm.id = v.menu_id
  where v.tasting_id = p_tasting
  group by v.menu_id, mm.name order by avg(v.score) desc;
$$;
grant execute on function public.fb_tasting_results(uuid) to authenticated;

-- conferma la scelta: marca la proposta scelta e imposta il menu dell'evento (→ spesa)
create or replace function public.fb_choose_menu(p_entry uuid, p_menu_id uuid, p_covers int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid();
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from public.calendar_entries where id = p_entry and owner_id = v_loc) then return jsonb_build_object('error','forbidden'); end if;
  update public.fb_menu_proposals set is_chosen = (menu_id = p_menu_id) where entry_id = p_entry;
  delete from public.fb_event_menus where entry_id = p_entry;
  insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_loc, p_entry, p_menu_id, p_covers);
  update public.fb_tastings set status = 'CONCLUSA' where entry_id = p_entry;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_choose_menu(uuid, uuid, int) to authenticated;
