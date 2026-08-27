-- ════════════════════════════════════════════════════════════════════════════
-- RECUPERO: preventivi "suggeriti" rimasti a metà invio (suggerimento QUOTE_SENT
-- ma preventivo BOZZA senza token) — vittime del bug enum del 25-26/08 che faceva
-- fallire in silenzio l'update status→INVIATO in send-suggestion-quote.
-- Li porto a INVIATO + genero access_token, così il LINK al preventivo funziona.
-- (Il cliente aveva già ricevuto l'email; qui rendiamo il preventivo effettivamente
--  visibile/apribile. Nessuna email inviata da questa migration.)
-- ════════════════════════════════════════════════════════════════════════════
update public.quotes q
   set status = 'INVIATO',
       sent_at = coalesce(q.sent_at, now()),
       access_token = coalesce(q.access_token, gen_random_uuid())
  from public.supplier_suggestions ss
 where ss.quote_id = q.id
   and ss.status = 'QUOTE_SENT'
   and q.status = 'BOZZA'
   and q.access_token is null;
