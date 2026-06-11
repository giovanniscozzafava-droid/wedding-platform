-- ============================================================================
-- ISOLAMENTO foto/video (BLINDATISSIMO) — VERDE = RLS corretta.
-- Tre porte (sposi/fornitori/invitati), 2 regimi (lavoro intero 3-in-serie /
-- lavorazione 1), cross-evento, anon. Gli "0 righe" cross-evento/anon = la prova.
-- ============================================================================
\set EV 'a0000000-0000-0000-0000-0000000000a1'

-- ── Bootstrap (superuser) ──────────────────────────────────────────────────
do $boot$
declare
  v_giulia uuid := '00000000-aaaa-0000-0000-000000000002';
  v_aurora uuid := '00000000-aaaa-0000-0000-000000000003';
  v_mario  uuid := '00000000-aaaa-0000-0000-000000000005';
  v_evA uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_evB uuid := 'b0000000-0000-0000-0000-0000000000b1';
  v_for uuid := 'f1000000-0000-0000-0000-000000000001';  -- fioraio nel cerchio A
  v_cpl uuid := 'c1000000-0000-0000-0000-000000000001';  -- sposa di A
  v_gst uuid := 'c1000000-0000-0000-0000-000000000002';  -- invitato di A
  v_gal uuid := 'a0000000-0000-0000-0000-0000000000a9';
  v_fint uuid := gen_random_uuid(); v_flav uuid := gen_random_uuid(); v_finv uuid := gen_random_uuid();
begin
  insert into auth.users(id) values (v_for),(v_cpl),(v_gst) on conflict do nothing;  -- trigger crea profiles
  update profiles set role='FORNITORE', subrole='fioraio' where id=v_for;
  update profiles set role='COUPLE' where id=v_cpl;
  update profiles set role='COUPLE' where id=v_gst;

  -- eventi: A (Giulia), B (Aurora)
  insert into calendar_entries(id,owner_id,title,date_from,date_to,status)
   values (v_evA,v_giulia,'Evento A','2027-06-01','2027-06-01','OPZIONATA'),
          (v_evB,v_aurora,'Evento B','2027-07-01','2027-07-01','OPZIONATA') on conflict (id) do nothing;
  -- cerchio: Mario (fotografo) + fioraio nel cerchio di A; Aurora nel cerchio di B
  insert into calendar_entry_participants(entry_id,user_id,role_in_entry) values
   (v_evA,v_mario,'fotografo'),(v_evA,v_for,'fioraio'),(v_evB,v_aurora,'location') on conflict do nothing;
  -- sposa di A
  insert into wedding_couple_members(entry_id,user_id,email,role) values
   (v_evA,v_cpl,'sposa.a@test.it','SPOSA') on conflict do nothing;

  -- galleria di A (proprietario = Mario fotografo)
  insert into event_galleries(id,entry_id,owner_id,title) values (v_gal,v_evA,v_mario,'Galleria A') on conflict (id) do nothing;
  insert into gallery_folders(id,gallery_id,entry_id,name,level,shared) values
   (v_fint,v_gal,v_evA,'Servizio completo','LAVORO_INTERO',true);                 -- shared ON
  insert into gallery_folders(id,gallery_id,entry_id,name,level,assigned_to) values
   (v_flav,v_gal,v_evA,'Fiori','LAVORAZIONE',v_for);                              -- assegnata al fioraio
  insert into gallery_folders(id,gallery_id,entry_id,name,level) values
   (v_finv,v_gal,v_evA,'Invitati','INVITATI');
  insert into gallery_media(folder_id,gallery_id,entry_id,drive_file_id,media_type) values
   (v_fint,v_gal,v_evA,'drv-int','PHOTO'),(v_flav,v_gal,v_evA,'drv-lav','PHOTO');
  insert into gallery_media(folder_id,gallery_id,entry_id,drive_file_id,media_type,guest_tag_name) values
   (v_finv,v_gal,v_evA,'drv-inv','PHOTO','Giuseppe Esposito');
  -- invitato registrato di A
  insert into gallery_guests(entry_id,guest_user_id,full_name_searched) values (v_evA,v_gst,'Giuseppe Esposito') on conflict do nothing;
end$boot$;

