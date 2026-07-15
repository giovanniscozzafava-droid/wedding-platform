-- ELIMINAZIONE DEFINITIVA dei 42 account test cancellabili (dei 43 confermati, ESCLUSO
-- "Giangianni Flowers" che possiede un evento con contratto FIRMATO → protetto dal
-- trigger tg_block_delete_entry_with_signed_act; va sbloccato a parte, con conferma).
-- FK dipendenti tutte CASCADE/SET NULL (diag 20260715270000). ASSERT: se ≠ 42 aborta.
do $$
declare r record; n int;
begin
  create temp table _del on commit drop as
    select p.id, coalesce(p.business_name, p.full_name) nm, p.role::text rl, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role in ('FORNITORE','WEDDING_PLANNER')
      and (
           trim(coalesce(p.business_name,p.full_name,'')) ilike '%test%'
        or trim(coalesce(p.business_name,p.full_name,'')) ilike '%diagn%'
        or p.business_name ilike 'Giuseppe Aras%'
        or p.business_name ilike 'Alfredo Muraca%'
        or p.business_name ilike 'Giangianni Flow%'
        or trim(coalesce(p.business_name,p.full_name,'')) ilike 'Marco Fotografo'
        or p.business_name in ('Band','Make-up artist')
      )
      and coalesce(p.business_name,p.full_name,'') !~* 'gisko|daisylab|scura|black mamba|villa klop'
      and u.email <> 'alfredomuracahairstylist@gmail.com'   -- vero Alfredo Muraca (mail personale)
      -- ESCLUDI chi possiede un evento con atto FIRMATO/accettato (protetto): es. Giangianni
      and not exists (
        select 1 from public.calendar_entries ce
        where ce.owner_id = p.id
          and ( exists (select 1 from public.contracts c where c.status='FIRMATO'
                          and (c.entry_id = ce.id or (ce.quote_id is not null and c.quote_id = ce.quote_id)))
             or exists (select 1 from public.quote_acceptances qa
                          where ce.quote_id is not null and qa.quote_id = ce.quote_id)) );

  select count(*) into n from _del;
  raise notice '==== candidati: % (atteso 42) ====', n;
  if n <> 42 then
    raise exception 'ABORT: attesi 42 account, trovati % — nessuna cancellazione', n;
  end if;

  delete from auth.users where id in (select id from _del);
  get diagnostics n = row_count;
  raise notice '==== auth.users eliminati: % ====', n;

  select count(*) into n from public.profiles p where p.id in (select id from _del);
  raise notice '==== profili residui (atteso 0): % ====', n;
end $$;
