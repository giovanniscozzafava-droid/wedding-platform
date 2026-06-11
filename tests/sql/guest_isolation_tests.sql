-- ============================================================================
-- ISOLAMENTO RIGOROSO porta ospiti / QR / galleria — VERDE = nessun leak.
-- Due eventi A e B di fornitori diversi. Si prova, in avanti e all'inverso, che un
-- ospite/QR di A NON tocca MAI nulla di B né i dati sensibili di A.
-- ============================================================================
do $boot$
declare
  wpA uuid:='d5000000-0000-0000-0000-0000000000a1'; pA uuid:='d5000000-0000-0000-0000-0000000000a2'; gA uuid:='d5000000-0000-0000-0000-0000000000a3';
  wpB uuid:='d5000000-0000-0000-0000-0000000000b1'; pB uuid:='d5000000-0000-0000-0000-0000000000b2'; gB uuid:='d5000000-0000-0000-0000-0000000000b3';
  evA uuid:='d5000000-0000-0000-0000-00000000aaaa'; galA uuid:='d5000000-0000-0000-0000-00000000aaab';
  evB uuid:='d5000000-0000-0000-0000-00000000bbbb'; galB uuid:='d5000000-0000-0000-0000-00000000bbbc';
  qA uuid:='d5000000-0000-0000-0000-00000000aaa0'; catA uuid:='d5000000-0000-0000-0000-00000000aaa9';
  finvA uuid:='d5000000-0000-0000-0000-00000000a111'; flavA uuid:='d5000000-0000-0000-0000-00000000a222'; finvB uuid:='d5000000-0000-0000-0000-00000000b111';
begin
  insert into auth.users(id) values (wpA),(pA),(gA),(wpB),(pB),(gB) on conflict do nothing;
  update profiles set role='WEDDING_PLANNER' where id in (wpA,wpB);
  update profiles set role='FORNITORE', subrole='fotografo' where id in (pA,pB);
  update profiles set role='COUPLE' where id in (gA,gB);

  insert into quotes(id,owner_id,title) values (qA,wpA,'Prev A') on conflict (id) do nothing;
  insert into calendar_entries(id,owner_id,title,date_from,date_to,status,quote_id) values
    (evA,wpA,'Evento A','2027-06-01','2027-06-01','CONFERMATA',qA),
    (evB,wpB,'Evento B','2027-07-01','2027-07-01','CONFERMATA',null) on conflict (id) do nothing;
  -- fotografo PA nel cerchio di A (partecipante) e proprietario della galleria A
  insert into calendar_entry_participants(entry_id,user_id,role_in_entry,confirmed) values (evA,pA,'fotografo',true) on conflict do nothing;
  insert into event_galleries(id,entry_id,owner_id,title,guest_token) values
    (galA,evA,pA,'Gal A','TOKENA'),(galB,evB,pB,'Gal B','TOKENB') on conflict (id) do nothing;
  -- cartelle/media A: INVITATI (ospiti) + LAVORO_INTERO (riservata sposi)
  insert into gallery_folders(id,gallery_id,entry_id,name,level,shared) values
    (finvA,galA,evA,'Foto & video degli ospiti','INVITATI',false),
    (flavA,galA,evA,'Servizio completo','LAVORO_INTERO',true) on conflict (id) do nothing;
  insert into gallery_folders(id,gallery_id,entry_id,name,level) values (finvB,galB,evB,'Invitati B','INVITATI') on conflict (id) do nothing;
  insert into gallery_media(folder_id,gallery_id,entry_id,drive_file_id,media_type) values
    (finvA,galA,evA,'a-inv','PHOTO'),(flavA,galA,evA,'a-lav','PHOTO'),(finvB,galB,evB,'b-inv','PHOTO');
  -- una foto caricata dall'ospite GA (uploaded_by)
  insert into gallery_media(folder_id,gallery_id,entry_id,drive_file_id,media_type,uploaded_by,promo_consent) values
    (finvA,galA,evA,'guest:a/ga/x.jpg','PHOTO',gA,true);
  insert into gallery_guests(entry_id,guest_user_id) values (evA,gA),(evB,gB) on conflict do nothing;
  -- dati sensibili su A
  insert into budget_categories(id,entry_id,name) values (catA,evA,'Cat') on conflict (id) do nothing;
  insert into budget_entries(category_id,entry_id,description,amount) values (catA,evA,'Acconto',9000);
  insert into event_documents(entry_id,name,storage_path) values (evA,'Contratto.pdf','d/a.pdf');
  -- consensi marketing
  insert into marketing_consents(user_id,email,full_name,entry_id,commercial,recontact) values
    (gA,'ga@test.it','GA',evA,true,true),(gB,'gb@test.it','GB',evB,true,true);
end$boot$;

create or replace function pg_temp.cnt(p_uid uuid, p_sql text) returns int language plpgsql as $$
declare n int; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true);
  set local role authenticated; execute p_sql into n; reset role; return n;
end$$;

