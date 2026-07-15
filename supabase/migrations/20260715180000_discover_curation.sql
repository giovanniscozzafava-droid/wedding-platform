-- Curazione vetrina pubblica "Scopri" (15/07): nascondi 3 profili (seed/demo o da
-- togliere) e accendi 3 profili reali già registrati. is_discoverable è reversibile;
-- non cancella nulla. Match per business_name ILIKE; le NOTICE riportano quante righe
-- ha toccato ciascuna (attese: 1 a testa; 0 = nome non combacia → da rivedere).
do $$
declare n int;
begin
  -- NASCONDI (tieni l'account)
  update public.profiles set is_discoverable = false where business_name ilike '%royal events%';
  get diagnostics n = row_count; raise notice 'HIDE Royal Events Animation: % righe', n;

  update public.profiles set is_discoverable = false where business_name ilike '%elena bitonte%';
  get diagnostics n = row_count; raise notice 'HIDE Elena Bitonte: % righe', n;

  update public.profiles set is_discoverable = false where business_name ilike '%elisa citraro%';
  get diagnostics n = row_count; raise notice 'HIDE Elisa Citraro: % righe', n;

  -- ACCENDI (profili reali già registrati)
  update public.profiles set is_discoverable = true where business_name ilike '%scusa design%';
  get diagnostics n = row_count; raise notice 'SHOW Scusa Design: % righe', n;

  update public.profiles set is_discoverable = true where business_name ilike '%daisy lab%';
  get diagnostics n = row_count; raise notice 'SHOW Daisy Lab: % righe', n;

  update public.profiles set is_discoverable = true where business_name ilike '%gisko%';
  get diagnostics n = row_count; raise notice 'SHOW Gisko: % righe', n;
end $$;