-- helper: quante media di A vede l'utente
create or replace function pg_temp.seen(p_uid uuid) returns int language plpgsql as $$
declare n int; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.gallery_media where entry_id='a0000000-0000-0000-0000-0000000000a1';
  reset role; return n;
end$$;

-- ── G1: SPOSI vedono TUTTO il proprio evento (3) ───────────────────────────
do $$ declare n int; begin
  n := pg_temp.seen('c1000000-0000-0000-0000-000000000001');
  if n=3 then raise notice 'G1 OK (sposi vedono tutte e 3 le media)'; else raise exception 'G1 FAIL sposi vedono % (atteso 3)',n; end if;
end$$;

-- ── G2: FOTOGRAFO (owner) vede tutto (3) ───────────────────────────────────
do $$ declare n int; begin
  n := pg_temp.seen('00000000-aaaa-0000-0000-000000000005');
  if n=3 then raise notice 'G2 OK (fotografo/owner vede 3)'; else raise exception 'G2 FAIL owner vede %',n; end if;
end$$;

-- ── G3: FORNITORE del cerchio, lavorazione=1 interruttore; lavoro intero NON
--        finché manca il consenso sposi (3-in-serie) ───────────────────────
do $$ declare n int; begin
  -- senza consenso: il fioraio vede SOLO la sua cartella di lavorazione (1)
  n := pg_temp.seen('f1000000-0000-0000-0000-000000000001');
  if n=1 then raise notice 'G3a OK (fioraio vede 1: solo lavorazione; lavoro intero gated)'; else raise exception 'G3a FAIL fioraio vede % (atteso 1)',n; end if;
  -- concede il consenso sposi → ora lavoro intero diventa visibile (1+1=2)
  insert into gallery_consents(entry_id,scope,granted_by) values ('a0000000-0000-0000-0000-0000000000a1','LAVORO_INTERO','c1000000-0000-0000-0000-000000000001')
    on conflict (entry_id,scope) do update set revoked_at=null, granted_at=now();
  n := pg_temp.seen('f1000000-0000-0000-0000-000000000001');
  if n=2 then raise notice 'G3b OK (consenso concesso → fioraio vede 2: lavorazione + lavoro intero)'; else raise exception 'G3b FAIL fioraio vede % (atteso 2)',n; end if;
  -- revoca → torna a 1 (consenso revocabile)
  update gallery_consents set revoked_at=now() where entry_id='a0000000-0000-0000-0000-0000000000a1' and scope='LAVORO_INTERO';
  n := pg_temp.seen('f1000000-0000-0000-0000-000000000001');
  if n=1 then raise notice 'G3c OK (consenso revocato → fioraio torna a 1)'; else raise exception 'G3c FAIL fioraio vede % dopo revoca (atteso 1)',n; end if;
end$$;

-- ── G4: INVITATO registrato vede SOLO il livello INVITATI (1) ──────────────
do $$ declare n int; begin
  n := pg_temp.seen('c1000000-0000-0000-0000-000000000002');
  if n=1 then raise notice 'G4 OK (invitato vede solo 1: la cartella invitati)'; else raise exception 'G4 FAIL invitato vede % (atteso 1)',n; end if;
end$$;

-- ── G5: FORNITORE di un ALTRO evento NON vede nulla di A (cross-evento) ─────
do $$ declare n int; begin
  n := pg_temp.seen('00000000-aaaa-0000-0000-000000000003');  -- Aurora, cerchio di B
  if n=0 then raise notice 'G5 OK (fornitore di B vede 0 media di A — isolamento cross-evento)'; else raise exception 'G5 FAIL Aurora vede % media di A',n; end if;
end$$;

-- ── G6: ANON non vede nulla ────────────────────────────────────────────────
do $$ declare n int; begin
  perform set_config('request.jwt.claims','{"role":"anon"}', true); set local role anon;
  begin select count(*) into n from public.gallery_media where entry_id='a0000000-0000-0000-0000-0000000000a1';
  exception when insufficient_privilege then n := -1; end;
  reset role;
  if n<=0 then raise notice 'G6 OK (anon: % — nessun accesso)',n; else raise exception 'G6 FAIL anon vede % media',n; end if;
end$$;

do $$ begin raise notice 'PHOTO ISOLATION: completato'; end$$;
