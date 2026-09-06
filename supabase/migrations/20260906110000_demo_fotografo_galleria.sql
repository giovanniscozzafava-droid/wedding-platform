-- ============================================================================
-- Galleria foto reale per l'evento di Chiara Femia & Antonio Surace (Luce
-- d'Autore Fotografia), creato con la RPC create_direct_event() come sessione
-- autenticata (entry_id f7fcb0e7-84ff-42a0-8b4a-50eb3049a935). Serve al video
-- verticale fotografi: selezione cliente, condivisione rete, carosello swipe,
-- impaginatore album.
--
-- drive_file_id con prefisso 'demo-' (pattern già collaudato in
-- 20260715480000_seed_zoe_gallery_test.sql): l'app usa thumbnail_link (URL
-- pubblico reale) invece di risolvere Google Drive, che qui non è collegato.
-- ============================================================================

do $$
declare
  v_foto  uuid := 'b10c0000-0000-4000-8000-000000000001';
  v_entry uuid := 'f7fcb0e7-84ff-42a0-8b4a-50eb3049a935';
  v_quote uuid := 'b10c0000-0000-4000-8000-000000000301';
  v_gallery uuid := 'b10c0000-0000-4000-8000-000000000601';
  v_folder_lavoro uuid := 'b10c0000-0000-4000-8000-000000000602';
  v_album uuid := 'b10c0000-0000-4000-8000-000000000801';
  v_urls text[] := array[
    'https://images.pexels.com/photos/30372608/pexels-photo-30372608.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/31798269/pexels-photo-31798269.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/32507641/pexels-photo-32507641.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/8845836/pexels-photo-8845836.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/936042/pexels-photo-936042.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/1372177/pexels-photo-1372177.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/33975526/pexels-photo-33975526.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/28319428/pexels-photo-28319428.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/36611021/pexels-photo-36611021.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/36249009/pexels-photo-36249009.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/32483421/pexels-photo-32483421.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/37912244/pexels-photo-37912244.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/18322542/pexels-photo-18322542.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/11652676/pexels-photo-11652676.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/37912248/pexels-photo-37912248.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/37912240/pexels-photo-37912240.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/17529853/pexels-photo-17529853.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/2959199/pexels-photo-2959199.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/35414882/pexels-photo-35414882.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/30739943/pexels-photo-30739943.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/37912251/pexels-photo-37912251.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/36483806/pexels-photo-36483806.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/19080702/pexels-photo-19080702.jpeg?auto=compress&cs=tinysrgb&h=900&w=650',
    'https://images.pexels.com/photos/35679397/pexels-photo-35679397.jpeg?auto=compress&cs=tinysrgb&h=900&w=650'
  ];
  v_media_ids uuid[] := array[]::uuid[];
  v_id uuid;
  i int;
begin
  -- 1) Evento: collega preventivo + dati cliente (PII split) -----------------
  update public.calendar_entries set quote_id = v_quote where id = v_entry;
  update public.calendar_entries_private
     set client_name = 'Chiara Femia & Antonio Surace', client_email = 'chiara.femia@example.com', value_amount = 3450
   where entry_id = v_entry;

  -- 2) Galleria + cartella "lavoro intero" (condivisibile in rete) ----------
  insert into public.event_galleries (id, entry_id, owner_id, title, kind)
  values (v_gallery, v_entry, v_foto, 'Matrimonio Femia-Surace', 'MIXED')
  on conflict (id) do nothing;

  insert into public.gallery_folders (id, gallery_id, entry_id, name, level, shared, sort_order)
  values (v_folder_lavoro, v_gallery, v_entry, 'Lavoro intero', 'LAVORO_INTERO', true, 0)
  on conflict (id) do nothing;

  -- 3) 24 foto reali (Pexels), drive_file_id 'demo-' = niente risoluzione Drive
  for i in 1 .. array_length(v_urls, 1) loop
    v_id := ('b10c0000-0000-4000-8000-0000000007' || lpad(i::text, 2, '0'))::uuid;
    v_media_ids := v_media_ids || v_id;
    insert into public.gallery_media (id, folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, album_choice, carousel_pick)
    values (
      v_id, v_folder_lavoro, v_gallery, v_entry,
      'demo-luce-' || i, v_urls[i], 'PHOTO',
      case when i <= 16 then 'KEPT' when i in (17,18) then 'DISCARDED' else null end,
      i <= 8
    )
    on conflict (id) do nothing;
  end loop;

  -- 4) Consenso "lavoro intero" attivo (per la demo di condivisione in rete) -
  insert into public.gallery_consents (entry_id, scope, granted_at)
  values (v_entry, 'LAVORO_INTERO', now() - interval '5 days')
  on conflict (entry_id, scope) do nothing;

  -- 5) Progetto carosello (le 8 carousel_pick sopra sono già "scelte") -------
  insert into public.carousel_projects (entry_id, owner_id, format_key, slides, status)
  values (v_entry, v_foto, 'IG_PORTRAIT', 6, 'DRAFT')
  on conflict (entry_id) do nothing;

  -- 6) Progetto album — 3 tavole dalle foto KEPT, una con commento dei fotografo
  insert into public.album_projects (id, entry_id, owner_id, format_key, status, layout, target_min, target_max)
  values (
    v_album, v_entry, v_foto, 'SQ_30', 'DRAFT',
    jsonb_build_object('pages', jsonb_build_array(
      jsonb_build_object('id','p1','moment','cerimonia','template','2h','mediaIds', jsonb_build_array(v_media_ids[1]::text, v_media_ids[2]::text)),
      jsonb_build_object('id','p2','moment','cerimonia','template','1','mediaIds', jsonb_build_array(v_media_ids[3]::text),
        'note','Questo scatto apre la cerimonia: luce naturale, nessun flash. Fatemi sapere se preferite un''altra inquadratura per questa tavola.'),
      jsonb_build_object('id','p3','moment','ricevimento','template','2h','mediaIds', jsonb_build_array(v_media_ids[9]::text, v_media_ids[10]::text))
    )),
    60, 110
  )
  on conflict (id) do nothing;

  raise notice 'Galleria pronta: % foto, entry_id %', array_length(v_urls,1), v_entry;
end $$;
