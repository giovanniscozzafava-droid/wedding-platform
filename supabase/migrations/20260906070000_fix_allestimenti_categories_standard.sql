-- Fix: le categorie dedicate al subrole 'allestimenti' (20260602160000) sono state
-- inserite senza is_standard=true, quindi con created_by=null restavano invisibili
-- via RLS a chiunque non fosse admin (cat_select_standard richiede is_standard,
-- cat_select_own richiede created_by=auth.uid()). Il fornitore vedeva solo la
-- categoria generica cross-subrole "Allestimenti", mai le proprie.
update public.service_categories
   set is_standard = true
 where subrole = 'allestimenti'
   and is_standard = false
   and created_by is null;
