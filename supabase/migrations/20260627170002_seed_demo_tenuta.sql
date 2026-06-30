-- DEMO LOCATION "Tenuta delle Grazie di Curinga": riusa l'account bfca21ff (clean) → ruolo LOCATION
-- e seeda un matrimonio completo + lead, preventivi, contratto, tavoli, tableau, organizzazione e
-- "magazzino cucina" (via budget). Idempotente. Colonne verificate sullo schema reale.
do $$
declare
  v_pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34';
  v_event uuid := gen_random_uuid();
  v_q1 uuid := gen_random_uuid();
  v_q2 uuid := gen_random_uuid();
  v_q3 uuid := gen_random_uuid();
  v_contract uuid := gen_random_uuid();
  v_cat uuid;
begin
  update public.profiles set
    role = 'LOCATION', subrole = null,
    business_name = 'Tenuta delle Grazie di Curinga', full_name = 'Tenuta delle Grazie',
    phone = '+39 0968 123456', city = 'Curinga', zip = '88022', country = 'Italia',
    address = 'Contrada Acconia', website = 'https://tenutadellegrazie.it',
    tagline = 'Eleganza e tradizione nel cuore della Calabria',
    bio = 'Dimora storica per matrimoni ed eventi, immersa negli ulivi della piana di Curinga.',
    is_discoverable = true, onboarding_complete = true,
    brand_primary_color = '#7a6a52', brand_secondary_color = '#c9a227'
  where id = v_pid;

  -- Idempotenza
  delete from public.calendar_entries where owner_id = v_pid;
  delete from public.contracts where owner_id = v_pid;
  delete from public.quotes where owner_id = v_pid;
  delete from public.lead_requests where wp_id = v_pid;

  -- 1. EVENTO (matrimonio confermato, in pianificazione)
  insert into public.calendar_entries(id, owner_id, title, date_from, date_to, status, event_kind, evento_stato, guest_count)
  values (v_event, v_pid, 'Matrimonio Greco · Fabiani', '2026-09-19', '2026-09-19', 'CONFERMATA', 'matrimonio', 'PIANIFICAZIONE', 120);

  insert into public.wedding_couple_members(entry_id, email, full_name, role) values
    (v_event, 'marta.greco@example.com', 'Marta Greco', 'SPOSA'),
    (v_event, 'luca.fabiani@example.com', 'Luca Fabiani', 'SPOSO');

  -- 2. LEAD (più stati del funnel)
  insert into public.lead_requests(wp_id, client_name, client_email, client_phone, event_kind, event_date, guests_estimate, budget_range, message, status, source) values
    (v_pid, 'Sara Pugliese', 'sara.pugliese@example.com', '+39 333 1112233', 'matrimonio', '2027-06-12', 100, '20-50k', 'Cerchiamo una location nel verde per giugno 2027.', 'NEW', 'public_form'),
    (v_pid, 'Antonio Rizzo', 'antonio.rizzo@example.com', '+39 320 4455667', 'matrimonio', '2027-05-30', 80, '10-20k', 'Disponibilità e prezzi per un sabato di maggio?', 'CONTACTED', 'discover_page'),
    (v_pid, 'Elena Costa', 'elena.costa@example.com', null, 'azienda', '2026-11-08', 150, '10-20k', 'Cena di gala aziendale, 150 coperti.', 'QUOTED', 'public_form'),
    (v_pid, 'Marta & Luca', 'marta.greco@example.com', '+39 347 9988776', 'matrimonio', '2026-09-19', 120, '20-50k', 'Vogliamo sposarci da voi!', 'CLOSED_WON', 'referral');

  -- 3. PREVENTIVI (accettato / inviato / bozza) + righe (totali da trigger)
  insert into public.quotes(id, owner_id, title, client_name, client_email, event_date, guest_count, status, event_kind, default_markup_percent, access_token, sent_at, accepted_at) values
    (v_q1, v_pid, 'Preventivo Greco-Fabiani · Matrimonio', 'Marta Greco & Luca Fabiani', 'marta.greco@example.com', '2026-09-19', 120, 'ACCETTATO', 'matrimonio', 20, gen_random_uuid(), now() - interval '50 days', now() - interval '44 days'),
    (v_q2, v_pid, 'Preventivo Costa · Cena di gala', 'Elena Costa', 'elena.costa@example.com', '2026-11-08', 150, 'INVIATO', 'azienda', 18, gen_random_uuid(), now() - interval '6 days', null),
    (v_q3, v_pid, 'Preventivo Rizzo · Matrimonio (bozza)', 'Antonio Rizzo', 'antonio.rizzo@example.com', '2027-05-30', 80, 'BOZZA', 'matrimonio', 20, null, null, null);

  insert into public.quote_items(quote_id, name_snapshot, description_snapshot, unit_snapshot, snapshot_price, quantity, sort_order) values
    (v_q1, 'Affitto sala e giardino', 'Esclusiva location intera giornata', 'EVENTO', 4500, 1, 1),
    (v_q1, 'Menu matrimonio premium', 'Antipasti, 2 primi, 2 secondi, dolce', 'PERSONA', 95, 120, 2),
    (v_q1, 'Open bar e angolo cocktail', 'Servizio 5 ore', 'PERSONA', 18, 120, 3),
    (v_q1, 'Allestimento floreale', 'Centrotavola e cerimonia', 'EVENTO', 2200, 1, 4),
    (v_q2, 'Affitto sala', 'Serata aziendale', 'EVENTO', 3000, 1, 1),
    (v_q2, 'Menu cena di gala', 'Tris di portate + dolce', 'PERSONA', 70, 150, 2),
    (v_q3, 'Affitto sala e giardino', 'Intera giornata', 'EVENTO', 4500, 1, 1),
    (v_q3, 'Menu matrimonio classic', 'Menu 4 portate', 'PERSONA', 75, 80, 2);

  update public.calendar_entries set quote_id = v_q1 where id = v_event;

  -- 4. CONTRATTO firmato
  insert into public.contracts(id, owner_id, quote_id, entry_id, title, client_name, client_email, event_date, total_amount, status, event_kind, access_token, sections, signed_at, signature_data)
  values (v_contract, v_pid, v_q1, v_event, 'Contratto Matrimonio Greco-Fabiani', 'Marta Greco & Luca Fabiani', 'marta.greco@example.com', '2026-09-19', 28500, 'FIRMATO', 'matrimonio', gen_random_uuid(),
    '[{"heading":"Oggetto","body":"Affitto della Tenuta delle Grazie per il ricevimento di matrimonio del 19/09/2026, con ristorazione e allestimento come da preventivo allegato.","type":"TERMS"},{"heading":"Acconto e saldo","body":"Acconto del 30% alla firma, saldo 10 giorni prima dell''evento.","type":"PRICE"}]'::jsonb,
    now() - interval '40 days',
    jsonb_build_object('name','Marta Greco','signed_at',(now() - interval '40 days')::text,'method','demo'));

  -- 5. TAVOLI + INVITATI (tableau con posizioni)
  insert into public.event_tables(entry_id, table_no, label, seats, shape, pos_x, pos_y) values
    (v_event, 0, 'Tavolo sposi', 2, 'HEAD', 300, 70),
    (v_event, 1, 'Famiglia sposa', 10, 'ROUND', 140, 210),
    (v_event, 2, 'Famiglia sposo', 10, 'ROUND', 460, 210),
    (v_event, 3, 'Amici', 8, 'ROUND', 300, 350);

  insert into public.event_guests(entry_id, full_name, party_size, rsvp, table_id, side, group_label, diet)
  select v_event, g.nm, 1, 'YES'::rsvp_status,
         (select id from public.event_tables where entry_id = v_event and table_no = g.tno), g.sd, g.gl, g.dt
  from (values
    ('Marta Greco',0,'SPOSA','Sposi',null),
    ('Luca Fabiani',0,'SPOSO','Sposi',null),
    ('Rosa Greco',1,'SPOSA','Famiglia sposa','vegetariano'),
    ('Giuseppe Greco',1,'SPOSA','Famiglia sposa',null),
    ('Anna Greco',1,'SPOSA','Famiglia sposa',null),
    ('Carmela Greco',1,'SPOSA','Famiglia sposa','gluten-free'),
    ('Mario Fabiani',2,'SPOSO','Famiglia sposo',null),
    ('Teresa Fabiani',2,'SPOSO','Famiglia sposo',null),
    ('Paolo Fabiani',2,'SPOSO','Famiglia sposo',null),
    ('Lucia Fabiani',2,'SPOSO','Famiglia sposo','vegano'),
    ('Davide Conte',3,'ENTRAMBI','Amici',null),
    ('Sofia Marino',3,'ENTRAMBI','Amici',null),
    ('Marco Bruno',3,'ENTRAMBI','Amici',null),
    ('Giulia Esposito',3,'ENTRAMBI','Amici','vegetariano')
  ) as g(nm, tno, sd, gl, dt);

  -- 6. ORGANIZZAZIONE: checklist (alcune fatte) + scaletta
  insert into public.wedding_tasks(entry_id, phase, title, done, ord) values
    (v_event,'6_MESI','Sopralluogo con gli sposi', true, 1),
    (v_event,'6_MESI','Firma contratto e acconto', true, 2),
    (v_event,'3_MESI','Definizione menu e prova assaggio', true, 3),
    (v_event,'1_MESE','Conferma numero invitati e allergie', false, 4),
    (v_event,'1_MESE','Piano tavoli e tableau', false, 5),
    (v_event,'1_SETTIMANA','Briefing staff sala e cucina', false, 6);

  insert into public.event_timeline(entry_id, ord, start_time, duration_min, title, location, is_critical) values
    (v_event,1,'16:30',30,'Arrivo e accoglienza ospiti','Viale degli ulivi', false),
    (v_event,2,'17:00',45,'Cerimonia civile','Gazebo giardino', true),
    (v_event,3,'18:00',90,'Aperitivo e angolo cocktail','Terrazza', false),
    (v_event,4,'20:00',150,'Cena placée','Sala degli archi', true),
    (v_event,5,'23:00',60,'Taglio torta e brindisi','Giardino', true),
    (v_event,6,'23:30',180,'Festa e dj set','Sala degli archi', false);

  -- 7. "MAGAZZINO CUCINA" via budget (voci/quantità della spesa cucina)
  insert into public.budget_categories(entry_id, name, planned_amount, color, ord)
  values (v_event, 'Cucina & Catering', 9000, '#c9a227', 1) returning id into v_cat;
  insert into public.budget_entries(category_id, entry_id, description, amount, paid) values
    (v_cat, v_event, 'Carne e pesce — 120 coperti', 2600, true),
    (v_cat, v_event, 'Frutta e verdura di stagione', 700, true),
    (v_cat, v_event, 'Vini e bevande (cantina locale)', 1900, false),
    (v_cat, v_event, 'Dolci e torta nuziale', 1200, false),
    (v_cat, v_event, 'Materiale monouso e tovagliato', 600, true);

  -- 8. Extra demo: bomboniere/tableau/menu + alloggio convenzionato
  insert into public.event_gadgets(entry_id, kind, name, quantity, quantity_basis, unit_cost, status) values
    (v_event,'BOMBONIERA','Bomboniera olio EVO della tenuta',120,'PER_GUEST',8,'ORDINATO'),
    (v_event,'TABLEAU','Tableau de mariage su legno d''ulivo',1,'FLAT',180,'APPROVATO'),
    (v_event,'MENU_STAMPATO','Menu stampati per tavolo',16,'PER_TABLE',3,'IDEA');

  insert into public.event_accommodations(entry_id, kind, name, city, rooms_blocked, rooms_used, rate_per_night, distance_km)
  values (v_event,'HOTEL','Hotel Borgo degli Ulivi','Lamezia Terme', 15, 8, 95, 12);

end $$;
