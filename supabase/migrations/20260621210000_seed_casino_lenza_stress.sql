-- STRESS TEST Casino Lenza (LOCATION): 4 matrimoni reali (2 back-to-back stesso weekend), menu
-- completo, tavoli, ~450 invitati con rsvp/età/diete variabili. Il matrimonio #1 è collegato a un
-- account COUPLE reale (giovanni.scozzafava+lenzasposi@gmail.com) per testare il POV cliente.
-- NB: il modulo "Operations" (acquisti/magazzino multi-evento) è CONGELATO → non toccato.
-- Idempotente: marcatore notes='lenza-demo' su calendar_entries_private.
do $lenza$
declare
  v_loc uuid; v_couple uuid; v_entry uuid; v_sposi uuid; v_tabids uuid[];
  v_first text[] := array['Giulia','Marco','Serena','Antonio','Chiara','Luca','Federica','Davide','Anna','Paolo','Sofia','Luigi','Elena','Francesco','Martina','Giuseppe','Alice','Roberto','Sara','Andrea','Laura','Matteo','Valentina','Stefano'];
  v_last  text[] := array['Russo','Esposito','Greco','Bruno','Romano','Costa','Mancini','Rizzo','Conti','De Luca','Marino','Gallo','Ferrari','Lombardi','Barbieri','Fontana','Caruso','Ferraro','Santoro','Vitale','Longo','Serra','Coppola','Villa'];
  v_cnames text[] := array['Giulia & Marco','Serena & Antonio','Chiara & Luca','Federica & Davide'];
  v_dates  date[] := array['2026-09-12','2026-09-13','2026-07-04','2026-10-18'];
  v_ng     int[]  := array[130, 90, 150, 80];
  v_val    numeric[] := array[24000, 18500, 31000, 16000];
  i int; g int; t int; v_ntab int; v_nf int; v_nl int;
  v_rsvp rsvp_status; v_age guest_age_group; v_diet text;
