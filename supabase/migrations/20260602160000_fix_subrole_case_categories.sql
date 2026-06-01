-- ============================================================================
-- Fix: la specializzazione del fornitore non deve essere richiesta di nuovo
-- alla creazione di un servizio (case subrole + categorie mancanti).
-- ============================================================================

-- Normalizza il case dei subrole dei fornitori (le mappe app usano lowercase)
update public.profiles
   set subrole = lower(subrole)
 where role = 'FORNITORE' and subrole is not null and subrole <> lower(subrole);

-- Categorie dedicate per 'allestimenti' (subrole senza categorie proprie)
insert into public.service_categories (subrole, name, slug)
select 'allestimenti', v.name, 'allestimenti-' || v.slug
from (values
  ('Allestimento sala', 'sala'),
  ('Allestimento cerimonia', 'cerimonia'),
  ('Noleggio arredi', 'noleggio-arredi'),
  ('Scenografie', 'scenografie')
) as v(name, slug)
where not exists (select 1 from public.service_categories where subrole = 'allestimenti')
on conflict do nothing;
