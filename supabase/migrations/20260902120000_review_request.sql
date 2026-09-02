-- «Serve anche un pulsante che compare solo dopo la data effettuata (per ogni
--  professionista) dove si chiede una recensione su matrimonio.com o su Google.
--  Con tanto di link al profilo che il professionista carica dalle impostazioni.»
-- (Giovanni, 02/09/2026)
--
-- Tre pezzi:
--   1. i LINK (Google, Matrimonio.com) stanno sul profilo del professionista;
--   2. il PROFESSIONISTA, dentro l'evento passato, ha il pulsante "Chiedi una
--      recensione" (email o WhatsApp) e vede se il cliente ha cliccato;
--   3. la COPPIA, dopo la data, vede una scheda con un pulsante per OGNI
--      professionista che ha i link: un click e va a recensire.
-- "Per ogni professionista": la coppia recensisce chi conosce direttamente —
-- chi le ha fatto il preventivo/contratto, chi ha l'evento, chi ha la galleria.
-- I fornitori ciechi dietro il capostipite restano ciechi anche qui.

alter table public.profiles
  add column if not exists review_url_google text,
  add column if not exists review_url_matrimonio text;
comment on column public.profiles.review_url_google is 'Link "Chiedi recensioni" del Profilo dell''attività Google (g.page/r/...).';
comment on column public.profiles.review_url_matrimonio is 'Pagina del profilo su matrimonio.com dove il cliente lascia la recensione.';

-- Ogni richiesta mandata: per non chiederla due volte e per dire "chiesta il ...".
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  recipients text[] not null default '{}',
  sent_at timestamptz not null default now()
);
create index if not exists review_requests_entry_pro_idx on public.review_requests(entry_id, professional_id, sent_at desc);
alter table public.review_requests enable row level security;
drop policy if exists review_requests_pro on public.review_requests;
create policy review_requests_pro on public.review_requests for select
  using (professional_id = auth.uid());
drop policy if exists review_requests_couple on public.review_requests;
create policy review_requests_couple on public.review_requests for select
  using (exists (select 1 from public.wedding_couple_members m where m.entry_id = review_requests.entry_id and m.user_id = auth.uid()));

-- Ogni click del cliente sul pulsante "recensisci": la recensione vera sta fuori
-- (Google, Matrimonio.com) e non la vediamo; il click è l'unica traccia che abbiamo.
create table if not exists public.review_clicks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  platform text not null check (platform in ('google','matrimonio')),
  clicked_at timestamptz not null default now()
);
create index if not exists review_clicks_entry_pro_idx on public.review_clicks(entry_id, professional_id, clicked_at desc);
alter table public.review_clicks enable row level security;
drop policy if exists review_clicks_pro on public.review_clicks;
create policy review_clicks_pro on public.review_clicks for select
  using (professional_id = auth.uid());

-- Chi può agire su un evento come professionista: proprietario, chi ha la galleria,
-- chi è nel cerchio dell'evento.
create or replace function public.review_is_pro_of_entry(p_entry uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from calendar_entries ce where ce.id = p_entry and ce.owner_id = p_uid)
      or exists (select 1 from event_galleries g where g.entry_id = p_entry and g.owner_id = p_uid)
      or exists (select 1 from calendar_entry_participants cp where cp.entry_id = p_entry and cp.user_id = p_uid);
$$;
revoke all on function public.review_is_pro_of_entry(uuid, uuid) from public;

-- Le email della coppia di un evento, da tutte le fonti che abbiamo.
create or replace function public.review_entry_emails(p_entry uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct e), '{}') from (
    select lower(trim(m.email)) e from wedding_couple_members m
     where m.entry_id = p_entry and nullif(trim(coalesce(m.email,'')),'') is not null
    union
    select lower(trim(u.email)) from wedding_couple_members m join auth.users u on u.id = m.user_id
     where m.entry_id = p_entry and u.email is not null
    union
    select lower(trim(pr.client_email)) from calendar_entries_private pr
     where pr.entry_id = p_entry and nullif(trim(coalesce(pr.client_email,'')),'') is not null
    union
    select lower(trim(q.client_email)) from calendar_entries ce join quotes q on q.id = ce.quote_id
     where ce.id = p_entry and nullif(trim(coalesce(q.client_email,'')),'') is not null
  ) x where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
