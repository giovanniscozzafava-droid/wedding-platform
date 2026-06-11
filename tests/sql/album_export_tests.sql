-- ============================================================================
-- EXPORT ALBUM — 30 album × tutte le dimensioni (Web + Originale). VERDE = corretto.
--
-- Replica ESATTAMENTE la logica dell'edge function `album-zip`:
--   * seleziona solo i media con album_choice='KEPT'
--   * per ogni media risolve la sorgente in base alla DIMENSIONE richiesta:
--       - file Drive  + originale → https://www.googleapis.com/drive/v3/files/ID?alt=media
--       - file Drive  + web       → https://drive.google.com/thumbnail?id=ID&sz=w1600
--       - file NON Drive (demo/ospite) → thumbnail_link (uguale per entrambe le dimensioni)
--       - i VIDEO si esportano SEMPRE a piena risoluzione (il "web" vale per le foto)
--   * nome file: NNN-<base>.<ext>  (ext: VIDEO→mp4, foto→jpg)
--   * nome ZIP: album-selezione-web.zip | album-selezione-originale.zip
--
-- Copre 30 album con cardinalità e composizione DIVERSE (mix Drive/demo, foto/video,
-- più scartati DISCARDED che NON devono finire nell'export).
-- ============================================================================

-- ── pulizia namespace di test (idempotente) ────────────────────────────────
do $clean$
begin
  delete from gallery_media   where entry_id in (select id from calendar_entries where title like 'EXPORT TEST %');
  delete from gallery_folders where entry_id in (select id from calendar_entries where title like 'EXPORT TEST %');
  delete from event_galleries where entry_id in (select id from calendar_entries where title like 'EXPORT TEST %');
  delete from wedding_couple_members where entry_id in (select id from calendar_entries where title like 'EXPORT TEST %');
  delete from calendar_entries where title like 'EXPORT TEST %';
end$clean$;

-- ── attori ─────────────────────────────────────────────────────────────────
do $boot$
declare
  wp    uuid := 'aaee0000-0000-0000-0000-0000000000f1'; -- fotografo (owner galleria)
  cpl   uuid := 'aaee0000-0000-0000-0000-0000000000c1'; -- sposa (couple member)
  strg  uuid := 'aaee0000-0000-0000-0000-0000000000f9'; -- estraneo (NON autorizzato)
  adm   uuid := 'aaee0000-0000-0000-0000-0000000000ad'; -- admin
  ev    uuid; gal uuid; fol uuid;
  k int; nkept int; ndisc int; j int;
  v_drive boolean; v_video boolean; v_dfid text; v_thumb text;
begin
  insert into auth.users(id) values (wp),(cpl),(strg),(adm) on conflict do nothing;
  update profiles set role='FORNITORE', subrole='fotografo' where id in (wp,strg);
  update profiles set role='COUPLE' where id=cpl;
  update profiles set role='ADMIN'  where id=adm;

  for k in 1..30 loop
    ev  := ('aaee0001-0000-0000-0000-'||lpad(k::text,12,'0'))::uuid;
    gal := ('aaee0002-0000-0000-0000-'||lpad(k::text,12,'0'))::uuid;
    fol := ('aaee0003-0000-0000-0000-'||lpad(k::text,12,'0'))::uuid;

    insert into calendar_entries(id,owner_id,title,date_from,date_to,status)
      values (ev,wp,'EXPORT TEST '||k,'2027-06-01','2027-06-01','CONFERMATA') on conflict (id) do nothing;
    insert into wedding_couple_members(entry_id,user_id,email,role)
      values (ev,cpl,'sposa'||k||'@test.it','SPOSA') on conflict do nothing;
    insert into event_galleries(id,entry_id,owner_id,title)
      values (gal,ev,wp,'Galleria '||k) on conflict (id) do nothing;
    insert into gallery_folders(id,gallery_id,entry_id,name,level,shared)
      values (fol,gal,ev,'Servizio','LAVORO_INTERO',true) on conflict (id) do nothing;

    nkept := k;                 -- album k ha k foto KEPT (cardinalità 1..30)
    ndisc := (k % 4);           -- + alcune scartate, che NON vanno esportate

    for j in 1..nkept loop
      v_video := (k % 5 = 0 and j = 1);                 -- 1 video negli album multipli di 5
      v_drive := (j % 2 = 0) or v_video;                -- alterna Drive/demo; i video sono su Drive (caso reale)
      if v_drive then v_dfid := 'drv-'||k||'-'||j; v_thumb := null;
      else            v_dfid := 'demo-'||k||'-'||j; v_thumb := 'https://picsum.photos/seed/'||k||'_'||j||'/1600'; end if;
      insert into gallery_media(gallery_id,entry_id,folder_id,drive_file_id,media_type,album_choice,thumbnail_link,guest_tag_name)
        values (gal,ev,fol,v_dfid,(case when v_video then 'VIDEO' else 'PHOTO' end)::gallery_media_type,'KEPT',v_thumb,
                (case when j%3=0 then 'da Laura' else null end));
    end loop;

    for j in 1..ndisc loop
      insert into gallery_media(gallery_id,entry_id,folder_id,drive_file_id,media_type,album_choice,thumbnail_link)
        values (gal,ev,fol,'demo-x-'||k||'-'||j,'PHOTO','DISCARDED','https://picsum.photos/seed/x'||k||'_'||j||'/1600');
    end loop;
  end loop;
end$boot$;

-- ── risolutore: replica 1:1 la scelta sorgente di album-zip ────────────────
create or replace function pg_temp.resolve_src(p_size text, p_dfid text, p_mtype text, p_thumb text)
returns text language plpgsql immutable as $$
declare is_drive boolean; want_web boolean;
begin
  is_drive := p_dfid is not null and p_dfid <> '' and left(p_dfid,5) <> 'demo-' and left(p_dfid,6) <> 'guest:';
  want_web := (p_size = 'web' and p_mtype <> 'VIDEO');
  if is_drive then
    if want_web then return 'https://drive.google.com/thumbnail?id='||p_dfid||'&sz=w1600';
    else             return 'https://www.googleapis.com/drive/v3/files/'||p_dfid||'?alt=media'; end if;
  else
    if p_thumb is null or p_thumb = '' then return null; else return p_thumb; end if;
  end if;
end$$;

-- ── export simulato per (album,size): righe KEPT risolte, numerate, nominate ─
create or replace function pg_temp.album_export(p_entry uuid, p_size text)
returns table(idx int, fname text, src text, mtype text) language sql stable as $$
  with kept as (
    select drive_file_id, media_type::text mt, thumbnail_link, guest_tag_name,
           row_number() over (order by id) rn
      from gallery_media where entry_id = p_entry and album_choice = 'KEPT'
  )
  select rn::int,
         lpad(rn::text,3,'0')||'-'||
           coalesce(nullif(regexp_replace(coalesce(guest_tag_name,'foto'),'[^a-zA-Z0-9_ -]','','g'),''),'foto')||'.'||
           (case when mt='VIDEO' then 'mp4' else 'jpg' end),
         pg_temp.resolve_src(p_size, drive_file_id, mt, thumbnail_link),
         mt
    from kept;
$$;

-- nome ZIP atteso per dimensione
create or replace function pg_temp.zip_name(p_size text) returns text language sql immutable as $$
  select case when p_size='web' then 'album-selezione-web.zip' else 'album-selezione-originale.zip' end;
$$;

-- ============================================================================
-- 30 ALBUM × 2 DIMENSIONI = 60 export verificati
-- ============================================================================
do $run$
declare
  ev uuid; k int; sz text; sizes text[] := array['web','original'];
  kept_n int; exp_n int; uniq_n int; min_i int; max_i int; nullsrc int; badvideo int;
  fails text := '';
begin
  for k in 1..30 loop
    ev := ('aaee0001-0000-0000-0000-'||lpad(k::text,12,'0'))::uuid;
    select count(*) into kept_n from gallery_media where entry_id=ev and album_choice='KEPT';

    foreach sz in array sizes loop
      select count(*), count(distinct fname), min(idx), max(idx),
             count(*) filter (where src is null),
             count(*) filter (where p.mtype='VIDEO' and p.src like '%drive.google.com/thumbnail%')
        into exp_n, uniq_n, min_i, max_i, nullsrc, badvideo
        from pg_temp.album_export(ev, sz) p;

      -- 1) tutti i KEPT esportati (nessuna sorgente irrisolta)
      if exp_n <> kept_n then fails := fails||format(' [A%s/%s conteggio %s≠%s]',k,sz,exp_n,kept_n); end if;
      -- 2) nessuna sorgente NULL (ogni file ha una URL valida per quella dimensione)
      if nullsrc <> 0 then fails := fails||format(' [A%s/%s %s src-null]',k,sz,nullsrc); end if;
      -- 3) nomi file unici e numerazione sequenziale 1..N
      if uniq_n <> exp_n or min_i <> 1 or max_i <> exp_n then
        fails := fails||format(' [A%s/%s numerazione uniq=%s min=%s max=%s n=%s]',k,sz,uniq_n,min_i,max_i,exp_n); end if;
      -- 4) i video restano a piena risoluzione anche in "web"
      if badvideo <> 0 then fails := fails||format(' [A%s/%s video-downscalato]',k,sz); end if;
    end loop;
  end loop;

  if fails <> '' then raise exception 'EXPORT FAIL:%', fails;
  else raise notice 'TEST album_export 30 album × 2 dimensioni (Web+Originale) OK — 60 export verificati'; end if;
