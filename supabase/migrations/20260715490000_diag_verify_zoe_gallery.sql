-- DIAG: verifica che gallery_get_by_token ritorni i media del seed Zoe (join LAVORO_INTERO ok).
do $$
declare r jsonb;
begin
  select public.gallery_get_by_token('19a4ecc1-86de-4469-8b3d-a9bdf5a9e774') into r;
  raise notice 'DIAG ZOE: ok=% error=% couple=% media=% total=% pool=% min/max=%/%',
    r->>'ok', r->>'error', r->'gallery'->>'couple_label',
    jsonb_array_length(coalesce(r->'media','[]'::jsonb)),
    r->'selection'->>'total', r->'selection'->>'pool',
    r->'selection'->>'target_min', r->'selection'->>'target_max';
  raise notice 'DIAG ZOE: prima foto = %', (r->'media'->0);
end $$;