-- G1: ospite A vede SOLO le media INVITATI di A (2: la foto evento + il suo upload), NON la LAVORO_INTERO
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; n int; begin
  n := pg_temp.cnt(gA, 'select count(*) from public.gallery_media where entry_id=''d5000000-0000-0000-0000-00000000aaaa''');
  if n=2 then raise notice 'G1 OK (ospite A vede 2 media INVITATI, non la cartella sposi)'; else raise exception 'G1 FAIL ospite A vede % (atteso 2)',n; end if;
end$$;

-- R1: ospite A vede 0 media di B (cross-evento)
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; n int; begin
  n := pg_temp.cnt(gA, 'select count(*) from public.gallery_media where entry_id=''d5000000-0000-0000-0000-00000000bbbb''');
  if n=0 then raise notice 'R1 OK (ospite A vede 0 media di B)'; else raise exception 'R1 FAIL ospite A vede % media di B',n; end if;
end$$;

-- R2: ospite A vede 0 dati sensibili di A (budget, documenti, preventivi)
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; nb int; nd int; nq int; begin
  nb := pg_temp.cnt(gA, 'select count(*) from public.budget_entries where entry_id=''d5000000-0000-0000-0000-00000000aaaa''');
  nd := pg_temp.cnt(gA, 'select count(*) from public.event_documents where entry_id=''d5000000-0000-0000-0000-00000000aaaa''');
  nq := pg_temp.cnt(gA, 'select count(*) from public.quotes where id=''d5000000-0000-0000-0000-00000000aaa0''');
  if nb=0 and nd=0 and nq=0 then raise notice 'R2 OK (ospite A: 0 budget/documenti/preventivi)'; else raise exception 'R2 FAIL leak sensibili budget=% doc=% quote=%',nb,nd,nq; end if;
end$$;

-- R3: ospite A NON può auto-iscriversi a B (cross-evento self-insert negato)
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; inserted boolean:=false; begin
  perform set_config('request.jwt.claims', json_build_object('sub',gA::text,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.gallery_guests(entry_id,guest_user_id) values ('d5000000-0000-0000-0000-00000000bbbb',gA); inserted:=true; exception when others then inserted:=false; end;
  reset role;
  if inserted then delete from public.gallery_guests where entry_id='d5000000-0000-0000-0000-00000000bbbb' and guest_user_id=gA; raise exception 'R3 FAIL ospite A si e iscritto a B'; else raise notice 'R3 OK (ospite A non puo iscriversi a B)'; end if;
end$$;

-- R4: il token di A NON apre la galleria B (bad_token)
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub',gA::text,'role','authenticated')::text, true); set local role authenticated;
  select public.join_event_as_guest('d5000000-0000-0000-0000-00000000bbbc','TOKENA') into r;  -- galleria B, token di A
  reset role;
  if r->>'error'='bad_token' then raise notice 'R4 OK (token di A non apre la galleria B)'; else raise exception 'R4 FAIL join cross: %',r; end if;
end$$;

-- G2: il fotografo di A vede l'upload dell'ospite (uploaded_by + cerchio); R5: 0 di B
do $$ declare pA uuid:='d5000000-0000-0000-0000-0000000000a2'; ng int; nb int; begin
  ng := pg_temp.cnt(pA, 'select count(*) from public.gallery_media where entry_id=''d5000000-0000-0000-0000-00000000aaaa'' and uploaded_by is not null');
  nb := pg_temp.cnt(pA, 'select count(*) from public.gallery_media where entry_id=''d5000000-0000-0000-0000-00000000bbbb''');
  if ng>=1 and nb=0 then raise notice 'G2/R5 OK (fotografo A vede % upload ospite, 0 di B)',ng; else raise exception 'G2/R5 FAIL upload_visti=% B=%',ng,nb; end if;
end$$;

-- R6: consensi marketing — ognuno vede SOLO il proprio
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; nmine int; nother int; begin
  nmine := pg_temp.cnt(gA, 'select count(*) from public.marketing_consents where user_id=''d5000000-0000-0000-0000-0000000000a3''');
  nother := pg_temp.cnt(gA, 'select count(*) from public.marketing_consents where user_id=''d5000000-0000-0000-0000-0000000000b3''');
  if nmine=1 and nother=0 then raise notice 'R6 OK (ospite vede solo il proprio consenso marketing)'; else raise exception 'R6 FAIL mine=% other=%',nmine,nother; end if;
end$$;

-- R7: ospite A NON può aggiungere media a B (guest_add_media cross-evento negato)
do $$ declare gA uuid:='d5000000-0000-0000-0000-0000000000a3'; r jsonb; begin
  perform set_config('request.jwt.claims', json_build_object('sub',gA::text,'role','authenticated')::text, true); set local role authenticated;
  select public.guest_add_media('d5000000-0000-0000-0000-00000000bbbb','b/ga/x.jpg','http://x','PHOTO',true) into r;
  reset role;
  if r->>'error'='forbidden' then raise notice 'R7 OK (ospite A non puo caricare su B)'; else raise exception 'R7 FAIL guest_add cross: %',r; end if;
end$$;

do $$ begin raise notice 'GUEST ISOLATION: completato'; end$$;
