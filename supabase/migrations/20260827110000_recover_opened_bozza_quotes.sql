-- Recupero: preventivi rimasti BOZZA ma con TOKEN e GIÀ APERTI dal cliente
-- (open_count>0) — vittime del bug enom del 25-26/08: quote-send generava token +
-- mandava l'email (il cliente apriva) ma l'update status→INVIATO falliva in silenzio
-- → il pro continuava a vederli in "Bozze". Caso: Yana Zakieva.
-- Li porto a INVIATO (il cliente li ha già ricevuti e aperti).
update public.quotes
   set status = 'INVIATO',
       sent_at = coalesce(sent_at, first_opened_at, now())
 where status = 'BOZZA'
   and access_token is not null
   and coalesce(open_count, 0) > 0;
