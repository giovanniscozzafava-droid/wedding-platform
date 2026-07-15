-- DIAGNOSTICA (no-op, SOLO SELECT): quale dei 43 account test possiede un evento con
-- atto FIRMATO/accettato (che blocca la cancellazione a cascata).
do $$
declare r record; n int := 0;
begin
  create temp table _del on commit drop as
    select p.id, coalesce(p.business_name, p.full_name) nm, u.email
    from public.profiles p join auth.users u on u.id = p.id
    where p.role in ('FORNITORE','WEDDING_PLANNER')
      and (
           trim(coalesce(p.business_name,p.full_name,'')) ilike '%test%'
        or trim(coalesce(p.business_name,p.full_name,'')) ilike '%diagn%'
        or p.business_name ilike 'Giuseppe Aras%' or p.business_name ilike 'Alfredo Muraca%'
        or p.business_name ilike 'Giangianni Flow%'
        or trim(coalesce(p.business_name,p.full_name,'')) ilike 'Marco Fotografo'
        or p.business_name in ('Band','Make-up artist')
      )
      and coalesce(p.business_name,p.full_name,'') !~* 'gisko|daisylab|scura|black mamba|villa klop'
      and u.email <> 'alfredomuracahairstylist@gmail.com';

  raise notice '==== account BLOCCATI da atto firmato ====';
  for r in
    select d.email, d.nm, ce.id ce_id, ce.title ce_title,
           (select string_agg(c.status::text, ',') from public.contracts c
              where c.entry_id = ce.id or (ce.quote_id is not null and c.quote_id = ce.quote_id)) contracts,
           (select count(*) from public.quote_acceptances qa where ce.quote_id is not null and qa.quote_id = ce.quote_id) accept
    from _del d
    join public.calendar_entries ce on ce.owner_id = d.id
    where exists (select 1 from public.contracts c where c.status='FIRMATO'
                    and (c.entry_id = ce.id or (ce.quote_id is not null and c.quote_id = ce.quote_id)))
       or exists (select 1 from public.quote_acceptances qa where ce.quote_id is not null and qa.quote_id = ce.quote_id)
    order by 1
  loop
    n := n + 1;
    raise notice 'BLOCCATO: % | % | evento="%" | contratti=[%] | accettazioni=%', r.email, r.nm, r.ce_title, r.contracts, r.accept;
  end loop;
  raise notice '==== bloccati: % (gli altri %-% = % sono cancellabili) ====', n, 43, n, 43-n;
end $$;
