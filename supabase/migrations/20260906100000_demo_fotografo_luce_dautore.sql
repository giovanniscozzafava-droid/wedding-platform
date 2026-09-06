-- ============================================================================
-- Persona PERMANENTE "Luce d'Autore Fotografia" (FORNITORE/fotografo), per
-- l'esplorazione diretta di Giovanni e per le riprese reali del video
-- verticale rivolto ai fotografi (06/09/2026). A differenza del mondo demo
-- di Alessandra Villelli (20260906080000, cancellabile), questa persona resta
-- — stesso trattamento delle altre personas permanenti della sessione
-- (Studio Luce Fotografia, Fiori di Maggio, Vivace Allestimenti...).
--
-- Copre il flusso "fornitore standalone" (supplier_clients → quotes/contracts
-- con direct_client_id, NON legato a un capostipite): funnel lead, preventivo,
-- contratto firmato. La galleria foto/Drive/carosello/impaginatore restano
-- da costruire a parte (richiedono upload reali, non solo righe SQL).
-- ============================================================================

do $$
declare
  v_foto uuid := 'b10c0000-0000-4000-8000-000000000001';
  v_cat_servizio uuid; v_cat_video uuid; v_cat_album uuid; v_cat_drone uuid;
  v_client_cliente uuid := 'b10c0000-0000-4000-8000-000000000203';
  v_quote    uuid := 'b10c0000-0000-4000-8000-000000000301';
  v_contract uuid := 'b10c0000-0000-4000-8000-000000000401';
  v_total numeric(12,2);