$$;
revoke all on function public.review_entry_emails(uuid) from public;

-- ── Lato professionista: tutto quello che serve alla scheda "Chiedi una recensione".
create or replace function public.review_request_context(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_e record; v_p record; v_end date;
  v_rec text[]; v_chi text; v_phone text; v_last record; v_clicks jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  select ce.id, ce.title, ce.date_from, ce.date_to, ce.event_kind into v_e
    from calendar_entries ce where ce.id = p_entry;
  if v_e.id is null then return jsonb_build_object('error','not_found'); end if;
  if not public.review_is_pro_of_entry(p_entry, v_uid) then return jsonb_build_object('error','forbidden'); end if;

  v_end := coalesce(v_e.date_to, v_e.date_from)::date;
  select review_url_google, review_url_matrimonio into v_p from profiles where id = v_uid;
  v_rec := public.review_entry_emails(p_entry);

  select nullif(trim(pr.client_name),'') into v_chi from calendar_entries_private pr where pr.entry_id = p_entry;
  if v_chi is null then
    select nullif(trim(m.full_name),'') into v_chi from wedding_couple_members m
     where m.entry_id = p_entry order by m.created_at limit 1;
  end if;
  -- Il telefono, se il pro l'ha in rubrica: apre WhatsApp già sul contatto giusto.
  select nullif(trim(sc.phone),'') into v_phone from supplier_clients sc
   where sc.supplier_id = v_uid and lower(sc.email) = any(v_rec) and nullif(trim(coalesce(sc.phone,'')),'') is not null
   limit 1;

  select channel, sent_at into v_last from review_requests
   where entry_id = p_entry and professional_id = v_uid order by sent_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'at', clicked_at) order by clicked_at desc), '[]'::jsonb)
    into v_clicks from review_clicks where entry_id = p_entry and professional_id = v_uid;

  return jsonb_build_object('ok', true,
    'past', v_end is not null and v_end < current_date, 'end_date', v_end,
    'title', v_e.title, 'event_kind', v_e.event_kind, 'chi', v_chi,
    'recipients', to_jsonb(v_rec), 'phone', v_phone,
    'google', v_p.review_url_google, 'matrimonio', v_p.review_url_matrimonio,
    'last', case when v_last.sent_at is null then null
                 else jsonb_build_object('channel', v_last.channel, 'at', v_last.sent_at) end,
    'clicks', v_clicks);
end$$;
revoke all on function public.review_request_context(uuid) from public;
grant execute on function public.review_request_context(uuid) to authenticated;

