-- ════════════════════════════════════════════════════════════════════════════
-- ALBUM: DAL PDF A UN DUNQUE.
-- Oggi il fotografo manda l'impaginato (tavole) alla coppia ma non c'è un passo che
-- chiuda la decisione. L'approvazione del layout ESISTE già (album_layout_approval +
-- album_approve_layout, migrazione 20260627130000) ma è raggiungibile SOLO da
-- AlbumFunnelTab, un componente montato solo in WeddingDashboard (rotta professionista,
-- COUPLE esclusa da RequireAuth) → per la coppia il bottone "Approvo l'album" è
-- irraggiungibile. Qui NON tocchiamo quell'approvazione (resta l'unica fonte di verità
-- per "layout approvato"): il fix di raggiungibilità è lato frontend (AlbumDesignerPage).
--
-- Questa migrazione aggiunge il PASSO SUCCESSIVO, mancante: configurare le opzioni di
-- stampa (colore copertina, logo/impressione, box, finiture, nota, foto in copertina) con
-- uno stepper semplice, e chiudere con una conferma esplicita che:
--   1) salva la scelta in album_orders (tabella ESISTENTE, coda stampa/FotoLab — non la
--      duplichiamo: la estendiamo con le colonne che mancano);
--   2) notifica il fotografo (tabella notifiche, tipo dedicato ALBUM_CONFERMATO, upsert);
--   3) rende la scelta leggibile dal link pubblico /p/commissione/:token (stamperia),
--      accanto alla commessa "da catalogo PDF" che già ci arriva (client_choice).
--
-- Il catalogo delle opzioni (colore/logo/box/finiture) NON esiste ancora in forma
-- semplice: album_pricing (frontend/src/lib/albumPricing.ts) è un motore di PREZZO
-- (money-talk, vietato in beta lato cliente) legato a un contratto per evento; il
-- catalogo PDF con hotspot (album_catalogs) richiede che il fotografo carichi un PDF del
-- proprio fornitore, cosa che molti non hanno fatto (è la ragione vera per cui "manca il
-- passaggio che chiude la decisione" per la maggior parte degli eventi). Creiamo quindi
-- album_option_catalog: opzioni SENZA prezzo, seedate con default globali (owner_id
-- null) e sovrascrivibili per singolo fotografo (owner_id = auth.uid()).
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1) CATALOGO OPZIONI (senza prezzo — beta senza money-talk lato cliente)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.album_option_catalog (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references public.profiles(id) on delete cascade,  -- null = default globale
  category           text not null check (category in ('COVER_COLOR','LOGO','BOX','FINISH')),
  key                text not null,
  label              text not null,
  description        text,
  -- SOLO per COVER_COLOR: questa opzione di copertina prevede una finestra/stampa
  -- fotografica → nello stepper compare lo step "Foto in copertina".
  allows_cover_photo boolean not null default false,
  sort_order         int  not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.album_option_catalog is
  'Opzioni configurabili per lo stepper "chiudi la decisione" album: colore copertina, logo/impressione, box, finiture. owner_id null = default globale seedato; owner_id = fotografo che l''ha personalizzato (sostituisce l''intera categoria per i suoi eventi).';
comment on column public.album_option_catalog.allows_cover_photo is
  'Solo categoria COVER_COLOR: se true, la coppia vede lo step aggiuntivo "Foto in copertina" quando sceglie questa opzione.';

-- Unicità per chiave: l'indice del fotografo è PIENO (non parziale) perché PostgREST
-- fa `on conflict (owner_id,category,key)` senza predicato e Postgres non saprebbe
-- usare un indice parziale; i NULL di owner_id non collidono tra loro, quindi il set
-- globale (owner_id null) ha bisogno del suo indice parziale a parte.
create unique index if not exists ux_aoc_owner  on public.album_option_catalog(owner_id, category, key);
create unique index if not exists ux_aoc_global on public.album_option_catalog(category, key) where owner_id is null;
create index if not exists idx_aoc_owner_cat on public.album_option_catalog(owner_id, category, active);

drop trigger if exists trg_aoc_upd on public.album_option_catalog;
create trigger trg_aoc_upd before update on public.album_option_catalog
  for each row execute function public.set_updated_at();

alter table public.album_option_catalog enable row level security;

-- Lettura: chiunque autenticato (serve alla coppia per leggere le opzioni del PROPRIO
-- fotografo + i default globali; il filtro "è il mio evento" lo fa la RPC sotto, non
-- questa policy — qui basta poter leggere righe globali o del proprio fotografo).
drop policy if exists aoc_select on public.album_option_catalog;
create policy aoc_select on public.album_option_catalog for select
  using (owner_id is null or owner_id = auth.uid() or public.is_admin());

-- Scrittura: solo il fotografo sulle proprie righe (le righe globali/seed non sono
-- toccabili da un singolo fotografo: per personalizzare ne crea di proprie, che hanno
-- la precedenza — vedi album_option_catalog_for_entry).
drop policy if exists aoc_write on public.album_option_catalog;
create policy aoc_write on public.album_option_catalog for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Seed di default sensati (owner_id null). Idempotente: on conflict sull'indice parziale.
insert into public.album_option_catalog (category, key, label, description, allows_cover_photo, sort_order) values
  ('COVER_COLOR', 'avorio',      'Avorio',                              null, false, 1),
  ('COVER_COLOR', 'nero',        'Nero',                                null, false, 2),
  ('COVER_COLOR', 'blu-notte',   'Blu notte',                           null, false, 3),
  ('COVER_COLOR', 'bordeaux',    'Bordeaux',                            null, false, 4),
  ('COVER_COLOR', 'tortora',     'Tortora',                             null, false, 5),
  ('COVER_COLOR', 'bianco',      'Bianco ottico',                       null, false, 6),
  ('COVER_COLOR', 'fotografica', 'Copertina fotografica (con foto)',    'Finestra o stampa full-cover con una foto a scelta', true, 7),
  ('LOGO', 'nessuno',   'Nessuno',                    null,                                       false, 1),
  ('LOGO', 'caldo-oro', 'A caldo — oro',              'Impressione a caldo, lamina oro',           false, 2),
  ('LOGO', 'caldo-arg', 'A caldo — argento',          'Impressione a caldo, lamina argento',       false, 3),
  ('LOGO', 'secco',     'A secco (rilievo)',          'Impressione a secco, senza colore, in rilievo', false, 4),
  ('LOGO', 'placca',    'Placca metallica',           'Placchetta incisa applicata in copertina',  false, 5),
  ('BOX', 'nessuno',   'Nessuno',                    null, false, 1),
  ('BOX', 'cofanetto', 'Cofanetto rigido',           null, false, 2),
  ('BOX', 'custodia',  'Custodia in tessuto',        null, false, 3),
  ('BOX', 'scatola',   'Scatola con coperchio',      null, false, 4),
  ('FINISH', 'nessuna',            'Nessuna',                  null, false, 1),
  ('FINISH', 'angoli-arrotondati', 'Angoli arrotondati',       null, false, 2),
  ('FINISH', 'bordi-dorati',       'Bordi dorati',             null, false, 3),
  ('FINISH', 'carta-perlata',      'Carta perlata',            null, false, 4),
  ('FINISH', 'carta-opaca',        'Carta opaca premium',      null, false, 5),
  ('FINISH', 'pagine-numerate',    'Pagine numerate',          null, false, 6)
on conflict (category, key) where owner_id is null do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) ESTENDE album_orders (coda stampa/FotoLab già esistente — non duplichiamo)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.album_orders
  add column if not exists confirmed_at         timestamptz,
  add column if not exists confirmed_by         uuid references public.profiles(id) on delete set null,
  add column if not exists option_choices       jsonb not null default '{}'::jsonb,
  add column if not exists cover_photo_media_id uuid references public.gallery_media(id) on delete set null,
  add column if not exists cover_photo_url      text,
  add column if not exists cover_photo_label    text,
  add column if not exists cover_photo_note     text,
  add column if not exists order_pdf_path       text;

