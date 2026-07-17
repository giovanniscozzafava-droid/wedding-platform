-- ============================================================================
-- Ricerca in bacheca. UNICA via di accesso alla lista.
--
-- SECURITY INVOKER: la RLS resta attiva e la funzione NON la bypassa. È deliberato
-- (lezione della vulnerabilità suggest_alternatives_full: un SECURITY DEFINER di
-- comodo su una lista è come non avere RLS).
--
-- ORDINE CASUALE STABILE PER SESSIONE: md5(id || seed). Non è un vezzo — è il
-- principio 1. Nessun ORDER BY su esperienza, completezza, feedback o alcuna metrica
-- di merito: se ordinassimo per rilevanza staremmo SELEZIONANDO, e chi seleziona
-- lavoratori fa intermediazione. Il seed lo passa il client una volta per sessione:
-- stessa sessione = stesso ordine (niente carte che ballano sotto il dito),
-- sessione nuova = ordine nuovo (nessuno ha una posizione "sua").
-- ============================================================================

create or replace function public.search_maestranze(
  p_provincia      varchar default null,
  p_skill_ids      uuid[] default null,
  p_min_esperienza smallint default null,
  p_seed           float default 0.5,
  p_limit          int default 24,
  p_offset         int default 0
) returns table (
  id                   uuid,
  display_name         varchar,
  photo_path           text,
  provincia            varchar,
  provincia_nome       varchar,
  regione              varchar,
  raggio_disponibilita text,
  bio                  text,
  anni_esperienza      smallint,
  fascia_prezzo        varchar,
  disponibilita_note   text,
  skills               text[],
  total_count          bigint
)
language sql
security invoker
set search_path = public
as $$
  with filtrati as (
    select mp.*, pr.nome as prov_nome, pr.regione as prov_regione
    from maestranze_profiles mp
    join province_regioni pr on pr.provincia = mp.provincia
    where mp.is_published
      and mp.anonymized_at is null
      -- Filtro raggio: la maestranza compare se la provincia cercata è raggiungibile
      -- dal raggio che ha dichiarato. NAZIONALE ovunque; REGIONE solo nella sua regione
      -- (senza questa join, un cameriere di Milano compariva cercando a Catanzaro).
      and (p_provincia is null or case mp.raggio_disponibilita
            when 'NAZIONALE' then true
            when 'REGIONE'   then pr.regione = (select r.regione from province_regioni r
                                                 where r.provincia = p_provincia)
            else mp.provincia = p_provincia
          end)
      and (p_min_esperienza is null or mp.anni_esperienza >= p_min_esperienza)
      and (p_skill_ids is null or exists (
            select 1 from maestranze_profile_skills ps
            where ps.profile_id = mp.id and ps.skill_id = any(p_skill_ids)))
  )
  select f.id, f.display_name, f.photo_path, f.provincia, f.prov_nome, f.prov_regione,
         f.raggio_disponibilita, f.bio, f.anni_esperienza, f.fascia_prezzo,
         f.disponibilita_note,
         coalesce((select array_agg(s.name order by s.name)
                   from maestranze_profile_skills ps
                   join maestranze_skills s on s.id = ps.skill_id
                   where ps.profile_id = f.id), array[]::text[]),
         (select count(*) from filtrati)
  from filtrati f
  order by md5(f.id::text || p_seed::text)
  limit p_limit offset p_offset;
$$;

revoke all on function public.search_maestranze(varchar, uuid[], smallint, float, int, int) from anon, public;
grant execute on function public.search_maestranze(varchar, uuid[], smallint, float, int, int) to authenticated;

comment on function public.search_maestranze is
  'Bacheca maestranze: filtri informativi + ordine CASUALE stabile per sessione. '
  'Nessun ranking, nessun matching (vincolo legale, non scelta di UX). SECURITY INVOKER: RLS attiva.';

-- ============================================================================
-- Dettaglio profilo: stessa forma della card, per la pagina che si apre.
-- Anche qui INVOKER → un non registrato non vede nulla.
-- ============================================================================
create or replace function public.get_maestranza(p_id uuid)
returns table (
  id                   uuid,
  display_name         varchar,
  photo_path           text,
  provincia            varchar,
  provincia_nome       varchar,
  regione              varchar,
  raggio_disponibilita text,
  bio                  text,
  anni_esperienza      smallint,
  fascia_prezzo        varchar,
  disponibilita_note   text,
  skills               text[],
  published_at         timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select mp.id, mp.display_name, mp.photo_path, mp.provincia, pr.nome, pr.regione,
         mp.raggio_disponibilita, mp.bio, mp.anni_esperienza, mp.fascia_prezzo,
         mp.disponibilita_note,
         coalesce((select array_agg(s.name order by s.name)
                   from maestranze_profile_skills ps
                   join maestranze_skills s on s.id = ps.skill_id
                   where ps.profile_id = mp.id), array[]::text[]),
         mp.published_at
  from maestranze_profiles mp
  join province_regioni pr on pr.provincia = mp.provincia
  where mp.id = p_id and mp.anonymized_at is null and (mp.is_published or mp.id = auth.uid());
$$;

revoke all on function public.get_maestranza(uuid) from anon, public;
grant execute on function public.get_maestranza(uuid) to authenticated;