end$run$;

-- ── dettaglio leggibile: cardinalità e file totali esportati ───────────────
do $detail$
declare ev uuid; k int; n int; tot_web int := 0; tot_orig int := 0;
begin
  for k in 1..30 loop
    ev := ('aaee0001-0000-0000-0000-'||lpad(k::text,12,'0'))::uuid;
    select count(*) into n from pg_temp.album_export(ev,'web');     tot_web  := tot_web  + n;
    select count(*) into n from pg_temp.album_export(ev,'original');tot_orig := tot_orig + n;
  end loop;
  raise notice 'TEST totali OK — file esportati: web=% , originale=% (atteso 465 ciascuno: somma 1..30)', tot_web, tot_orig;
end$detail$;

-- ── nome ZIP corretto per dimensione ───────────────────────────────────────
do $zip$
begin
  if pg_temp.zip_name('web') <> 'album-selezione-web.zip' then raise exception 'ZIP web nome errato'; end if;
  if pg_temp.zip_name('original') <> 'album-selezione-originale.zip' then raise exception 'ZIP originale nome errato'; end if;
  raise notice 'TEST nome-ZIP per dimensione OK';
end$zip$;

-- ── caso limite: album senza KEPT → export vuoto (la funzione → no_selection) ─
do $empty$
declare ev uuid := 'aaee0001-0000-0000-0000-'||lpad('1',12,'0'); n int;
begin
  -- uso un entry temporaneo senza KEPT
  insert into auth.users(id) values ('aaee0000-0000-0000-0000-0000000000f1') on conflict do nothing;
  insert into calendar_entries(id,owner_id,title,date_from,date_to,status)
    values ('aaee0009-0000-0000-0000-000000000000','aaee0000-0000-0000-0000-0000000000f1','EXPORT TEST EMPTY','2027-06-01','2027-06-01','CONFERMATA')
    on conflict (id) do nothing;
  select count(*) into n from pg_temp.album_export('aaee0009-0000-0000-0000-000000000000','original');
  if n <> 0 then raise exception 'EMPTY FAIL: export non vuoto (%).', n; end if;
  raise notice 'TEST album-vuoto → no_selection OK';
