-- ============================================================================
-- resolve_public_slug: risolve uno slug pubblico (planfully.it/<slug>) al tipo
-- di profilo (wp | fornitore), per supportare URL puliti a livello root.
-- ----------------------------------------------------------------------------
-- La landing pubblica del professionista vive su /p/wp/:slug e /p/fornitore/:slug.
-- Questa RPC permette al frontend di montare anche /:slug come scorciatoia,
-- risolvendo a quale pagina rendere senza esporre dati sensibili.
-- Ritorna NULL se lo slug non esiste o il profilo non e` pubblicabile.
-- ============================================================================

create or replace function public.resolve_public_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'slug', p.slug,
           'kind', case
                     when p.role = 'FORNITORE' then 'fornitore'
                     else 'wp'
                   end,
           'role', p.role,
           'display_name', coalesce(p.business_name, p.full_name)
         )
    from public.profiles p
   where p.slug = p_slug
     and p.role in ('WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'FORNITORE')
   limit 1;
$$;

grant execute on function public.resolve_public_slug(text) to anon, authenticated;

comment on function public.resolve_public_slug(text) is
  'Risolve uno slug pubblico al tipo di profilo (wp|fornitore) per il routing root /:slug. NULL se non trovato.';
