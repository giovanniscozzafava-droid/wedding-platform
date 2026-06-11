-- ============================================================================
-- ACCESSO CERCHIO (fornitore suggerito) + PORTA OSPITI — VERDE = corretto.
-- Prova: (1) il fornitore-partecipante NON legge nulla di sensibile
-- (preventivi/contratti/budget/documenti/preferenze-con-budget); (2) MA legge
-- l'organizzazione (playlist/mood); (3) il leak gallery_guests è chiuso (un
-- utente random non può auto-inserirsi ospite di un evento altrui).
-- ============================================================================
do $boot$
declare
  wp  uuid := 'd0000000-0000-0000-0000-0000000000d1';  -- wedding planner owner
  cpl uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- sposa
  forB uuid := 'd0000000-0000-0000-0000-0000000000b1'; -- fornitore SUGGERITO (no preventivo)
  forC uuid := 'd0000000-0000-0000-0000-0000000000c9'; -- fornitore RANDOM, fuori evento
  ev  uuid := 'e0000000-0000-0000-0000-0000000000e1';
  q   uuid := 'e0000000-0000-0000-0000-0000000000a1';  -- preventivo dell'evento
  cat uuid := 'e0000000-0000-0000-0000-0000000000a2';
  gal uuid := 'e0000000-0000-0000-0000-0000000000a3';
begin
  insert into auth.users(id) values (wp),(cpl),(forB),(forC) on conflict do nothing;
  update profiles set role='WEDDING_PLANNER' where id=wp;
  update profiles set role='COUPLE' where id=cpl;
  update profiles set role='FORNITORE', subrole='fioraio' where id in (forB,forC);

  insert into quotes(id,owner_id,title) values (q,wp,'Preventivo Test') on conflict (id) do nothing;
  insert into calendar_entries(id,owner_id,title,date_from,date_to,status,quote_id)
    values (ev,wp,'Evento Test Cerchio','2027-09-01','2027-09-01','OPZIONATA',q) on conflict (id) do nothing;
  -- fornitore B suggerito → partecipante del cerchio (come fa suggest_supplier_to_event)
  insert into calendar_entry_participants(entry_id,user_id,role_in_entry,confirmed)
    values (ev,forB,'fornitore',true) on conflict do nothing;
  insert into wedding_couple_members(entry_id,user_id,email,role)
    values (ev,cpl,'sposa.test@planfully.it','SPOSA') on conflict do nothing;

  -- ── DATI SENSIBILI (il fornitore NON deve vederli) ──
  insert into budget_categories(id,entry_id,name) values (cat,ev,'Catering') on conflict (id) do nothing;
  insert into budget_entries(category_id,entry_id,description,amount) values (cat,ev,'Acconto catering',5000);
  insert into event_documents(entry_id,name,storage_path) values (ev,'Contratto firmato.pdf','docs/ev/contract.pdf');
  insert into couple_preferences(entry_id,budget_min,budget_max) values (ev,15000,25000)
    on conflict (entry_id) do update set budget_min=15000,budget_max=25000;

  -- ── ORGANIZZAZIONE (il fornitore DEVE vederla) ──
  insert into event_playlist(entry_id,moment,song_title) values (ev,'CERIMONIA','Canone in Re');
  insert into mood_images(entry_id,url) values (ev,'https://example.com/mood1.jpg');

  -- galleria (serve per il test leak ospiti: l'owner-check punta qui)
  insert into event_galleries(id,entry_id,owner_id,title) values (gal,ev,wp,'Galleria Test') on conflict (id) do nothing;
end$boot$;

-- helper: conteggio su una tabella entry-scoped, impersonando l'utente
create or replace function pg_temp.seen_tbl(p_uid uuid, p_tbl text, p_entry uuid) returns int language plpgsql as $$
declare n int; begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid::text,'role','authenticated')::text, true);
  set local role authenticated;
  execute format('select count(*) from public.%I where entry_id=$1', p_tbl) into n using p_entry;
  reset role; return n;
end$$;

-- ── R1: fornitore-partecipante NON vede i SENSIBILI (tutti 0) ──────────────
do $$
declare forB uuid := 'd0000000-0000-0000-0000-0000000000b1'; ev uuid := 'e0000000-0000-0000-0000-0000000000e1';
        nb int; nd int; np int; nq int;
begin
  nb := pg_temp.seen_tbl(forB,'budget_entries',ev);
  nd := pg_temp.seen_tbl(forB,'event_documents',ev);
  np := pg_temp.seen_tbl(forB,'couple_preferences',ev);
  -- quotes (no entry_id): conta i preventivi visibili al fornitore
  perform set_config('request.jwt.claims', json_build_object('sub',forB::text,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into nq from public.quotes where id='e0000000-0000-0000-0000-0000000000a1';
  reset role;
  if nb=0 and nd=0 and np=0 and nq=0 then
    raise notice 'R1 OK (fornitore: budget=%, documenti=%, preferenze=%, preventivi=% → 0 sensibili)',nb,nd,np,nq;
  else raise exception 'R1 FAIL LEAK sensibili: budget=% doc=% pref=% quote=%',nb,nd,np,nq; end if;
end$$;

-- ── G1: fornitore-partecipante VEDE l'organizzazione (playlist+mood ≥1) ─────
do $$
declare forB uuid := 'd0000000-0000-0000-0000-0000000000b1'; ev uuid := 'e0000000-0000-0000-0000-0000000000e1'; npl int; nmo int;
begin
  npl := pg_temp.seen_tbl(forB,'event_playlist',ev);
  nmo := pg_temp.seen_tbl(forB,'mood_images',ev);
  if npl>=1 and nmo>=1 then raise notice 'G1 OK (fornitore vede organizzazione: playlist=%, mood=%)',npl,nmo;
  else raise exception 'G1 FAIL organizzazione invisibile: playlist=% mood=%',npl,nmo; end if;
end$$;

-- ── R2: LEAK ospiti CHIUSO — utente random non si auto-inserisce ospite ────
do $$
declare forC uuid := 'd0000000-0000-0000-0000-0000000000c9'; ev uuid := 'e0000000-0000-0000-0000-0000000000e1'; inserted boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',forC::text,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.gallery_guests(entry_id,guest_user_id) values (ev,forC);
    inserted := true;
  exception when others then inserted := false; end;
  reset role;
  if inserted then
    delete from public.gallery_guests where entry_id=ev and guest_user_id=forC;  -- cleanup
    raise exception 'R2 FAIL LEAK: utente random ha potuto auto-inserirsi ospite';
  else raise notice 'R2 OK (self-insert ospite negato: leak chiuso)'; end if;
end$$;

-- ── R3: utente random NON vede le foto INVITATI dell'evento (non è ospite) ──
do $$
declare forC uuid := 'd0000000-0000-0000-0000-0000000000c9'; ev uuid := 'e0000000-0000-0000-0000-0000000000e1'; n int;
begin
  n := pg_temp.seen_tbl(forC,'gallery_media',ev);
  if n=0 then raise notice 'R3 OK (utente random vede 0 foto dell''evento)';
  else raise exception 'R3 FAIL utente random vede % foto',n; end if;
end$$;

do $$ begin raise notice 'CIRCLE ACCESS: completato'; end$$;
