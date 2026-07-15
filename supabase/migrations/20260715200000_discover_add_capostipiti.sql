-- Vetrina "Scopri" (WP/Location): accendi i capostipiti richiesti — Tenuta delle Grazie
-- (LOCATION) e Rosella Elia (WEDDING_PLANNER). is_discoverable, reversibile.
do $$
declare n int;
begin
  update public.profiles set is_discoverable = true
    where business_name ilike '%tenuta delle grazie%' or full_name ilike '%tenuta delle grazie%';
  get diagnostics n = row_count; raise notice 'SHOW Tenuta delle Grazie: % righe', n;

  update public.profiles set is_discoverable = true
    where business_name ilike '%rosella elia%' or full_name ilike '%rosella elia%';
  get diagnostics n = row_count; raise notice 'SHOW Rosella Elia: % righe', n;
end $$;
