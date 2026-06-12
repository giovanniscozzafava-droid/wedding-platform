-- ============================================================================
-- CONTROLLO SERRATO SICUREZZA — nessun ospite "esce fuori".
-- Copre le NUOVE superfici: GUESTBOOK, IMPAGINATORE (album_projects), AUDIO,
-- TAG foto ospiti. Due eventi A e B di fornitori diversi; si prova in avanti e
-- all'inverso che un ospite di A non tocca MAI nulla di B, né i lavori album.
-- VERDE = nessun leak.
-- ============================================================================
do $clean$
begin
  delete from public.event_guestbook where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.event_audio_wishes where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.album_projects where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.gallery_media where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.gallery_folders where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.gallery_guests where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.wedding_couple_members where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.event_galleries where entry_id in (select id from calendar_entries where title like 'SEC AUDIT %');
  delete from public.calendar_entries where title like 'SEC AUDIT %';
end$clean$;

do $boot$
declare
  pA uuid:='da700000-0000-0000-0000-0000000000a2'; cA uuid:='da700000-0000-0000-0000-0000000000a4'; gA uuid:='da700000-0000-0000-0000-0000000000a3';
  pB uuid:='da700000-0000-0000-0000-0000000000b2'; cB uuid:='da700000-0000-0000-0000-0000000000b4'; gB uuid:='da700000-0000-0000-0000-0000000000b3';
  strg uuid:='da700000-0000-0000-0000-0000000000f9';
  evA uuid:='da700000-0000-0000-0000-00000000aaaa'; galA uuid:='da700000-0000-0000-0000-00000000aaab'; finvA uuid:='da700000-0000-0000-0000-00000000a111'; flavA uuid:='da700000-0000-0000-0000-00000000a222';
  evB uuid:='da700000-0000-0000-0000-00000000bbbb'; galB uuid:='da700000-0000-0000-0000-00000000bbbc'; finvB uuid:='da700000-0000-0000-0000-00000000b111';
begin
  insert into auth.users(id) values (pA),(cA),(gA),(pB),(cB),(gB),(strg) on conflict do nothing;
  update profiles set role='FORNITORE', subrole='fotografo' where id in (pA,pB,strg);
  update profiles set role='COUPLE' where id in (cA,cB);

  insert into calendar_entries(id,owner_id,title,date_from,date_to,status) values
    (evA,pA,'SEC AUDIT A','2027-06-01','2027-06-01','CONFERMATA'),
    (evB,pB,'SEC AUDIT B','2027-07-01','2027-07-01','CONFERMATA') on conflict (id) do nothing;
  -- fotografo proprietario galleria + nel cerchio
  insert into calendar_entry_participants(entry_id,user_id,role_in_entry,confirmed) values (evA,pA,'fotografo',true),(evB,pB,'fotografo',true) on conflict do nothing;
  insert into event_galleries(id,entry_id,owner_id,title,guest_token) values
    (galA,evA,pA,'Gal A','TOKA'),(galB,evB,pB,'Gal B','TOKB') on conflict (id) do nothing;
  insert into wedding_couple_members(entry_id,user_id,email,role) values (evA,cA,'ca@t.it','SPOSA'),(evB,cB,'cb@t.it','SPOSA') on conflict do nothing;
  insert into gallery_folders(id,gallery_id,entry_id,name,level,shared) values
    (finvA,galA,evA,'Foto & video degli ospiti','INVITATI',false),
    (flavA,galA,evA,'Servizio completo','LAVORO_INTERO',true),
    (finvB,galB,evB,'Invitati B','INVITATI',false) on conflict (id) do nothing;
  -- media: ospite con TAG + dichiarazione minori
  insert into gallery_media(folder_id,gallery_id,entry_id,drive_file_id,media_type,uploaded_by,promo_consent,guest_tags,no_minors) values
    (finvA,galA,evA,'guest:a/ga/1.jpg','PHOTO',gA,true,array['abito_sposa','fiori'],true),
    (finvB,galB,evB,'guest:b/gb/1.jpg','PHOTO',gB,true,array['sposo'],true);
  insert into gallery_guests(entry_id,guest_user_id) values (evA,gA),(evB,gB) on conflict do nothing;
  -- guestbook + audio su entrambi
  insert into public.event_guestbook(entry_id,user_id,message) values (evA,gA,'Auguri A'),(evB,gB,'Auguri B');
  insert into public.event_audio_wishes(entry_id,user_id,storage_path) values (evA,gA,'a/ga/aud.webm'),(evB,gB,'b/gb/aud.webm');
  -- progetti album (impaginatore) su entrambi
  insert into public.album_projects(entry_id,gallery_id,owner_id,format_key) values (evA,galA,pA,'SQ_30'),(evB,galB,pB,'SQ_30') on conflict (entry_id) do nothing;
