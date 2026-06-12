-- ============================================================================
-- SELEZIONE ALBUM — VERDE = corretto.
-- La cliente (es. Zoe) tiene/scarta; SOLO gli sposi/admin possono scegliere; il
-- fotografo (owner) NON può scegliere al posto loro ma RILEGGE le KEPT per lo ZIP.
-- ============================================================================
-- pulizia idempotente: evita di duplicare i media seed ai run successivi.
do $clean$ declare ev uuid:='a1100000-0000-0000-0000-0000000000e1';
begin
  delete from gallery_media where entry_id=ev;
  delete from gallery_folders where entry_id=ev;
  delete from wedding_couple_members where entry_id=ev;
  delete from event_galleries where entry_id=ev;
  delete from calendar_entries where id=ev;
end$clean$;

do $boot$
declare
  wp   uuid := 'a1100000-0000-0000-0000-0000000000f1';  -- fotografo (owner galleria)
  cpl  uuid := 'a1100000-0000-0000-0000-0000000000c1';  -- Zoe (sposi)
  forX uuid := 'a1100000-0000-0000-0000-0000000000f9';  -- altro fornitore (NON sposi)
  ev   uuid := 'a1100000-0000-0000-0000-0000000000e1';
  gal  uuid := 'a1100000-0000-0000-0000-0000000000a9';
  fol  uuid := 'a1100000-0000-0000-0000-0000000000b9';
begin
  insert into auth.users(id) values (wp),(cpl),(forX) on conflict do nothing;
  update profiles set role='FORNITORE', subrole='fotografo' where id in (wp,forX);
  update profiles set role='COUPLE' where id=cpl;
  insert into calendar_entries(id,owner_id,title,date_from,date_to,status)
    values (ev,wp,'Evento Zoe Test','2027-06-01','2027-06-01','CONFERMATA') on conflict (id) do nothing;
  insert into wedding_couple_members(entry_id,user_id,email,role) values (ev,cpl,'zoe@test.it','SPOSA') on conflict do nothing;
  insert into event_galleries(id,entry_id,owner_id,title) values (gal,ev,wp,'Galleria Zoe') on conflict (id) do nothing;
  insert into gallery_folders(id,gallery_id,entry_id,name,level,shared) values (fol,gal,ev,'Servizio','LAVORO_INTERO',true) on conflict (id) do nothing;
  insert into gallery_media(gallery_id,entry_id,folder_id,drive_file_id,media_type) values
    (gal,ev,fol,'z-1','PHOTO'),(gal,ev,fol,'z-2','PHOTO'),(gal,ev,fol,'z-3','PHOTO');
end$boot$;

-- helper: chiama set_album_choice impersonando un utente, ritorna l'errore (o null)
create or replace function pg_temp.choose(p_uid uuid, p_media uuid, p_choice text) returns text language plpgsql as $$
declare r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true);
  set local role authenticated;
  select public.set_album_choice(p_media, p_choice) into r;
  reset role; return r->>'error';
end$$;

-- ── G1: la cliente (sposi) sceglie KEPT/DISCARDED ──────────────────────────
do $$
declare cpl uuid := 'a1100000-0000-0000-0000-0000000000c1'; ev uuid := 'a1100000-0000-0000-0000-0000000000e1';
        ids uuid[]; e1 text; e2 text;
begin
  select array_agg(id order by drive_file_id) into ids from gallery_media where entry_id=ev;
  e1 := pg_temp.choose(cpl, ids[1], 'KEPT');
  e2 := pg_temp.choose(cpl, ids[2], 'DISCARDED');
  if e1 is null and e2 is null then raise notice 'G1 OK (sposi possono scegliere: KEPT + DISCARDED)';
  else raise exception 'G1 FAIL sposi non possono scegliere: % / %',e1,e2; end if;
end$$;

-- ── R1: un fornitore NON-sposi NON può scegliere (forbidden) ───────────────
do $$
declare forX uuid := 'a1100000-0000-0000-0000-0000000000f9'; ev uuid := 'a1100000-0000-0000-0000-0000000000e1';
        ids uuid[]; e text;
begin
  select array_agg(id order by drive_file_id) into ids from gallery_media where entry_id=ev;
  e := pg_temp.choose(forX, ids[3], 'KEPT');
  if e='forbidden' then raise notice 'R1 OK (fornitore non-sposi: scelta negata)';
  else raise exception 'R1 FAIL fornitore ha potuto scegliere (err=%)',e; end if;
end$$;

-- ── R2: il fotografo (owner) NON sceglie al posto degli sposi ──────────────
do $$
declare wp uuid := 'a1100000-0000-0000-0000-0000000000f1'; ev uuid := 'a1100000-0000-0000-0000-0000000000e1';
        ids uuid[]; e text;
begin
  select array_agg(id order by drive_file_id) into ids from gallery_media where entry_id=ev;
  e := pg_temp.choose(wp, ids[3], 'KEPT');
  if e='forbidden' then raise notice 'R2 OK (fotografo/owner: non sceglie al posto degli sposi)';
  else raise exception 'R2 FAIL il fotografo ha potuto scegliere (err=%)',e; end if;
end$$;

-- ── G2: il fotografo RILEGGE solo le KEPT (per lo ZIP) = 1 ──────────────────
do $$
declare wp uuid := 'a1100000-0000-0000-0000-0000000000f1'; ev uuid := 'a1100000-0000-0000-0000-0000000000e1'; n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',wp::text,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from gallery_media where entry_id=ev and album_choice='KEPT';
  reset role;
  if n=1 then raise notice 'G2 OK (fotografo vede 1 KEPT da mettere nello ZIP)';
  else raise exception 'G2 FAIL il fotografo vede % KEPT (atteso 1)',n; end if;
end$$;

do $$ begin raise notice 'ALBUM SELECTION: completato'; end$$;
