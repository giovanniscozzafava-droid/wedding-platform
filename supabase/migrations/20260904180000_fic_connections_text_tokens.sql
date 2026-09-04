-- Bug trovato dal collaudo reale: access_token_enc/refresh_token_enc erano
-- `bytea`, ma drive-crypto.ts scrive/legge base64 come TESTO (stesso schema di
-- drive_connections, che infatti è `text`). Un bytea via l'API REST non
-- restituisce il testo così com'è scritto — round-trip rotto, "Failed to
-- decode base64" al primo uso vero. Nessuna fattura è mai stata emessa
-- (collegamento appena testato): sicuro azzerare i token già salvati, sbagliati
-- comunque — il professionista si ricollega con un click.

alter table public.fic_connections
  alter column access_token_enc type text using null,
  alter column refresh_token_enc type text using null;