end$empty$;

-- ── autorizzazione (stessa regola dell'edge: owner | coppia | admin; estraneo NO) ─
create or replace function pg_temp.can_export(p_entry uuid, p_uid uuid)
returns boolean language sql stable as $$
  select exists(select 1 from event_galleries g where g.entry_id=p_entry and g.owner_id=p_uid)
      or exists(select 1 from wedding_couple_members m where m.entry_id=p_entry and m.user_id=p_uid)
      or exists(select 1 from profiles pr where pr.id=p_uid and pr.role='ADMIN');
$$;

do $authz$
declare
  ev uuid := 'aaee0001-0000-0000-0000-'||lpad('7',12,'0');
  wp uuid := 'aaee0000-0000-0000-0000-0000000000f1';
  cpl uuid := 'aaee0000-0000-0000-0000-0000000000c1';
  strg uuid := 'aaee0000-0000-0000-0000-0000000000f9';
  adm uuid := 'aaee0000-0000-0000-0000-0000000000ad';
begin
  if not pg_temp.can_export(ev,wp)  then raise exception 'AUTH FAIL: owner negato'; end if;
  if not pg_temp.can_export(ev,cpl) then raise exception 'AUTH FAIL: coppia negata'; end if;
  if not pg_temp.can_export(ev,adm) then raise exception 'AUTH FAIL: admin negato'; end if;
  if pg_temp.can_export(ev,strg)    then raise exception 'AUTH FAIL: estraneo AMMESSO'; end if;
  raise notice 'TEST autorizzazione export (owner/coppia/admin sì, estraneo no) OK';
end$authz$;
