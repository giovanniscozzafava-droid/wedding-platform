-- ============================================================================
-- public_brand_kit(slug): colori del brand + FOTO del CATALOGO del fornitore.
-- Serve al mini-sito che incornicia il form (link senza sito): usa i colori del
-- brand e mostra SOLO le foto del catalogo (service_photos), non altro.
-- Pubblico (anon): sono dati già esposti nella vetrina pubblica.
-- ============================================================================
create or replace function public.public_brand_kit(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'brand_primary_color', p.brand_primary_color,
    'brand_secondary_color', p.brand_secondary_color,
    'photos', coalesce((
      select jsonb_agg(u order by ord)
      from (
        select coalesce(sp.original_url, sp.thumbnail_url) as u, sp.sort_order as ord
        from public.service_photos sp
        join public.services s on s.id = sp.service_id
        where s.fornitore_id = p.id and s.is_active = true
          and coalesce(sp.original_url, sp.thumbnail_url) is not null
        order by sp.sort_order
        limit 8
      ) q
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.slug = p_slug
  limit 1;
$$;
grant execute on function public.public_brand_kit(text) to anon, authenticated;
