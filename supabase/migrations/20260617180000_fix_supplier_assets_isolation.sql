-- SICUREZZA: la policy sa_public_read (select using is_public) faceva vedere a QUALSIASI
-- utente autenticato gli asset pubblici di TUTTI i fornitori nella query della libreria
-- (es. Alfredo vedeva gli asset di Gisko). Il gioco swipe usa get_supplier_assets (SECURITY
-- DEFINER, bypassa RLS), quindi NON serve una policy public-read sulla tabella. La rimuoviamo:
-- ogni fornitore vede SOLO i propri (sa_owner_all), gli admin tutto.
drop policy if exists sa_public_read on public.supplier_assets;
