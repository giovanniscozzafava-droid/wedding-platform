-- Giovanni risparmia 3 account: li rimette/mantiene visibili in rete e li toglie dalla
-- lista di eliminazione: "Alfredo Muraca" (variante base), Black Mamba, Villa Klopè.
do $$
declare r record; n int;
begin
  -- riattiva in vetrina Black Mamba + Villa Klopè (erano stati nascosti)
  update public.profiles set is_discoverable = true
   where business_name ilike 'Black Mamba%' or business_name ilike 'Villa Klop%';
  get diagnostics n = row_count; raise notice 'RIATTIVATI (Black Mamba/Villa Klope): % righe', n;

  raise notice '==== stato varianti Alfredo Muraca + i 2 risparmiati ====';
  for r in
    select coalesce(business_name,full_name) nm, role::text rl, is_discoverable d
    from public.profiles
    where business_name ilike 'Alfredo Muraca%' or business_name ilike 'Black Mamba%' or business_name ilike 'Villa Klop%'
    order by 1
  loop
    raise notice 'S: % | % | disc=%', r.nm, r.rl, r.d;
  end loop;
end $$;
