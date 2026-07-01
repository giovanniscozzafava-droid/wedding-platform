-- Demo tableau: la lista invitati di "Matrimonio Greco · Fabiani" risultava vuota (0 ospiti) →
-- "tutti seduti" ma nessuno da sedere. Ripopoliamo con una lista realistica, TUTTI da sedere
-- (table_id null), così il tableau drag-to-seat è utilizzabile in demo.
do $$
declare v_loc uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; v_event uuid;
begin
  select id into v_event from public.calendar_entries where owner_id = v_loc and title ilike '%greco%' order by date_from limit 1;
  if v_event is null then select id into v_event from public.calendar_entries where owner_id = v_loc order by date_from limit 1; end if;
  if v_event is null then raise notice 'nessun evento Greco/owner Tenuta'; return; end if;

  delete from public.event_guests where entry_id = v_event; -- reset lista per demo pulita

  insert into public.event_guests(entry_id, full_name, party_size, rsvp, side, group_label, table_id)
  select v_event, x.nm, 1, 'YES'::rsvp_status, x.sd, x.gl, null
  from (values
    -- Famiglia sposa (Greco)
    ('Marta Greco','SPOSA','Famiglia sposa'),('Antonio Greco','SPOSA','Famiglia sposa'),('Rosa Greco','SPOSA','Famiglia sposa'),
    ('Luigi Greco','SPOSA','Famiglia sposa'),('Caterina Greco','SPOSA','Famiglia sposa'),('Salvatore Greco','SPOSA','Famiglia sposa'),
    ('Angela Greco','SPOSA','Famiglia sposa'),('Domenico Greco','SPOSA','Famiglia sposa'),('Teresa Greco','SPOSA','Famiglia sposa'),
    ('Franco Greco','SPOSA','Famiglia sposa'),('Lucia Greco','SPOSA','Famiglia sposa'),('Pietro Greco','SPOSA','Famiglia sposa'),
    -- Famiglia sposo (Fabiani)
    ('Luca Fabiani','SPOSO','Famiglia sposo'),('Giuseppe Fabiani','SPOSO','Famiglia sposo'),('Anna Fabiani','SPOSO','Famiglia sposo'),
    ('Mario Fabiani','SPOSO','Famiglia sposo'),('Carmela Fabiani','SPOSO','Famiglia sposo'),('Vincenzo Fabiani','SPOSO','Famiglia sposo'),
    ('Maria Fabiani','SPOSO','Famiglia sposo'),('Nicola Fabiani','SPOSO','Famiglia sposo'),('Concetta Fabiani','SPOSO','Famiglia sposo'),
    ('Aldo Fabiani','SPOSO','Famiglia sposo'),('Rita Fabiani','SPOSO','Famiglia sposo'),('Sergio Fabiani','SPOSO','Famiglia sposo'),
    -- Amici sposa
    ('Giulia Rossi','SPOSA','Amici sposa'),('Francesca Bianchi','SPOSA','Amici sposa'),('Elena Costa','SPOSA','Amici sposa'),
    ('Sara Marino','SPOSA','Amici sposa'),('Valentina Ferrari','SPOSA','Amici sposa'),('Alessia Romano','SPOSA','Amici sposa'),
    ('Federica Gallo','SPOSA','Amici sposa'),('Martina Conti','SPOSA','Amici sposa'),('Ilaria Bruno','SPOSA','Amici sposa'),
    ('Noemi Villa','SPOSA','Amici sposa'),
    -- Amici sposo
    ('Marco Esposito','SPOSO','Amici sposo'),('Davide Russo','SPOSO','Amici sposo'),('Simone Colombo','SPOSO','Amici sposo'),
    ('Andrea Ricci','SPOSO','Amici sposo'),('Matteo Moretti','SPOSO','Amici sposo'),('Stefano Barbieri','SPOSO','Amici sposo'),
    ('Fabio Fontana','SPOSO','Amici sposo'),('Giorgio Santoro','SPOSO','Amici sposo'),('Emanuele Rizzo','SPOSO','Amici sposo'),
    ('Paolo Mariani','SPOSO','Amici sposo'),
    -- Colleghi
    ('Roberto De Luca','ENTRAMBI','Colleghi'),('Silvia Galli','ENTRAMBI','Colleghi'),('Claudio Lombardi','ENTRAMBI','Colleghi'),
    ('Monica Serra','ENTRAMBI','Colleghi'),('Giovanni Testa','ENTRAMBI','Colleghi'),('Laura Caruso','ENTRAMBI','Colleghi'),
    -- Parenti vari
    ('Franco Pellegrino','ENTRAMBI','Parenti'),('Ada Pellegrino','ENTRAMBI','Parenti'),('Dario Neri','ENTRAMBI','Parenti'),
    ('Elisa Neri','ENTRAMBI','Parenti'),('Assunta Greco','SPOSA','Parenti'),('Ciccio Fabiani','SPOSO','Parenti')
  ) x(nm, sd, gl);

  raise notice 'GRECO_FABIANI guests=% event=%', (select count(*) from public.event_guests where entry_id = v_event), v_event;
end $$;