end$boot$;

create or replace function pg_temp.cnt(p_uid uuid, p_sql text) returns int language plpgsql as $$
declare n int; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true);
  set local role authenticated; execute p_sql into n; reset role; return n;
end$$;

create or replace function pg_temp.ins_blocked(p_uid uuid, p_sql text) returns boolean language plpgsql as $$
declare okk boolean:=true; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true); set local role authenticated;
  begin execute p_sql; okk:=false; exception when others then okk:=true; end;
  reset role; return okk;  -- true = insert BLOCCATO (atteso)
end$$;

-- ── GUESTBOOK ───────────────────────────────────────────────────────────────
-- A1: ospite A vede il guestbook di A
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; n int; begin
  n := pg_temp.cnt(gA,'select count(*) from public.event_guestbook where entry_id=''da700000-0000-0000-0000-00000000aaaa''');
  if n>=1 then raise notice 'GB-A1 OK (ospite A vede il guestbook di A)'; else raise exception 'GB-A1 FAIL n=%',n; end if;
end$$;
-- A2: ospite A NON vede il guestbook di B
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; n int; begin
  n := pg_temp.cnt(gA,'select count(*) from public.event_guestbook where entry_id=''da700000-0000-0000-0000-00000000bbbb''');
  if n=0 then raise notice 'GB-A2 OK (ospite A non vede il guestbook di B)'; else raise exception 'GB-A2 FAIL leak n=%',n; end if;
end$$;
-- A3: ospite A NON può scrivere sul guestbook di B
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; blocked boolean; begin
  blocked := pg_temp.ins_blocked(gA,'insert into public.event_guestbook(entry_id,user_id,message) values (''da700000-0000-0000-0000-00000000bbbb'',''da700000-0000-0000-0000-0000000000a3'',''hack'')');
  if blocked then raise notice 'GB-A3 OK (ospite A non puo firmare il guestbook di B)'; else raise exception 'GB-A3 FAIL ha scritto su B'; end if;
end$$;
-- A4: estraneo (nessuna relazione) NON vede alcun guestbook
do $$ declare strg uuid:='da700000-0000-0000-0000-0000000000f9'; n int; begin
  n := pg_temp.cnt(strg,'select count(*) from public.event_guestbook where entry_id in (''da700000-0000-0000-0000-00000000aaaa'',''da700000-0000-0000-0000-00000000bbbb'')');
  if n=0 then raise notice 'GB-A4 OK (estraneo non vede guestbook)'; else raise exception 'GB-A4 FAIL estraneo vede %',n; end if;
end$$;

-- ── IMPAGINATORE (album_projects) ───────────────────────────────────────────
-- IM1: ospite A NON vede i progetti album (né A né B): è lavoro riservato
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; n int; begin
  n := pg_temp.cnt(gA,'select count(*) from public.album_projects where entry_id in (''da700000-0000-0000-0000-00000000aaaa'',''da700000-0000-0000-0000-00000000bbbb'')');
  if n=0 then raise notice 'IM1 OK (ospite non vede progetti album)'; else raise exception 'IM1 FAIL ospite vede % album_projects',n; end if;
end$$;
-- IM2: ospite A NON può creare un progetto album
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; blocked boolean; begin
  blocked := pg_temp.ins_blocked(gA,'insert into public.album_projects(entry_id,owner_id,format_key) values (''da700000-0000-0000-0000-00000000aaaa'',''da700000-0000-0000-0000-0000000000a3'',''SQ_20'')');
  if blocked then raise notice 'IM2 OK (ospite non puo creare album_project)'; else raise exception 'IM2 FAIL ospite ha creato album_project'; end if;