begin
  perform seed_user(v_foto, 'giovanni.scozzafava+demo-lucedautore@gmail.com', 'Demo2026!Skorpio',
    jsonb_build_object('role','FORNITORE','subrole','fotografo','full_name','Luce d''Autore Fotografia'));

  update public.profiles set
    business_name = 'Luce d''Autore Fotografia', full_name = 'Luce d''Autore Fotografia',
    phone = '+39 349 5553001', city = 'Reggio Calabria', zip = '89122', country = 'Italia',
    tagline = 'Fotografia di matrimonio autoriale, in Calabria e in giro per l''Italia',
    bio = 'Racconto matrimoni con uno sguardo autoriale: reportage, luce naturale, pochissimo posato.',
    is_discoverable = true, onboarding_complete = true
  where id = v_foto;

  select id into v_cat_servizio from public.service_categories where slug = 'servizio-fotografico';
  select id into v_cat_video    from public.service_categories where slug = 'servizio-video';
  select id into v_cat_album    from public.service_categories where slug = 'album-fotografico';
  select id into v_cat_drone    from public.service_categories where slug = 'riprese-drone';

  -- 1) Catalogo -----------------------------------------------------------
  insert into public.services (id, fornitore_id, category_id, name, description, base_price, unit) values
    ('b10c0000-0000-4000-8000-000000000101', v_foto, v_cat_servizio, 'Servizio fotografico matrimonio', 'Reportage completo, intera giornata, oltre 500 foto consegnate.', 2400, 'EVENTO'),
    ('b10c0000-0000-4000-8000-000000000102', v_foto, v_cat_video,    'Servizio foto + video combo',      'Fotografo e videomaker insieme, intera giornata.', 3400, 'EVENTO'),
    ('b10c0000-0000-4000-8000-000000000103', v_foto, v_cat_drone,    'Riprese drone cinematiche',        'Riprese aeree location e cerimonia, montaggio incluso.', 480, 'EVENTO'),
    ('b10c0000-0000-4000-8000-000000000104', v_foto, v_cat_album,    'Album fotografico premium 30x30',  'Stampa fine art, copertina in tessuto, 40 pagine.', 750, 'PEZZO'),
    ('b10c0000-0000-4000-8000-000000000105', v_foto, v_cat_servizio, 'Servizio battesimo/cerimonia',      'Copertura mezza giornata per cerimonie e ricorrenze.', 450, 'EVENTO'),
    ('b10c0000-0000-4000-8000-000000000106', v_foto, v_cat_servizio, 'Engagement pre-wedding',            'Sessione di coppia in location a scelta, prima del matrimonio.', 300, 'EVENTO')
  on conflict (id) do nothing;

  insert into public.service_photos (service_id, original_url, thumbnail_url, sort_order) values
    ('b10c0000-0000-4000-8000-000000000101', 'https://images.pexels.com/photos/32483421/pexels-photo-32483421.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32483421/pexels-photo-32483421.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('b10c0000-0000-4000-8000-000000000102', 'https://images.pexels.com/photos/37912244/pexels-photo-37912244.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37912244/pexels-photo-37912244.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('b10c0000-0000-4000-8000-000000000103', 'https://images.pexels.com/photos/18322542/pexels-photo-18322542.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/18322542/pexels-photo-18322542.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('b10c0000-0000-4000-8000-000000000104', 'https://images.pexels.com/photos/11652676/pexels-photo-11652676.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/11652676/pexels-photo-11652676.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('b10c0000-0000-4000-8000-000000000105', 'https://images.pexels.com/photos/37912248/pexels-photo-37912248.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37912248/pexels-photo-37912248.jpeg?auto=compress&cs=tinysrgb&h=350', 0),
    ('b10c0000-0000-4000-8000-000000000106', 'https://images.pexels.com/photos/37912240/pexels-photo-37912240.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37912240/pexels-photo-37912240.jpeg?auto=compress&cs=tinysrgb&h=350', 0)
  on conflict do nothing;

  -- 2) Funnel lead diretti (supplier_clients) --------------------------------
  insert into public.supplier_clients (id, supplier_id, full_name, email, phone, event_date, event_kind, guest_estimate, budget_min, budget_max, notes, source, status) values
    ('b10c0000-0000-4000-8000-000000000201', v_foto, 'Martina Le Piane', 'martina.lepiane@example.com', '+39 333 4445501', '2027-06-12', 'matrimonio', 100, 2000, 3000, 'Ha scritto in DM Instagram chiedendo disponibilità e listino.', 'instagram', 'LEAD'),
    ('b10c0000-0000-4000-8000-000000000202', v_foto, 'Vincenzo Aloi',    'vincenzo.aloi@example.com',    '+39 333 4445502', '2027-04-18', 'matrimonio', 70,  1500, 2500, 'Preventivo inviato, in attesa di risposta.', 'passaparola', 'TRATTATIVA'),
    (v_client_cliente,                        v_foto, 'Chiara Femia & Antonio Surace', 'chiara.femia@example.com', '+39 333 4445503', '2026-11-14', 'matrimonio', 90, 3000, 4000, 'Preventivo accettato, contratto firmato.', 'sito_web', 'CLIENTE'),
    ('b10c0000-0000-4000-8000-000000000204', v_foto, 'Bruno Critelli',   'bruno.critelli@example.com',   '+39 333 4445504', '2027-09-05', 'matrimonio', 150, 1000, 1500, 'Budget troppo distante dal nostro listino, chiuso con cortesia.', 'fiera', 'ARCHIVIATO')
  on conflict (id) do nothing;

  -- 3) Preventivo diretto (no ricarico: il fotografo vende i propri servizi) -
  insert into public.quotes (id, owner_id, direct_client_id, title, client_name, client_email, event_date, guest_count, status, event_kind, default_markup_percent, access_token, sent_at, accepted_at) values
    (v_quote, v_foto, v_client_cliente, 'Preventivo Femia-Surace · Matrimonio', 'Chiara Femia & Antonio Surace', 'chiara.femia@example.com', '2026-11-14', 90, 'ACCETTATO', 'matrimonio', 0, gen_random_uuid(), now() - interval '30 days', now() - interval '26 days')
  on conflict (id) do nothing;

  insert into public.quote_items (quote_id, service_id, supplier_id, name_snapshot, description_snapshot, unit_snapshot, snapshot_price, quantity, sort_order) values
    (v_quote, 'b10c0000-0000-4000-8000-000000000101', v_foto, 'Servizio fotografico matrimonio', 'Reportage completo, intera giornata, oltre 500 foto consegnate.', 'EVENTO', 2400, 1, 0),
    (v_quote, 'b10c0000-0000-4000-8000-000000000104', v_foto, 'Album fotografico premium 30x30',  'Stampa fine art, copertina in tessuto, 40 pagine.',              'PEZZO',  750,  1, 1),
    (v_quote, 'b10c0000-0000-4000-8000-000000000106', v_foto, 'Engagement pre-wedding',            'Sessione di coppia in location a scelta, prima del matrimonio.', 'EVENTO', 300,  1, 2)
  on conflict do nothing;

  select coalesce(sum(line_client), 0) into v_total from public.quote_items where quote_id = v_quote;

  -- 4) Contratto firmato — dati fiscali/preventivo trasferiti in automatico --
  insert into public.contracts (id, owner_id, quote_id, direct_client_id, party_kind, title, client_name, client_email, event_date, total_amount, status, access_token, sections, signed_at, signature_data) values
    (v_contract, v_foto, v_quote, v_client_cliente, 'SUPPLIER_CLIENT', 'Contratto Femia-Surace', 'Chiara Femia & Antonio Surace', 'chiara.femia@example.com', '2026-11-14', v_total, 'FIRMATO', gen_random_uuid(),
     '[{"heading":"Oggetto","body":"Servizio fotografico, album ed engagement per il matrimonio del 14/11/2026, come da preventivo allegato.","type":"CLAUSULE"},{"heading":"Pagamento","body":"Acconto 30% alla firma, saldo il giorno dell''evento.","type":"PRICE"}]'::jsonb,
     now() - interval '26 days',
     jsonb_build_object('name','Chiara Femia','signed_at',(now() - interval '26 days')::text,'method','demo'))
  on conflict (id) do nothing;

  raise notice 'Luce d''Autore Fotografia pronta. Totale contratto: % euro', v_total;
end $$;
