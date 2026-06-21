-- DEMO seed per Elena Bitonte (WEDDING_PLANNER). Account creato a parte (auth.users) con email
-- giovanni.scozzafava+elenabitonte@gmail.com. Qui: profilo WP + categoria + carrellata di servizi
-- standard di wedding/event planning con foto (Pexels, licenza libera). Idempotente.
do $elena$
declare
  v_uid uuid;
  v_cat uuid;
  v_sid uuid;
  v_imgs text[] := array[
    'https://images.pexels.com/photos/29040917/pexels-photo-29040917.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/8251571/pexels-photo-8251571.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/29040997/pexels-photo-29040997.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/35985203/pexels-photo-35985203.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/35985211/pexels-photo-35985211.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/17240966/pexels-photo-17240966.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/4717558/pexels-photo-4717558.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/4717555/pexels-photo-4717555.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/8452759/pexels-photo-8452759.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/16120136/pexels-photo-16120136.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/10319485/pexels-photo-10319485.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/13694893/pexels-photo-13694893.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'];
  v_names text[] := array[
    'Consulenza iniziale','Coordinamento del giorno','Organizzazione parziale','Organizzazione completa',
    'Wedding & Event Design','Destination Wedding','Proposta & Engagement','Eventi privati & corporate'];
  v_descs text[] := array[
    'Un primo incontro per conoscerci, capire la tua visione e definire budget, stile e priorità dell''evento.',
    'Il giorno dell''evento penso io a tutto: timeline, regia, fornitori e imprevisti. Tu vivi la giornata, io la faccio funzionare.',
    'Hai già iniziato da sola? Subentro dove serve: selezione fornitori, budget, logistica e coordinamento finale.',
    'Dalla A alla Z: concept, location, fornitori, budget, design e coordinamento. Un unico riferimento, zero stress.',
    'Progetto l''estetica dell''evento: mood, palette, allestimenti, mise en place e tableau. Coerenza e cura in ogni dettaglio.',
    'Matrimoni ed eventi su misura in Puglia, Calabria e Sud Italia per coppie italiane e straniere: location, logistica e ospitalità.',
    'Organizzo la proposta perfetta o il party di fidanzamento: location, scenografia e regia del momento.',
    'Compleanni, anniversari, feste aziendali ed eventi privati curati con lo stesso gusto di un grande matrimonio.'];
  v_prices numeric[] := array[150, 1200, 2000, 3500, 2500, 5000, 800, 2000];
  v_i int;
begin
  select id into v_uid from auth.users where lower(email) = lower('giovanni.scozzafava+elenabitonte@gmail.com');
  if v_uid is null then
    raise notice 'Elena Bitonte: utente non trovato, salto il seed';
    return;
  end if;

  -- Profilo WEDDING_PLANNER
  update public.profiles set
    role = 'WEDDING_PLANNER',
    full_name = 'Elena Bitonte',
    business_name = 'Elena Bitonte — Wedding & Event Planner',
    subrole = 'Wedding Planner',
    phone = coalesce(nullif(phone,''), '+39 329 7415751'),
    city = coalesce(nullif(city,''), 'Bari'),
    bio = 'Wedding & event planner e designer (IED Milano). Organizzo matrimoni ed eventi su misura — eleganti, armoniosi, con un tocco di unicità. Specializzata in destination wedding in Puglia, Calabria e Sud Italia.',
    onboarding_complete = true
  where id = v_uid;

  -- evita doppioni
  if exists (select 1 from public.services where fornitore_id = v_uid and 'elena-demo' = any(tags)) then
    raise notice 'Elena Bitonte: catalogo gia presente, salto';
    return;
  end if;

  -- categoria
  insert into public.service_categories(name, slug, subrole, is_standard, created_by)
    values ('Wedding & Event Planning', 'wedding-planning-elena-bitonte', 'Wedding Planner', false, v_uid)
    on conflict (slug) do update set name = excluded.name
    returning id into v_cat;

  -- servizi + 2 foto ciascuno
  for v_i in 1 .. array_length(v_names, 1) loop
    insert into public.services(fornitore_id, category_id, name, description, base_price, unit, is_active, display_order, tags)
      values (v_uid, v_cat, v_names[v_i], v_descs[v_i], v_prices[v_i], 'EVENTO', true, v_i,
              array['planner','wedding-planning','elena-demo'])
      returning id into v_sid;
    insert into public.service_photos(service_id, original_url, thumbnail_url, sort_order) values
      (v_sid, v_imgs[1 + ((v_i - 1) * 2) % 12], replace(v_imgs[1 + ((v_i - 1) * 2) % 12], 'h=650&w=940', 'h=350&w=500'), 0),
      (v_sid, v_imgs[1 + ((v_i - 1) * 2 + 1) % 12], replace(v_imgs[1 + ((v_i - 1) * 2 + 1) % 12], 'h=650&w=940', 'h=350&w=500'), 1);
  end loop;

  raise notice 'Elena Bitonte: profilo WP + % servizi seedati', array_length(v_names,1);
end$elena$;
