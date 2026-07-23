-- ============================================================================
-- LUOGO dell'evento sul preventivo.
--   quotes.event_location  = TESTO mostrato (già esiste): nome/indirizzo del luogo. Quando si
--                            collega una location registrata, ci si mette il suo nome.
--   quotes.location_id     = LINK opzionale a un account LOCATION della piattaforma (attore reale:
--                            profilo, coerenza col calendario). NULL = luogo solo testo.
-- ============================================================================
alter table public.quotes
  add column if not exists location_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_quotes_location_id on public.quotes(location_id) where location_id is not null;
comment on column public.quotes.location_id is 'Account LOCATION collegato come luogo dell''evento (opzionale). event_location resta il testo mostrato.';

-- Autocomplete "collega una location registrata": cerca gli account ruolo LOCATION per nome/città.
-- Restituisce solo info già pubbliche (nome/città/slug), niente PII. SECURITY DEFINER per bypassare
-- l'RLS di profiles in sola lettura e in modo controllato.
create or replace function public.search_locations(p_q text)
returns table(id uuid, business_name text, full_name text, city text, slug text)
language sql security definer set search_path = public stable as $$
  select p.id, p.business_name, p.full_name, p.city, p.slug
    from public.profiles p
   where p.role = 'LOCATION'
     and (
       coalesce(p_q, '') = ''
       or p.business_name ilike '%' || p_q || '%'
       or p.full_name ilike '%' || p_q || '%'
       or p.city ilike '%' || p_q || '%'
     )
   order by p.business_name nulls last, p.full_name nulls last
   limit 10;
$$;
revoke all on function public.search_locations(text) from public, anon;
grant execute on function public.search_locations(text) to authenticated;