comment on column public.album_orders.option_choices is
  'Scelte dello stepper "chiudi la decisione", UNA per caratteristica: {cover_color:{key,label}, logo:{key,label}, box:{key,label}, finish:{key,label}}. Popolato da album_order_confirm, che rifiuta scelte incomplete.';
comment on column public.album_orders.confirmed_at is
  'Non nullo = la coppia (o il fotografo per suo conto) ha confermato ESPLICITAMENTE album + opzioni. Trigger su questa colonna avvisa il fotografo (notifiche, tipo ALBUM_CONFERMATO).';

create index if not exists idx_album_orders_confirmed on public.album_orders(entry_id, confirmed_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) RPC: opzioni disponibili per l'evento (fallback fotografo → default globale,
--    PER CATEGORIA: un fotografo può personalizzare solo COVER_COLOR e lasciare il
--    resto ai default, senza dover ricopiare tutto).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.album_option_catalog_for_entry(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_result jsonb := '{}'::jsonb; v_cat text; v_items jsonb;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then select owner_id into v_owner from public.calendar_entries where id = p_entry limit 1; end if;
  if v_owner is null then return jsonb_build_object('error', 'no_event'); end if;

  foreach v_cat in array array['COVER_COLOR','LOGO','BOX','FINISH'] loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'key', key, 'label', label, 'description', description,
             'allows_cover_photo', allows_cover_photo
           ) order by sort_order, label), '[]'::jsonb)
      into v_items
      from public.album_option_catalog
      where category = v_cat and active and owner_id = v_owner;
    if jsonb_array_length(v_items) = 0 then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'key', key, 'label', label, 'description', description,
               'allows_cover_photo', allows_cover_photo
             ) order by sort_order, label), '[]'::jsonb)
        into v_items
        from public.album_option_catalog
        where category = v_cat and active and owner_id is null;
    end if;
    v_result := v_result || jsonb_build_object(v_cat, v_items);
  end loop;

  return jsonb_build_object('ok', true, 'options', v_result);
