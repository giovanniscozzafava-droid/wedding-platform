-- ============================================================================
-- SEED servizi per i fornitori test (così Sara vede catalogo popolato).
-- Per ogni fornitore test, crea 2 servizi pertinenti al subrole con prezzo
-- realistico. Idempotente: skip se ha già servizi.
-- ============================================================================

do $$
declare
  v_forn record;
  v_cat_id uuid;
  v_count_inserted int := 0;
begin
  for v_forn in
    select p.id, p.subrole, p.business_name
      from profiles p
      join auth.users u on u.id = p.id
     where u.email like '%@planfully.test'
       and p.role = 'FORNITORE'
       and not exists (select 1 from services s where s.fornitore_id = p.id)
  loop
    -- Trova una category_id del subrole (la prima per nome)
    select id into v_cat_id
      from service_categories
     where subrole = v_forn.subrole
     order by name asc limit 1;

    if v_cat_id is null then
      raise notice 'No category for subrole %, skip', v_forn.subrole;
      continue;
    end if;

    -- Servizi per subrole
    if v_forn.subrole = 'fotografo' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Servizio fotografico 8 ore', 'Reportage completo della giornata, dal getting ready al taglio della torta. Consegna 350+ foto editate in 6 settimane.', 1800, 'EVENTO', true, 1),
        (v_forn.id, v_cat_id, 'Album fine art 30x30', 'Album 30 pagine, copertina in lino, stampa fine art certificata.', 450, 'PEZZO', true, 2);

    elsif v_forn.subrole = 'fioraio' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Bouquet sposa stile naturale', 'Composizione con peonie, eucalipto e fiori di stagione, legato a mano con nastro in seta.', 120, 'PEZZO', true, 1),
        (v_forn.id, v_cat_id, 'Centrotavola tondo elegante', 'Composizione bassa per tavolo rotondo, candele e fiori di stagione.', 85, 'PEZZO', true, 2);

    elsif v_forn.subrole = 'catering' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Menu seduti 5 portate', 'Antipasto, primo, secondo di carne o pesce, contorno, dessert. Vini inclusi.', 95, 'PERSONA', true, 1),
        (v_forn.id, v_cat_id, 'Aperitivo con isole tematiche', 'Buffet con 3 isole gastronomiche, finger food caldi e freddi, bollicine.', 35, 'PERSONA', true, 2);

    elsif v_forn.subrole = 'musica' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'DJ set serata completa', 'Console professionale, 6 ore di musica, microfono per testimoni, gestione richieste.', 800, 'EVENTO', true, 1),
        (v_forn.id, v_cat_id, 'Musicista solo cerimonia', 'Violino o sax acustico per la cerimonia, 45 minuti di repertorio personalizzato.', 350, 'EVENTO', true, 2);

    elsif v_forn.subrole = 'allestimenti' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Allestimento sala completo', 'Tavoli, sedie chiavari, runner, posate cerimoniali, candelabri.', 1500, 'EVENTO', true, 1),
        (v_forn.id, v_cat_id, 'Pista da ballo LED 5x5m', 'Pista luminosa programmabile, installazione e disinstallazione incluse.', 600, 'EVENTO', true, 2);

    elsif v_forn.subrole = 'pasticcere' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Wedding cake 3 piani', 'Torta a 3 piani per 80 persone, decorazione personalizzata, gusto a scelta.', 350, 'PEZZO', true, 1),
        (v_forn.id, v_cat_id, 'Confettata classica 80 persone', 'Tavolo confetti con 5 gusti, contenitori in vetro, sacchetti tulle.', 280, 'EVENTO', true, 2);

    elsif v_forn.subrole = 'make_up' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Trucco sposa con prova', 'Prova trucco 1 ora + trucco giorno dell evento, ritocco pomeridiano incluso.', 280, 'PEZZO', true, 1),
        (v_forn.id, v_cat_id, 'Trucco invitate', 'Trucco per damigelle o invitate, 30 min ciascuna, ciglia incluse.', 80, 'PEZZO', true, 2);

    elsif v_forn.subrole = 'photobooth' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Photobooth open air 4 ore', 'Cabina open air con fondale floreale, stampe illimitate, album, props.', 650, 'EVENTO', true, 1);

    elsif v_forn.subrole = 'estetista' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Manicure sposa', 'Ricostruzione gel + decorazione minimal, 90 minuti.', 50, 'PEZZO', true, 1),
        (v_forn.id, v_cat_id, 'Massaggio pre-evento', 'Massaggio rilassante 60 minuti, oli essenziali.', 80, 'PEZZO', true, 2);

    elsif v_forn.subrole = 'maitre' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Coordinamento sala completo', 'Direzione personale, timing rigoroso, gestione fornitori. Serata intera.', 450, 'EVENTO', true, 1);

    elsif v_forn.subrole = 'chef' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Show cooking pesce crudo', 'Postazione live con tartare, carpacci, gamberi viola. Cuoco dedicato.', 80, 'PERSONA', true, 1);

    elsif v_forn.subrole = 'sommelier' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Degustazione vini guidata', 'Selezione di 4 vini calabresi raccontati, abbinamento con il menu.', 25, 'PERSONA', true, 1);

    elsif v_forn.subrole = 'food_truck' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Pizza forno legna fino a 100 persone', 'Forno mobile, 3 gusti a rotazione, impasto 48h lievitazione.', 1200, 'EVENTO', true, 1);

    elsif v_forn.subrole = 'sweet_table' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Sweet table 80 persone', '6 tipologie di dolci, allestimento curato, etichette personalizzate.', 350, 'EVENTO', true, 1);

    elsif v_forn.subrole = 'bartender' then
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, 'Open bar 6 ore', 'Cocktail bar con 8 ricette signature, bartender qualificato, scenografia.', 950, 'EVENTO', true, 1);

    else
      -- Subrole non gestito (raro), crea un servizio generico
      insert into services (fornitore_id, category_id, name, description, base_price, unit, is_active, display_order)
      values
        (v_forn.id, v_cat_id, format('Servizio %s', v_forn.subrole), 'Servizio professionale.', 500, 'EVENTO', true, 1);
    end if;

    v_count_inserted := v_count_inserted + 1;
  end loop;

  raise notice '✓ Servizi seedati per % fornitori test', v_count_inserted;
end $$;

-- Verifica: quanti servizi vede Sara nei fornitori in pancia
do $$
declare
  v_sara uuid;
  v_total_services int;
  v_total_forn_with_services int;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';

  select count(distinct s.id) into v_total_services
    from services s
    join collaborations c on c.fornitore_id = s.fornitore_id
   where c.capostipite_id = v_sara and c.status = 'ACTIVE' and s.is_active = true;

  select count(distinct s.fornitore_id) into v_total_forn_with_services
    from services s
    join collaborations c on c.fornitore_id = s.fornitore_id
   where c.capostipite_id = v_sara and c.status = 'ACTIVE' and s.is_active = true;

  raise notice '════ Catalogo visibile a Sara ════';
  raise notice '  Servizi totali: %', v_total_services;
  raise notice '  Fornitori che hanno servizi: %', v_total_forn_with_services;
end $$;
