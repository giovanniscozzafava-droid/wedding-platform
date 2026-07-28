-- Nel landing "Suggerimenti inviati" alcuni fornitori comparivano come generico "Fornitore":
-- l'embed profiles falliva perché le policy di `profiles` non lasciano al referrer leggere il
-- profilo di un fornitore che non è PUBLIC né suo collaboratore. Devo SEMPRE vedere chi invia.
-- Questa RPC (SECURITY DEFINER, ristretta ai fornitori che HO suggerito) risolve i nomi.
create or replace function public.suggested_supplier_names()
returns table(supplier_id uuid, name text, subrole text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(p.business_name, ''), p.full_name) as name,
         p.subrole::text
    from public.profiles p
   where p.id in (
     select supplier_id  from public.supplier_suggestions where referrer_id = auth.uid()
     union
     select suggested_id from public.supplier_referrals  where referrer_id = auth.uid()
   );
$$;

revoke all on function public.suggested_supplier_names() from public, anon;
grant execute on function public.suggested_supplier_names() to authenticated;