begin
  select id into v_loc from auth.users where lower(email) = lower('giovanni.scozzafava+lenza@gmail.com');
  if v_loc is null then raise notice 'Casino Lenza non trovato, salto'; return; end if;
  select id into v_couple from auth.users where lower(email) = lower('giovanni.scozzafava+lenzasposi@gmail.com');
  v_nf := array_length(v_first,1); v_nl := array_length(v_last,1);

  update public.profiles set
    role='LOCATION', full_name='Casino Lenza', business_name='Casino Lenza', subrole='Location',
    city='Lamezia Terme', province='CZ', phone=coalesce(nullif(phone,''),'+39 0968 000000'),
    bio='Antica residenza di caccia dell''800 immersa nel verde: spazi interni ed esterni per ricevimenti di classe, anche con un numero elevato di invitati.',
    onboarding_complete=true
  where id=v_loc;

  if exists (select 1 from public.calendar_entries ce join public.calendar_entries_private p on p.entry_id=ce.id
             where ce.owner_id=v_loc and p.notes='lenza-demo') then
    raise notice 'Casino Lenza: gia seedato, salto'; return;
  end if;

  for i in 1 .. array_length(v_cnames,1) loop
    insert into public.calendar_entries(owner_id, title, date_from, date_to, status, event_kind)
      values (v_loc, v_cnames[i], v_dates[i], v_dates[i], 'CONFERMATA', 'matrimonio')
      returning id into v_entry;
    insert into public.calendar_entries_private(entry_id, client_name, client_email, value_amount, notes)
      values (v_entry, v_cnames[i], 'cliente'||i||'@example.com', v_val[i], 'lenza-demo')
      on conflict (entry_id) do update set
        client_name=excluded.client_name, client_email=excluded.client_email,
        value_amount=excluded.value_amount, notes=excluded.notes;

    -- coppia: sul matrimonio #1 collego l'account COUPLE reale (POV cliente)
    insert into public.wedding_couple_members(entry_id, user_id, email, full_name, role, invite_token, invited_at, accepted_at)
      values (v_entry,
              case when i=1 then v_couple else null end,
              case when i=1 then 'giovanni.scozzafava+lenzasposi@gmail.com' else 'sposa'||i||'@example.com' end,
              split_part(v_cnames[i],' & ',1), 'SPOSA', gen_random_uuid(), now(),
              case when i=1 then now() else null end);
    insert into public.wedding_couple_members(entry_id, email, full_name, role, invite_token, invited_at)
      values (v_entry, 'sposo'||i||'@example.com', split_part(v_cnames[i],' & ',2), 'SPOSO', gen_random_uuid(), now());

    -- menu calabrese completo
    insert into public.event_menu(entry_id, section, ord, title, description, price_per_guest, included_in_package) values
      (v_entry,'BENVENUTO',1,'Aperitivo di benvenuto','Bollicine, sfizi caldi e freddi del territorio',0,true),
      (v_entry,'ANTIPASTO',2,'Antipasto calabrese','Nduja, soppressata, caciocavallo silano, melanzane',0,true),
      (v_entry,'PRIMO',3,'Fileja al sugo di capra','Pasta fresca tradizionale',0,true),
      (v_entry,'PRIMO',4,'Risotto al bergamotto','Mantecato agli agrumi di Calabria',0,true),
      (v_entry,'SECONDO',5,'Filetto di maiale nero','Riduzione al Cirò rosso',0,true),
      (v_entry,'SECONDO',6,'Spigola in crosta','Pescato del Tirreno',0,true),
      (v_entry,'CONTORNO',7,'Verdure dell''orto','Grigliate e in agrodolce',0,true),
      (v_entry,'DOLCE',8,'Tris di dolci calabresi','Tartufo di Pizzo, cannoli, mostaccioli',0,true),
      (v_entry,'TORTA',9,'Taglio della torta nuziale',null,0,true),
      (v_entry,'CAFFE',10,'Caffè e ammazzacaffè','Liquori del territorio',0,true);

    -- tavolo sposi + tavoli rotondi (griglia)
    insert into public.event_tables(entry_id, table_no, label, seats, shape, pos_x, pos_y, is_staff)
      values (v_entry, 0, 'Tavolo Sposi', 2, 'HEAD', 0.5, 0.12, true) returning id into v_sposi;
    v_ntab := greatest(6, ceil(v_ng[i]::numeric / 9));
    for t in 1 .. v_ntab loop
      insert into public.event_tables(entry_id, table_no, label, seats, shape, pos_x, pos_y, is_staff)
        values (v_entry, t, 'Tavolo '||t, 10, 'ROUND',
                0.12 + ((t-1) % 4) * 0.25,
                0.30 + floor((t-1)/4) * 0.18, false);
    end loop;
    select array_agg(id order by table_no) into v_tabids from public.event_tables where entry_id=v_entry and not is_staff;

    -- invitati distribuiti, con rsvp/età/diete variabili
    for g in 1 .. v_ng[i] loop
      v_rsvp := (case when g % 20 = 0 then 'NO' when g % 13 = 0 then 'MAYBE' when g % 7 = 0 then 'PENDING' else 'YES' end)::rsvp_status;
      v_age  := (case when g % 25 = 0 then 'INFANT' when g % 9 = 0 then 'CHILD' else 'ADULT' end)::guest_age_group;
      v_diet := case when g % 12 = 0 then 'Vegetariano' when g % 17 = 0 then 'Senza glutine' else null end;
      insert into public.event_guests(entry_id, full_name, party_size, rsvp, age_group, diet, table_id, sort_order)
        values (v_entry,
                v_first[1 + (g*7) % v_nf] || ' ' || v_last[1 + (g*13) % v_nl],
                1, v_rsvp, v_age, v_diet,
                case when g <= 2 then v_sposi else v_tabids[1 + (g % array_length(v_tabids,1))] end,
                g);
    end loop;
  end loop;
  raise notice 'Casino Lenza: % matrimoni seedati', array_length(v_cnames,1);
end$lenza$;