end$$;
grant execute on function public.album_option_catalog_for_entry(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RPC: conferma dell'ordine (la coppia sceglie e chiude). SECURITY DEFINER perché
--    album_orders non ha una policy di scrittura per la coppia (solo fotografo/FotoLab):
--    stesso pattern di album_commission_create / album_send_to_print / album_commission_share.
--    Un solo ordine "confermato" per evento: se richiamata di nuovo (la coppia cambia idea
--    prima della stampa) AGGIORNA la riga esistente invece di duplicarla.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.album_order_confirm(
  p_entry uuid,
  p_option_choices jsonb,
  p_note text default null,
  p_cover_photo_media_id uuid default null,
  p_cover_photo_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_proj record; v_label text; v_pages int; v_id uuid;
  v_photo_url text; v_photo_label text;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;

  -- Ogni caratteristica va indicata, UNA sola per categoria (un oggetto {key,label},
  -- mai un elenco): la stamperia deve leggere un dunque, non una lista di tag.
  if p_option_choices is null
     or coalesce(jsonb_typeof(p_option_choices->'cover_color'), 'missing') <> 'object'
     or coalesce(jsonb_typeof(p_option_choices->'logo'), 'missing') <> 'object'
     or coalesce(jsonb_typeof(p_option_choices->'box'), 'missing') <> 'object'
     or coalesce(jsonb_typeof(p_option_choices->'finish'), 'missing') <> 'object'
     or nullif(p_option_choices->'cover_color'->>'key', '') is null
     or nullif(p_option_choices->'logo'->>'key', '') is null
     or nullif(p_option_choices->'box'->>'key', '') is null
     or nullif(p_option_choices->'finish'->>'key', '') is null then
    return jsonb_build_object('error', 'incomplete');
  end if;

  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  v_owner := coalesce(v_owner, auth.uid());

  select id, format_key, coalesce(jsonb_array_length(layout->'pages'), 0) as pages into v_proj
    from public.album_projects where entry_id = p_entry order by updated_at desc limit 1;
  select coalesce(title, 'Album') into v_label from public.calendar_entries where id = p_entry;
  v_pages := coalesce(v_proj.pages, 0);

  if p_cover_photo_media_id is not null then
    select
      case when gm.drive_file_id is not null
                and gm.drive_file_id not like 'demo-%'
                and gm.drive_file_id not like 'guest:%'
                and gm.drive_file_id not like 'album:%'
           then 'https://drive.google.com/thumbnail?id=' || gm.drive_file_id || '&sz=w1200'
           else gm.thumbnail_link end,
      coalesce(gm.source_name, 'Foto selezionata')
      into v_photo_url, v_photo_label
      from public.gallery_media gm
      where gm.id = p_cover_photo_media_id and gm.entry_id = p_entry;
  end if;

  select id into v_id from public.album_orders
    where entry_id = p_entry and confirmed_at is not null
    order by confirmed_at desc limit 1;

  if v_id is not null then
    update public.album_orders set
      album_project_id     = coalesce(v_proj.id, album_project_id),
      format_key            = coalesce(v_proj.format_key, format_key),
      pages                  = v_pages,
      option_choices         = coalesce(p_option_choices, '{}'::jsonb),
      notes                  = p_note,
      cover_photo_media_id   = p_cover_photo_media_id,
      cover_photo_url        = v_photo_url,
      cover_photo_label      = v_photo_label,
      cover_photo_note       = p_cover_photo_note,
      cover                  = jsonb_build_object('source', 'option_catalog'),
      confirmed_at           = now(),
      confirmed_by           = auth.uid()
    where id = v_id;
  else
    insert into public.album_orders(
      entry_id, album_project_id, photographer_id, couple_label, format_key, pages, copies,
      cover, option_choices, notes,
      cover_photo_media_id, cover_photo_url, cover_photo_label, cover_photo_note,
      confirmed_at, confirmed_by
    ) values (
      p_entry, v_proj.id, v_owner, v_label, coalesce(v_proj.format_key, 'SQ_30'), v_pages, 1,
      jsonb_build_object('source', 'option_catalog'), coalesce(p_option_choices, '{}'::jsonb), p_note,
      p_cover_photo_media_id, v_photo_url, v_photo_label, p_cover_photo_note,
      now(), auth.uid()
    ) returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'order_id', v_id);
end$$;
grant execute on function public.album_order_confirm(uuid, jsonb, text, uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RPC: stato dell'ordine per l'evento (per la card "Album approvato il..." lato
--    fotografo/coppia). Risolve anche il nome di chi ha confermato.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.album_order_status(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_o record; v_name text; v_approved boolean;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;

  select exists(select 1 from public.album_layout_approval where entry_id = p_entry) into v_approved;

  select * into v_o from public.album_orders
    where entry_id = p_entry and confirmed_at is not null
    order by confirmed_at desc limit 1;

  if v_o.id is null then
    return jsonb_build_object('ok', true, 'layout_approved', v_approved, 'confirmed', false);
  end if;

  select coalesce(full_name, business_name, 'La coppia') into v_name from public.profiles where id = v_o.confirmed_by;

  return jsonb_build_object(
    'ok', true, 'layout_approved', v_approved, 'confirmed', true,
    'order_id', v_o.id, 'confirmed_at', v_o.confirmed_at, 'confirmed_by_name', v_name,
    'option_choices', v_o.option_choices, 'notes', v_o.notes,
    'cover_photo_url', v_o.cover_photo_url, 'cover_photo_label', v_o.cover_photo_label, 'cover_photo_note', v_o.cover_photo_note,
    'pages', v_o.pages, 'format_key', v_o.format_key, 'order_pdf_path', v_o.order_pdf_path
  );
end$$;
grant execute on function public.album_order_status(uuid) to authenticated;

-- Il fotografo salva il path del PDF "scheda ordine" appena generato/scaricato (upload
-- fatto lato client nel bucket privato album-commissions, già usato dalla commessa da
-- catalogo PDF). Diretta perché album_orders_photog (RLS) già copre photographer_id = auth.uid().
create or replace function public.album_order_save_pdf_path(p_order uuid, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.album_orders set order_pdf_path = p_path
    where id = p_order and photographer_id = auth.uid();
  if not found then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_order_save_pdf_path(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) Storage: la "scheda ordine" (bucket privato album-commissions, già esistente) deve
--    essere scaricabile ANCHE dal link pubblico /p/commissione/:token (stamperia, senza
--    login). Non rendiamo il bucket pubblico: la policy sotto apre in lettura SOLO i file
--    il cui path è referenziato da un ordine dello stesso evento di un ordine già
--    condiviso (share_token valorizzato) — stessa soglia di segretezza del link stesso
--    (serve comunque conoscere lo share_token per arrivarci lato app; qui autorizziamo
--    solo l'oggetto storage puntato, non l'intero bucket).
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "albumcomm read via share" on storage.objects;
create policy "albumcomm read via share" on storage.objects for select using (
  bucket_id = 'album-commissions' and exists (
    select 1 from public.album_orders o
    join public.album_orders shared on shared.entry_id = o.entry_id and shared.share_token is not null
    where o.order_pdf_path = storage.objects.name
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7) Estende album_commission_by_token con la conferma della coppia (option_choices,
--    nota, foto di copertina, pdf scheda ordine): stesso pattern di
--    20260709160000_commission_client_choice.sql (client_choice, per la commessa "da
--    catalogo PDF"), qui per la conferma "da stepper opzioni". Righe diverse, stesso
--    entry_id: la card di stampa può mostrare entrambe se esistono.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.album_commission_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_o record; v_p record; v_email text; v_sel int; v_date date; v_choice jsonb; v_conf record; v_conf_name text;
begin
  if p_token is null then return jsonb_build_object('error', 'no_token'); end if;
  select * into v_o from public.album_orders where share_token = p_token limit 1;
  if v_o.id is null then return jsonb_build_object('error', 'not_found'); end if;
  select business_name, full_name, phone, brand_logo_url, brand_primary_color into v_p
    from public.profiles where id = v_o.photographer_id;
  select email into v_email from auth.users where id = v_o.photographer_id;
  select coalesce(count(*), 0) into v_sel from public.gallery_media
    where entry_id = v_o.entry_id and album_choice = 'KEPT' and media_type = 'PHOTO';
  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_o.entry_id;

  -- scelta del cliente dal PICKER (catalogo PDF): l'ultima commessa firmata per questo evento
  select cover into v_choice from public.album_orders
    where entry_id = v_o.entry_id and cover->>'source' = 'pdf_catalog'
    order by created_at desc limit 1;

  -- conferma dal NUOVO STEPPER opzioni (senza catalogo PDF): l'ultimo ordine confermato
  select * into v_conf from public.album_orders
    where entry_id = v_o.entry_id and confirmed_at is not null
    order by confirmed_at desc limit 1;
  if v_conf.id is not null then
    select coalesce(full_name, business_name, 'La coppia') into v_conf_name from public.profiles where id = v_conf.confirmed_by;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'format_key', v_o.format_key, 'pages', v_o.pages, 'copies', v_o.copies, 'cover', v_o.cover,
      'couple_label', v_o.couple_label, 'notes', v_o.notes, 'file_link', v_o.file_link,
      'status', v_o.status, 'created_at', v_o.created_at),
    'photographer', jsonb_build_object(
      'business_name', v_p.business_name, 'full_name', v_p.full_name, 'phone', v_p.phone,
      'email', v_email, 'logo', v_p.brand_logo_url, 'color', v_p.brand_primary_color),
    'selection_count', v_sel,
    'event_date', v_date,
    'client_choice', v_choice,
    'client_confirmation', case when v_conf.id is null then null else jsonb_build_object(
      'confirmed_at', v_conf.confirmed_at, 'confirmed_by_name', v_conf_name,
      'option_choices', v_conf.option_choices, 'notes', v_conf.notes,
      'cover_photo_url', v_conf.cover_photo_url, 'cover_photo_label', v_conf.cover_photo_label,
      'cover_photo_note', v_conf.cover_photo_note, 'order_pdf_path', v_conf.order_pdf_path
    ) end
  );
end$$;
grant execute on function public.album_commission_by_token(uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8) Notifica il fotografo quando la coppia conferma. Pattern server-side (trigger),
--    NON dipende dal browser — come tg_album_final_notify / notify_on_lead_request.
--    Tabella notifiche (FASE 2), tipo dedicato ALBUM_CONFERMATO, upsert su
--    (destinatario_id, evento_id, tipo) per non duplicare se la coppia riconferma.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_album_order_confirmed_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_titolo text; v_descr text; v_link text;
begin
  -- Notifica sia la PRIMA conferma sia una RICONFERMA (la coppia ha cambiato le opzioni e
  -- confermato di nuovo: confirmed_at si aggiorna comunque ad ogni chiamata di
  -- album_order_confirm) — non solo la transizione null → not null.
  if new.confirmed_at is not null and (tg_op = 'INSERT' or old.confirmed_at is distinct from new.confirmed_at) then
    v_titolo := 'Album confermato dagli sposi';
    v_descr  := coalesce(new.couple_label, 'La coppia') || ' ha confermato l''album e le opzioni di stampa scelte.';
    v_link   := '/weddings/' || new.entry_id::text;
    begin
      insert into public.notifiche (
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita
      ) values (
        new.photographer_id, new.entry_id, 'ALBUM_CONFERMATO', v_titolo, v_descr, v_link, new.confirmed_by, 'PENDING', 7
      )
      on conflict (destinatario_id, evento_id, tipo) do update set
        titolo      = excluded.titolo,
        descrizione = excluded.descrizione,
        link_action = excluded.link_action,
        stato       = 'PENDING',
        letto_il    = null,
        creato_il   = now();
    exception when others then
      -- se la tabella notifiche non c'è (test isolati) o l'evento non ha owner valido, ignora.
      null;
    end;
  end if;
  return new;
end$$;

drop trigger if exists trg_album_order_confirmed_notify on public.album_orders;
create trigger trg_album_order_confirmed_notify
  after insert or update of confirmed_at on public.album_orders
  for each row execute function public.tg_album_order_confirmed_notify();
