-- ============================================================================
-- SEED demo posts — popola il feed con contenuti realistici dai profili
-- esistenti (WP/Location/Fornitori) per testare trending, like, articoli.
-- Idempotente: usa slug univoci con prefisso 'demo-' così è facile da
-- rimuovere se necessario.
-- ============================================================================

do $$
declare
  v_wp uuid;
  v_loc uuid;
  v_foto uuid;
  v_fior uuid;
  v_cater uuid;
  v_other uuid;
  v_post_id uuid;
begin
  -- Recupera primi profili attivi per ruolo (NULL se non esistono)
  select id into v_wp     from profiles where role = 'WEDDING_PLANNER' and deletion_requested_at is null order by created_at asc limit 1;
  select id into v_loc    from profiles where role = 'LOCATION'        and deletion_requested_at is null order by created_at asc limit 1;
  select id into v_foto   from profiles where role = 'FORNITORE' and subrole = 'fotografo' and deletion_requested_at is null order by created_at asc limit 1;
  select id into v_fior   from profiles where role = 'FORNITORE' and subrole = 'fioraio'   and deletion_requested_at is null order by created_at asc limit 1;
  select id into v_cater  from profiles where role = 'FORNITORE' and subrole = 'catering'  and deletion_requested_at is null order by created_at asc limit 1;
  select id into v_other  from profiles where role = 'FORNITORE' and deletion_requested_at is null order by created_at asc limit 1;

  -- =========================================================================
  -- POST 1 (SHORT, WP, 5 giorni fa)
  -- =========================================================================
  if v_wp is not null and not exists (select 1 from posts where slug = 'demo-matrimonio-tropea') then
    insert into posts (id, author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      gen_random_uuid(), v_wp, 'SHORT',
      E'Un sabato indimenticabile a Tropea 🌊\n\nCerimonia al tramonto sul mare, ricevimento in villa storica con vista sullo Stromboli. Quando il setting parla per sé.',
      ARRAY[
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200',
        'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200'
      ],
      'PUBLIC', 47, 8, now() - interval '5 days',
      'demo-matrimonio-tropea'
    );
  end if;

  -- =========================================================================
  -- POST 2 (ARTICLE, WP, 12 giorni fa) — long-form articolo
  -- =========================================================================
  if v_wp is not null and not exists (select 1 from posts where slug = 'demo-checklist-12-mesi') then
    insert into posts (id, author_id, post_type, title, slug, body, body_html, cover_image_url, media_urls, visibility, like_count, comment_count, created_at)
    values (
      gen_random_uuid(), v_wp, 'ARTICLE',
      'Checklist 12 mesi: come organizzare un matrimonio senza impazzire',
      'demo-checklist-12-mesi',
      'Un anno è il tempo giusto per pianificare il proprio matrimonio senza fretta. Ecco la roadmap che uso con tutte le mie coppie, mese per mese, dalla scelta della location alla pubblicazione delle foto.',
      E'<h2>12 mesi prima</h2><p>Il primo passo è definire il <strong>budget complessivo</strong> e il numero di invitati. Sono due variabili che condizionano tutte le altre scelte. Da qui parte la ricerca della location e del wedding planner (se ne avete bisogno).</p><h2>9 mesi prima</h2><p>Location confermata? Bene, ora si sceglie la data e si bloccano i fornitori chiave: <strong>fotografo, catering, musica</strong>. I migliori si prenotano con largo anticipo, soprattutto per i sabati estivi.</p><h2>6 mesi prima</h2><p>Tempo di abito sposa, partecipazioni, lista invitati definitiva. Inizia anche a pensare al menù con il catering, considera diete speciali e allergie.</p><h2>3 mesi prima</h2><p>Prove abito, prove trucco, conferma menù, allestimenti floreali. Definisci il tableau de mariage e la disposizione tavoli.</p><h2>1 mese prima</h2><p>Ultimo dettaglio: check definitivo con tutti i fornitori, conferma orari, prove trucco/capelli, pagamenti acconti. Respira.</p><h2>Il giorno del matrimonio</h2><p>Non devi fare nulla. Devi solo goderti il momento. Se hai fatto i compiti per casa nei mesi precedenti, oggi è il giorno di staccare la spina e vivere.</p>',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600',
      ARRAY[]::text[],
      'PUBLIC', 89, 14, now() - interval '12 days'
    );
  end if;

  -- =========================================================================
  -- POST 3 (SHORT, FOTOGRAFO, 2 giorni fa) — trending recente
  -- =========================================================================
  if v_foto is not null and not exists (select 1 from posts where slug = 'demo-foto-getting-ready') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_foto, 'SHORT',
      E'Il momento più magico della giornata? Il getting ready.\n\nMezz''ora di luce, silenzi, mani che tremano, dettagli che nessun altro vedrà. Lì nascono le foto che restano per sempre.',
      ARRAY[
        'https://images.unsplash.com/photo-1525258946800-98cfd641d0de?w=1200'
      ],
      'PUBLIC', 73, 5, now() - interval '2 days',
      'demo-foto-getting-ready'
    );
  end if;

  -- =========================================================================
  -- POST 4 (ARTICLE, FOTOGRAFO, 20 giorni fa)
  -- =========================================================================
  if v_foto is not null and not exists (select 1 from posts where slug = 'demo-stile-reportage') then
    insert into posts (author_id, post_type, title, slug, body, body_html, cover_image_url, visibility, like_count, comment_count, created_at)
    values (
      v_foto, 'ARTICLE',
      'Stile reportage vs posato: qual è quello giusto per te',
      'demo-stile-reportage',
      'Quando una coppia mi chiede consigli, la domanda che mi pongono sempre è: meglio le foto in posa o spontanee? Non c''è una risposta giusta. Dipende da chi siete.',
      E'<p>Il <strong>reportage di matrimonio</strong> è uno stile narrativo: documento la giornata come si svolge, senza interrompere il flusso. Niente pose, solo emozioni vere.</p><h2>Quando scegliere il reportage</h2><p>Se vi piace il cinema documentario, se le vostre foto Instagram sono spontanee, se non amate sentirvi al centro dell''attenzione — il reportage è perfetto per voi.</p><h2>Quando invece il posato funziona</h2><p>Se cercate eleganza fine art, se volete album che sembrino servizi editoriali, se i nonni vogliono ricordi formali — un mix sapiente di posato e spontaneo è la chiave.</p><p>La verità? <em>Lavoro sempre con entrambi gli stili.</em> Il 70% reportage durante la giornata, il 30% posato in 30 minuti dedicati al ritratto di coppia. È l''equilibrio che restituisce album completi.</p>',
      'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1600',
      'PUBLIC', 56, 9, now() - interval '20 days'
    );
  end if;

  -- =========================================================================
  -- POST 5 (SHORT, FIORAIO, 3 giorni fa)
  -- =========================================================================
  if v_fior is not null and not exists (select 1 from posts where slug = 'demo-bouquet-naturale') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_fior, 'SHORT',
      E'Il bouquet di Maria — eucalipto, peonie crema, gypsofila, fiordalisi blu Calabria.\n\nCresciute tutte nei nostri campi a Castrolibero. Niente serra, niente import. Solo terra e mani.',
      ARRAY[
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200',
        'https://images.unsplash.com/photo-1561128290-006dc4827214?w=1200'
      ],
      'PUBLIC', 102, 18, now() - interval '3 days',
      'demo-bouquet-naturale'
    );
  end if;

  -- =========================================================================
  -- POST 6 (SHORT, LOCATION, 7 giorni fa)
  -- =========================================================================
  if v_loc is not null and not exists (select 1 from posts where slug = 'demo-location-villa-aperitivo') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_loc, 'SHORT',
      E'L''aperitivo al tramonto sul nostro belvedere. Cinquant''anni di storia, tre generazioni della stessa famiglia, oltre 400 matrimoni celebrati.\n\nApriamo le porte solo a chi sa apprezzare il dettaglio.',
      ARRAY[
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200'
      ],
      'PUBLIC', 64, 11, now() - interval '7 days',
      'demo-location-villa-aperitivo'
    );
  end if;

  -- =========================================================================
  -- POST 7 (SHORT, CATERING, 1 giorno fa) — molto recente, trending push
  -- =========================================================================
  if v_cater is not null and not exists (select 1 from posts where slug = 'demo-catering-pesce-crudo') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_cater, 'SHORT',
      E'Show cooking di pesce crudo all''aperitivo. Tonno rosso del Mediterraneo, gamberi viola di Gallipoli, ricci di Crotone aperti al momento.\n\nIl mare in tre bocconi.',
      ARRAY[
        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200',
        'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200',
        'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200'
      ],
      'PUBLIC', 38, 4, now() - interval '1 day',
      'demo-catering-pesce-crudo'
    );
  end if;

  -- =========================================================================
  -- POST 8 (ARTICLE, FORNITORE generico se diverso dai precedenti, 8 giorni fa)
  -- =========================================================================
  if v_other is not null
     and v_other not in (coalesce(v_foto, '00000000-0000-0000-0000-000000000000'::uuid),
                         coalesce(v_fior, '00000000-0000-0000-0000-000000000000'::uuid),
                         coalesce(v_cater, '00000000-0000-0000-0000-000000000000'::uuid))
     and not exists (select 1 from posts where slug = 'demo-tendenze-2026') then
    insert into posts (author_id, post_type, title, slug, body, body_html, cover_image_url, visibility, like_count, comment_count, created_at)
    values (
      v_other, 'ARTICLE',
      'Cosa cambierà nei matrimoni del 2026',
      'demo-tendenze-2026',
      'Dopo dieci anni nel settore eventi, leggo i trend prima che diventino moda. Ecco le tendenze che vedrò esplodere nel 2026 — alcune buone, altre evitabili.',
      E'<h2>1. Matrimoni piccoli, intensi, lunghi</h2><p>Niente più 250 invitati e cerimonie compresse in 6 ore. Si va verso <strong>weekend-long celebrations</strong> con 60-80 invitati, due giorni di programma, rehearsal dinner il venerdì.</p><h2>2. Multi-fornitore lock-in</h2><p>Le coppie cercano <strong>un punto di contatto unico</strong>: il wedding planner che orchestra l''intera rete. Niente più 15 trattative parallele.</p><h2>3. Sostenibilità reale, non greenwashing</h2><p>Fiori a km zero, catering locale, allestimenti riutilizzabili, bomboniere solidali. Le coppie under 35 chiedono prove, non slogan.</p><h2>4. Tecnologia invisibile</h2><p>Wedding website, RSVP digitale, playlist condivise, foto in tempo reale via QR — tutto deve "scomparire" lasciando spazio alla relazione.</p><h2>5. Cerimonie simboliche personalizzate</h2><p>L''officiante che racconta la storia della coppia, riti personali (luce, sabbia, vino), letture scelte insieme. La standardizzazione è morta.</p>',
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1600',
      'PUBLIC', 124, 21, now() - interval '8 days'
    );
  end if;

  -- =========================================================================
  -- POST 9 (SHORT, LOCATION, 30 giorni fa) — vecchio, basso trending
  -- =========================================================================
  if v_loc is not null and not exists (select 1 from posts where slug = 'demo-villa-inverno') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_loc, 'SHORT',
      E'D''inverno la villa diventa un altro luogo. Camini accesi, lanterne sulle scale, la quiete delle colline.\n\nUn matrimonio invernale è una scelta coraggiosa. E magnifica.',
      ARRAY[
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200'
      ],
      'PUBLIC', 28, 3, now() - interval '30 days',
      'demo-villa-inverno'
    );
  end if;

  -- =========================================================================
  -- POST 10 (SHORT, WP, 14 ore fa) — il più recente, max boost trending
  -- =========================================================================
  if v_wp is not null and not exists (select 1 from posts where slug = 'demo-domenica-2-eventi') then
    insert into posts (author_id, post_type, body, media_urls, visibility, like_count, comment_count, created_at, slug)
    values (
      v_wp, 'SHORT',
      E'Due eventi in due giorni. Ieri matrimonio a Cosenza centro, oggi battesimo al mare.\n\nLa stagione è iniziata. La squadra è pronta.',
      ARRAY[
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200'
      ],
      'PUBLIC', 22, 2, now() - interval '14 hours',
      'demo-domenica-2-eventi'
    );
  end if;

end $$;

comment on table posts is
  'Post timeline social — WP/Location/Admin/Fornitori pubblicano contenuti (post brevi + articoli long-form). Visibility PUBLIC/NETWORK/FOLLOWERS. Like + commenti + tag fornitori. Demo posts seedati con slug prefix "demo-".';
