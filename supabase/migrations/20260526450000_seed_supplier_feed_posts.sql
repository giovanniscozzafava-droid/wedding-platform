-- Seed post realistici per i fornitori test, così il feed "La mia rete" di
-- Sara è popolato con contenuti reali della sua pancia di fornitori.
-- Idempotente: skip se il fornitore ha già post.

do $$
declare
  v_forn record;
  v_post_body text;
  v_post_media text[];
  i int := 1;
  v_count int := 0;
begin
  for v_forn in
    select p.id, p.subrole, p.business_name, p.created_at
      from profiles p
      join auth.users u on u.id = p.id
     where u.email like '%@planfully.test'
       and p.role = 'FORNITORE'
       and not exists (select 1 from posts po where po.author_id = p.id)
     order by p.created_at asc
     limit 25
  loop
    -- Body diversificato per subrole
    if v_forn.subrole = 'fotografo' then
      v_post_body := 'Matrimonio appena consegnato. Quando il setting è il mare e gli sposi sono presenti a se stessi, il fotografo fa quasi nulla. Solo testimone.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1519741497674-611481863552?w=1200'];
    elsif v_forn.subrole = 'fioraio' then
      v_post_body := 'Il bouquet di oggi: peonie crema, eucalipto parvifolia, fiordalisi blu. Tutto cresciuto nei nostri campi.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200'];
    elsif v_forn.subrole = 'catering' then
      v_post_body := 'Aperitivo con isola di pesce crudo. Tonno appena pescato, gamberi viola di Gallipoli, ricci di Crotone.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200'];
    elsif v_forn.subrole = 'musica' then
      v_post_body := 'DJ set serata appena conclusa. Pista piena fino alle 4 del mattino. Si balla ancora.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=1200'];
    elsif v_forn.subrole = 'allestimenti' then
      v_post_body := 'Allestimento sala 120 coperti. Eucalipto sospeso, candele, tavoli imperiali.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200'];
    elsif v_forn.subrole = 'pasticcere' then
      v_post_body := 'Wedding cake 4 piani con fiori freschi. Naked cake con crema chantilly e frutti rossi.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=1200'];
    elsif v_forn.subrole = 'make_up' then
      v_post_body := 'Trucco sposa di ieri. Glow naturale, focus sugli occhi, no foundation pesante. La pelle deve respirare.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200'];
    elsif v_forn.subrole = 'photobooth' then
      v_post_body := 'Photobooth open air. Tre ore di risate, 240 foto stampate, 0 facce serie.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200'];
    elsif v_forn.subrole = 'food_truck' then
      v_post_body := 'After party con pizza forno legna. 200 fette in 90 minuti. Ricetta nonna inclusa.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200'];
    elsif v_forn.subrole = 'sweet_table' then
      v_post_body := 'Sweet table all colors palette pastello. Macarons artigianali, mignon, cake pops personalizzati.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1200'];
    elsif v_forn.subrole = 'bartender' then
      v_post_body := 'Signature cocktail della serata: bergamotto, gin calabrese, basilico. Nome: Profumo di mare.';
      v_post_media := ARRAY['https://images.unsplash.com/photo-1551024601-bec78aea704b?w=1200'];
    else
      v_post_body := format('Aggiornamento dal lavoro di %s. La stagione è appena iniziata.', v_forn.subrole);
      v_post_media := ARRAY[]::text[];
    end if;

    insert into posts (
      author_id, post_type, body, media_urls, visibility,
      like_count, comment_count, created_at
    ) values (
      v_forn.id, 'SHORT', v_post_body, v_post_media, 'PUBLIC',
      floor(random() * 25 + 5)::int,
      floor(random() * 6)::int,
      now() - (random() * interval '12 days')
    );

    v_count := v_count + 1;
    i := i + 1;
  end loop;

  raise notice '✓ % post creati da fornitori test', v_count;
end $$;

-- Verifica visibilità nel feed di Sara
do $$
declare
  v_sara uuid;
  v_visible_in_network int;
  v_total_public int;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';

  -- Post visibili nel feed NETWORK di Sara (autori in pancia + autorizzati)
  select count(*) into v_visible_in_network
    from posts p
    join collaborations c on c.fornitore_id = p.author_id
   where c.capostipite_id = v_sara
     and c.status = 'ACTIVE'
     and p.visibility = 'PUBLIC';

  select count(*) into v_total_public
    from posts where visibility = 'PUBLIC';

  raise notice '════ Feed Sara visibility ════';
  raise notice '  Post network (dai fornitori in pancia): %', v_visible_in_network;
  raise notice '  Post pubblici totali sulla piattaforma: %', v_total_public;
end $$;
