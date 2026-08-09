-- ============================================================================
-- Stessa classe di C-1: il bucket album-catalogs aveva una policy SELECT
-- `using (bucket_id='album-catalogs')` per public -> LIST API anonima che enumera
-- i path di tutti i cataloghi PDF dei fotografi. Contenuto poco sensibile (PDF
-- marketing) ma superficie identica a wedding-photos. Rimossa: i byte restano
-- serviti da /object/public/ per path noto (modello a opacità come gli altri bucket).
-- ============================================================================

drop policy if exists "albumcat read" on storage.objects;