end$$;
-- IM3: la coppia di A vede SOLO il proprio album_project (A sì, B no)
do $$ declare cA uuid:='da700000-0000-0000-0000-0000000000a4'; na int; nb int; begin
  na := pg_temp.cnt(cA,'select count(*) from public.album_projects where entry_id=''da700000-0000-0000-0000-00000000aaaa''');
  nb := pg_temp.cnt(cA,'select count(*) from public.album_projects where entry_id=''da700000-0000-0000-0000-00000000bbbb''');
  if na=1 and nb=0 then raise notice 'IM3 OK (coppia A vede solo il proprio album)'; else raise exception 'IM3 FAIL a=% b=%',na,nb; end if;
end$$;
-- IM4: il fotografo di A NON vede l'album_project di B
do $$ declare pA uuid:='da700000-0000-0000-0000-0000000000a2'; nb int; begin
  nb := pg_temp.cnt(pA,'select count(*) from public.album_projects where entry_id=''da700000-0000-0000-0000-00000000bbbb''');
  if nb=0 then raise notice 'IM4 OK (fotografo A non vede album di B)'; else raise exception 'IM4 FAIL fotografo A vede % album di B',nb; end if;
end$$;

-- ── AUDIO auguri ────────────────────────────────────────────────────────────
-- AU1: ospite A NON vede gli audio di B; AU2: estraneo 0
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; strg uuid:='da700000-0000-0000-0000-0000000000f9'; nb int; ns int; begin
  nb := pg_temp.cnt(gA,'select count(*) from public.event_audio_wishes where entry_id=''da700000-0000-0000-0000-00000000bbbb''');
  ns := pg_temp.cnt(strg,'select count(*) from public.event_audio_wishes where entry_id in (''da700000-0000-0000-0000-00000000aaaa'',''da700000-0000-0000-0000-00000000bbbb'')');
  if nb=0 and ns=0 then raise notice 'AU1/AU2 OK (audio: nessun leak cross-evento, estraneo 0)'; else raise exception 'AU FAIL b=% estraneo=%',nb,ns; end if;
end$$;

-- ── TAG foto ospiti (catalogo) ──────────────────────────────────────────────
-- TG1: il fotografo di A vede i tag/flag minori delle foto ospiti di A
do $$ declare pA uuid:='da700000-0000-0000-0000-0000000000a2'; n int; begin
  n := pg_temp.cnt(pA,'select count(*) from public.gallery_media where entry_id=''da700000-0000-0000-0000-00000000aaaa'' and array_length(guest_tags,1)>=1 and no_minors=true');
  if n>=1 then raise notice 'TG1 OK (fotografo A vede tag+no_minors delle foto ospiti)'; else raise exception 'TG1 FAIL n=%',n; end if;
end$$;
-- TG2: il fotografo di A NON vede le foto (e i tag) degli ospiti di B
do $$ declare pA uuid:='da700000-0000-0000-0000-0000000000a2'; n int; begin
  n := pg_temp.cnt(pA,'select count(*) from public.gallery_media where entry_id=''da700000-0000-0000-0000-00000000bbbb''');
  if n=0 then raise notice 'TG2 OK (fotografo A non vede foto/tag di B)'; else raise exception 'TG2 FAIL vede % di B',n; end if;
end$$;
-- TG3: ospite A NON può caricare su B (guest_add_media v2 cross-evento)
do $$ declare gA uuid:='da700000-0000-0000-0000-0000000000a3'; r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub',gA::text,'role','authenticated')::text, true); set local role authenticated;
  select public.guest_add_media('da700000-0000-0000-0000-00000000bbbb','b/ga/x.jpg','http://x','PHOTO',true,array['sposa'],true) into r;
  reset role;
  if r->>'error'='forbidden' then raise notice 'TG3 OK (ospite A non puo caricare su B nemmeno con tag)'; else raise exception 'TG3 FAIL %',r; end if;
end$$;

do $$ begin raise notice 'SEC AUDIT: completato — nessun leak'; end$$;
