-- ===========================================================================
-- SIMULAZIONE: costruisci un intero matrimonio sotto +provola (Giovanni)
-- Eseguito tramite: supabase db query --linked --file tests/e2e/build_wedding_provola.sql
-- IDEMPOTENTE: re-run cancella e ricrea solo l'entry "Tommaso e Beatrice"
-- ===========================================================================
do $$
declare
  v_wp uuid := '5a427e9b-4bc8-48cd-ae86-5f17ac477016'; -- giovanni.scozzafava+provola@gmail.com
  v_title text := 'Tommaso e Beatrice';
  v_entry uuid;
  v_quote uuid := gen_random_uuid();
  v_event_date date := '2026-09-19';
  v_se record;
  v_table_id uuid;
  v_acc1 uuid := gen_random_uuid();
  v_acc2 uuid := gen_random_uuid();
  v_transport uuid := gen_random_uuid();
  v_subev record;
  v_g_idx int;
  v_rsvp text;
  v_age text;
  v_side text;
  v_table_rows uuid[];
  v_total_client numeric := 0;
  v_qi record;
begin
  -- 0. Pulizia idempotente: rimuovi entry esistente con stesso titolo+owner
  delete from public.calendar_entries
   where owner_id = v_wp and title = v_title;

  -- 1. Calendar entry (wedding) gestito da WP +provola
  v_entry := gen_random_uuid();
  insert into public.calendar_entries (
    id, owner_id, title, client_name, client_email,
    date_from, date_to, status, event_kind,
    ceremony_type, ceremony_status,
    ceremony_venue_name, ceremony_venue_address, ceremony_city, ceremony_date,
    ceremony_contact_name, ceremony_contact_phone, ceremony_notes,
    business_model, evento_stato, ambito_capostipite, modalita_incasso, value_amount, notes
  ) values (
    v_entry, v_wp, v_title,
    'Tommaso Provola', 'tommaso.provola@example.it',
    v_event_date, v_event_date, 'CONFERMATA', 'matrimonio',
    'RELIGIOUS', 'BOOKED',
    'Chiesa di San Nicola', 'Piazza Sprovieri 1', 'Acri',
    (v_event_date::text || 'T11:00:00+02:00')::timestamptz,
    'Don Giuseppe Greco', '+39 098 412345',
    'Si chiede arrivo invitati per le 10:45. Rito breve, comunione facoltativa.',
    'GLOBAL', 'PIANIFICAZIONE', 'COMPLETO', 'INTERO', 0,
    'Matrimonio di fascia alta con accoglienza in villa, cerimonia in centro storico Acri, ricevimento serale.'
  );

  -- 2. Quote (preventivo accettato, rev. 1)
  insert into public.quotes (
    id, owner_id, title, client_name, client_email,
    event_date, event_location, event_kind, status, revision,
    guest_count, table_count, default_markup_percent,
    total_cost, total_client, margin_amount, margin_percent,
    accepted_at, sent_at, access_token
  ) values (
    v_quote, v_wp, v_title,
    'Tommaso Provola', 'tommaso.provola@example.it',
    v_event_date, 'Villa San Martino, Acri (CS)', 'matrimonio', 'ACCETTATO', 1,
    100, 10, 0,
    0, 0, 0, 0,
    now() - interval '5 days', now() - interval '6 days', gen_random_uuid()
  );

  -- 3. Quote items: copia da catalogo +provola (14 servizi)
  insert into public.quote_items (
    quote_id, supplier_id, service_id,
    name_snapshot, description_snapshot, unit_snapshot, snapshot_price,
    quantity, quantity_basis, line_client, sort_order,
    erogatore_e_capostipite, is_optional
  )
  select
    v_quote, s.fornitore_id, s.id,
    s.name, s.description, s.unit, s.base_price,
    case s.unit::text
      when 'PERSONA' then 100  -- 100 invitati
      when 'ORA'     then 6    -- 6 ore evento
      else 1                   -- PEZZO/EVENTO
    end,
    case s.unit::text
      when 'PERSONA' then 'PER_GUEST'::quantity_basis
      when 'ORA'     then 'PER_HOUR'::quantity_basis
      else 'FLAT'::quantity_basis
    end,
    s.base_price * case s.unit::text
      when 'PERSONA' then 100
      when 'ORA'     then 6
      else 1
    end,
    row_number() over (order by s.created_at) - 1,
    true,  -- erogatore_e_capostipite (WP eroga i propri servizi)
    false
  from public.services s
   where s.fornitore_id = v_wp;

  -- Aggiorna totals quote dai items
  select coalesce(sum(line_client),0) into v_total_client
    from public.quote_items where quote_id = v_quote;
  update public.quotes
     set total_client = v_total_client,
         total_cost = v_total_client,
         margin_amount = 0,
         margin_percent = 0
   where id = v_quote;

  -- 4. Link entry <-> quote
  update public.calendar_entries set quote_id = v_quote, value_amount = v_total_client
   where id = v_entry;

  -- 5. Sub-eventi (programma weekend matrimonio)
  for v_subev in select * from (values
    ('REHEARSAL', 'Rehearsal Dinner', 'Cena prove generali con familiari stretti',
     v_event_date::timestamptz - interval '1 day' + interval '20 hours', 180,
     'Trattoria Sila Vecchia, Acri', 20, 'CONFERMATO'),
    ('WELCOME_DINNER', 'Aperitivo di benvenuto', 'Bollicine + finger food calabresi (post-cerimonia)',
     v_event_date::timestamptz + interval '12 hours 30 minutes', 90,
     'Villa San Martino, terrazza panoramica', 100, 'CONFERMATO'),
    ('ALTRO', 'Pranzo di nozze', 'Menu di terra e mare, 7 portate',
     v_event_date::timestamptz + interval '14 hours', 240,
     'Villa San Martino, sala specchi', 100, 'CONFERMATO'),
    ('ALTRO', 'Taglio della torta', 'Wedding cake 3 piani crema e frutti rossi',
     v_event_date::timestamptz + interval '18 hours', 30,
     'Villa San Martino, giardino', 100, 'CONFERMATO'),
    ('ALTRO', 'Festa con DJ + spettacolo pirotecnico', 'Open bar, dj set, fuochi 22:30',
     v_event_date::timestamptz + interval '19 hours', 240,
     'Villa San Martino, area lounge', 100, 'CONFERMATO'),
    ('BRUNCH_POST', 'Brunch del giorno dopo', 'Per ospiti che si fermano',
     v_event_date::timestamptz + interval '1 day' + interval '11 hours', 120,
     'Villa San Martino, veranda', 40, 'CONFERMATO')
  ) as t(kind, title, descr, dt, dur, loc, cap, st)
  loop
    insert into public.event_subevents (
      entry_id, kind, title, description, date_at, duration_min, location, capacity, status
    ) values (
      v_entry, v_subev.kind::subevent_kind, v_subev.title, v_subev.descr, v_subev.dt, v_subev.dur, v_subev.loc, v_subev.cap, v_subev.st
    );
  end loop;

  -- 6. Tavoli (10 tavoli da 10)
  for v_g_idx in 1..10 loop
    insert into public.event_tables (entry_id, table_no, label, seats)
    values (v_entry, v_g_idx, 'Tavolo ' || v_g_idx, 10)
    returning id into v_table_id;
    v_table_rows := array_append(v_table_rows, v_table_id);
  end loop;

  -- 7. Invitati (100 - mix RSVP, lati, eta`, diete)
  for v_g_idx in 1..100 loop
    v_rsvp := case
      when v_g_idx <= 80 then 'YES'
      when v_g_idx <= 90 then 'PENDING'
      else 'NO'
    end;
    v_age := case
      when v_g_idx between 88 and 95 then 'CHILD'
      when v_g_idx in (96, 97) then 'INFANT'
      else 'ADULT'
    end;
    v_side := case (v_g_idx % 3) when 0 then 'ENTRAMBI' when 1 then 'SPOSA' else 'SPOSO' end;

    insert into public.event_guests (
      entry_id, full_name, email, rsvp, age_group, party_size, side, diet, table_id, notes
    ) values (
      v_entry,
      'Ospite ' || v_g_idx || ' ' || (array['Bianchi','Rossi','Verdi','Russo','Esposito','Greco','Ferrari','Sasso','Liguori','Bruno'])[((v_g_idx-1) % 10) + 1],
      'ospite' || v_g_idx || '@test.it',
      v_rsvp::rsvp_status, v_age::guest_age_group, 1, v_side,
      case
        when v_g_idx % 14 = 0 then 'vegetariano'
        when v_g_idx % 19 = 0 then 'vegano'
        when v_g_idx % 23 = 0 then 'celiaco'
        when v_g_idx % 31 = 0 then 'no_lattosio'
        else null
      end,
      case when v_rsvp = 'YES' then v_table_rows[((v_g_idx - 1) % 10) + 1] else null end,
      case when v_g_idx % 47 = 0 then 'Necessita posto in prima fila' else null end
    );
  end loop;

  -- 8. Alloggi (2 strutture vicine)
  insert into public.event_accommodations (id, entry_id, name, kind, address, city,
    check_in, check_out, rooms_blocked, rooms_used, rate_per_night, currency, notes)
  values
    (v_acc1, v_entry, 'Boutique Hotel Acri Suite', 'HOTEL',
     'Via Roma 14', 'Acri',
     (v_event_date - 1),
     (v_event_date + 1),
     30, 18, 110, 'EUR',
     'Convenzione sposi: prima colazione inclusa, navetta serale gratuita.'),
    (v_acc2, v_entry, 'B&B Le Querce', 'BNB',
     'Contrada Serra 7', 'Acri',
     (v_event_date - 1),
     (v_event_date + 1),
     12, 8, 75, 'EUR',
     'Per famiglie con bambini, giardino privato, parcheggio.');

  -- 9. Trasporto (navetta hotel <-> villa)
  insert into public.event_transport (id, entry_id, kind, label, provider, contact_phone, capacity,
    depart_at, depart_from, arrive_at, arrive_to, cost, currency, notes)
  values (
    v_transport, v_entry, 'PULMINO_NAVETTA', 'Navetta ospiti hotel -> villa',
    'Cosenza Bus Service', '+39 0984 555 0123', 30,
    v_event_date::timestamptz + interval '12 hours',
    'Hotel Acri Suite, Via Roma 14',
    v_event_date::timestamptz + interval '12 hours 30 minutes',
    'Villa San Martino, Strada Provinciale 232',
    250, 'EUR',
    'Due corse: aller 12:00, ritorno 01:30 dopo party. Driver con lista invitati hotel.'
  );

  -- 10. Mood board (immagini stock con tag)
  insert into public.mood_images (entry_id, url, source, caption, tag, ord, source_url, source_title)
  values
    (v_entry, 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200', 'PINTEREST', 'Tavolo lungo con fiori in cascata', 'tavoli', 0, 'https://pinterest.com/example/1', 'Long table romance'),
    (v_entry, 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200', 'INSTAGRAM', 'Bouquet sposa peonie + eucalipto', 'bouquet', 1, 'https://www.instagram.com/p/example1/', 'Bouquet ispirazione'),
    (v_entry, 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=1200', 'PINTEREST', 'Centrotavola candele + olivo', 'centrotavola', 2, 'https://pinterest.com/example/2', 'Mediterranean centerpiece'),
    (v_entry, 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=1200', 'WEB', 'Lounge area outdoor con luci calde', 'allestimento', 3, 'https://example.com/lounge', 'Outdoor lounge'),
    (v_entry, 'https://images.unsplash.com/photo-1525258946800-98cfd641d0de?w=1200', 'PINTEREST', 'Cerimonia in chiesa con petali', 'cerimonia', 4, 'https://pinterest.com/example/3', 'Church ceremony'),
    (v_entry, 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200', 'INSTAGRAM', 'Taglio torta con sparkler', 'torta', 5, null, null);

  -- 11. Playlist (6 brani per momenti chiave)
  insert into public.event_playlist (entry_id, moment, song_title, artist, notes, ord)
  values
    (v_entry, 'CERIMONIA',    'A Thousand Years',          'Christina Perri', 'Ingresso sposa, versione strumentale', 0),
    (v_entry, 'CERIMONIA',    'Signed, Sealed, Delivered', 'Stevie Wonder',   'Uscita sposi dalla chiesa', 1),
    (v_entry, 'PRIMA_DANZA',  'At Last',                   'Etta James',      'Primo ballo, versione studio', 2),
    (v_entry, 'TAGLIO_TORTA', 'Lovely Day',                'Bill Withers',    'Durante taglio torta', 3),
    (v_entry, 'FESTA',        'Uptown Funk',               'Bruno Mars',      'Apertura dancefloor', 4),
    (v_entry, 'FESTA',        'Don''t Stop Believin''',    'Journey',         'Ultimo brano della serata', 5);

  -- 12. Bomboniere/gadget
  insert into public.event_gadgets (entry_id, kind, name, quantity, quantity_basis, unit_cost, supplier_external, notes)
  values
    (v_entry, 'CONFETTI',    'Confettata classica calabrese',                100, 'PER_GUEST', 4.50, 'Pasticceria San Pio', 'Confetti Sulmona + sacchettino lino'),
    (v_entry, 'BOMBONIERA',  'Bomboniera bottiglietta olio EVO 100ml',       100, 'PER_GUEST', 8.00, 'Frantoio Greco',      'Etichetta personalizzata sposi'),
    (v_entry, 'GADGET',      'Ventaglio personalizzato cerimonia',           100, 'PER_GUEST', 2.50, 'Stamperia Le Muse',   'Per cerimonia in chiesa, anti-caldo'),
    (v_entry, 'WELCOME_BAG', 'Kit hangover bag party',                       50,  'FLAT',      6.00, 'Internal',            'Acqua, aspirina, mentine — per ospiti party tardiva');

  -- 13. Timeline giorno matrimonio (momenti chiave)
  insert into public.event_timeline (entry_id, ord, start_time, duration_min, title, description, location, is_critical)
  values
    (v_entry, 0, v_event_date::timestamptz + interval '10 hours',                  60,  'Arrivo fornitori in villa',  'Catering, fioraio, light design',  'Villa San Martino',          true),
    (v_entry, 1, v_event_date::timestamptz + interval '10 hours 30 minutes',       30,  'Vestizione sposa',           'Suite nuziale, fotografo',         'B&B Le Querce, suite nuziale', false),
    (v_entry, 2, v_event_date::timestamptz + interval '22 hours 30 minutes',        6,  'Spettacolo pirotecnico',     'Durata 6 minuti, lato villa',      'Villa San Martino, lato giardino', true);

  raise notice 'Wedding "%" creato con id %. Quote: %. Totale cliente: % EUR. 100 invitati, 10 tavoli, 7 sub-eventi, 2 alloggi, 1 trasporto, 6 mood board, 6 playlist, 4 bomboniere.',
    v_title, v_entry, v_quote, v_total_client;
end$$;