-- Il pro l'ha chiesta via WhatsApp (l'email la timbra l'edge col service role).
create or replace function public.review_request_log(p_entry uuid, p_channel text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  if not public.review_is_pro_of_entry(p_entry, v_uid) then return jsonb_build_object('error','forbidden'); end if;
  if p_channel not in ('email','whatsapp') then return jsonb_build_object('error','bad_channel'); end if;
  insert into review_requests (entry_id, professional_id, channel, recipients)
  values (p_entry, v_uid, p_channel, public.review_entry_emails(p_entry)) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
revoke all on function public.review_request_log(uuid, text) from public;
grant execute on function public.review_request_log(uuid, text) to authenticated;

-- ── Lato coppia: i professionisti da recensire, uno per pulsante.
create or replace function public.couple_review_targets(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_e record; v_end date; v_emails text[]; v_out jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from wedding_couple_members m where m.entry_id = p_entry and m.user_id = v_uid) then
    return jsonb_build_object('error','forbidden');
  end if;
  select ce.id, ce.title, ce.date_from, ce.date_to, ce.owner_id, ce.quote_id, ce.event_kind into v_e
    from calendar_entries ce where ce.id = p_entry;
  v_end := coalesce(v_e.date_to, v_e.date_from)::date;
  if v_end is null or v_end >= current_date then
    return jsonb_build_object('ok', true, 'past', false, 'professionals', '[]'::jsonb);
  end if;
  v_emails := public.review_entry_emails(p_entry);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', coalesce(nullif(p.business_name,''), p.full_name),
           'logo', p.brand_logo_url, 'color', p.brand_primary_color,
           'subrole', p.subrole,
           'google', p.review_url_google, 'matrimonio', p.review_url_matrimonio,
           'asked_at', (select max(sent_at) from review_requests rr where rr.entry_id = p_entry and rr.professional_id = p.id),
           'clicked_google', (select max(clicked_at) from review_clicks rc where rc.entry_id = p_entry and rc.professional_id = p.id and rc.user_id = v_uid and rc.platform = 'google'),
           'clicked_matrimonio', (select max(clicked_at) from review_clicks rc where rc.entry_id = p_entry and rc.professional_id = p.id and rc.user_id = v_uid and rc.platform = 'matrimonio')
         ) order by (p.id = v_e.owner_id) desc, p.business_name), '[]'::jsonb)
    into v_out
    from profiles p
   where p.id in (
           select v_e.owner_id
           union select g.owner_id from event_galleries g where g.entry_id = p_entry
           union select q.owner_id from quotes q where lower(q.client_email) = any(v_emails) and q.archived_at is null
           union select c.owner_id from contracts c where lower(c.client_email) = any(v_emails)
         )
     and (nullif(trim(coalesce(p.review_url_google,'')),'') is not null
          or nullif(trim(coalesce(p.review_url_matrimonio,'')),'') is not null);

  return jsonb_build_object('ok', true, 'past', true, 'end_date', v_end, 'title', v_e.title,
                            'event_kind', v_e.event_kind, 'professionals', v_out);
end$$;
revoke all on function public.couple_review_targets(uuid) from public;
grant execute on function public.couple_review_targets(uuid) to authenticated;

-- Il cliente ha cliccato: lo segno e avviso il professionista (una volta al giorno
-- per piattaforma: chi riapre la pagina tre volte non è tre notizie).
create or replace function public.couple_review_click(p_entry uuid, p_pro uuid, p_platform text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_chi text; v_title text; v_gia boolean;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from wedding_couple_members m where m.entry_id = p_entry and m.user_id = v_uid) then
    return jsonb_build_object('error','forbidden');
  end if;
  if p_platform not in ('google','matrimonio') then return jsonb_build_object('error','bad_platform'); end if;
  select exists (select 1 from review_clicks where entry_id = p_entry and professional_id = p_pro
                    and user_id = v_uid and platform = p_platform and clicked_at > now() - interval '24 hours')
    into v_gia;
  insert into review_clicks (entry_id, professional_id, user_id, platform) values (p_entry, p_pro, v_uid, p_platform);
  if not v_gia then
    select ce.title into v_title from calendar_entries ce where ce.id = p_entry;
    select coalesce(nullif(trim(m.full_name),''), nullif(trim(p.full_name),'')) into v_chi
      from wedding_couple_members m left join profiles p on p.id = m.user_id
     where m.entry_id = p_entry and m.user_id = v_uid limit 1;
    perform public.push_user_notification(p_pro, 'review_click', 'Il cliente è andato a recensirti',
      coalesce(v_chi, 'Il cliente') || ' ha aperto la tua pagina su '
        || case p_platform when 'google' then 'Google' else 'Matrimonio.com' end
        || ' da ' || coalesce('«' || v_title || '»', 'l''evento') || '. Fra poco controlla se la recensione è arrivata.',
      '/weddings/' || p_entry::text, p_entry);
  end if;
  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.couple_review_click(uuid, uuid, text) from public;
grant execute on function public.couple_review_click(uuid, uuid, text) to authenticated;
