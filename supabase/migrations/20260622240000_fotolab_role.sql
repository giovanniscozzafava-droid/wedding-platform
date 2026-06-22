-- FotoLab è un SERVICE della piattaforma (non un fornitore/professionista): ruolo dedicato per
-- routing/layout (console propria, niente sidebar professionista, niente onboarding). La capability
-- di vedere/lavorare gli ordini resta su profiles.is_album_lab (RLS già su quello).
alter type public.user_role add value if not exists 'FOTOLAB';
