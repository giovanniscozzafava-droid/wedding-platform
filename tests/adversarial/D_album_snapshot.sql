-- ============================================================================
-- ADVERSARIAL — Album: snapshot all'approvazione + congelamento layout
-- ----------------------------------------------------------------------------
-- Rottura (pre-fix): album_project_save fa `on conflict do update set layout=...`
--   SENZA controllare l'approvazione → il fotografo riscrive l'impaginazione dopo
--   il "sì" degli sposi, e album_layout_approval continua a dire "approvato".
--   Gli sposi approvano X, ricevono Y, nessuna traccia.
-- Fix: mig. 20260702094000 — album_approve_layout fotografa layout_snapshot;
--   album_project_save ritorna {error:'layout_approvato'} se esiste un'approvazione;
--   album_reopen_layout revoca esplicitamente e sblocca il save.
--
-- Rosso == rottura viva (save sovrascrive l'approvato). Verde == save rifiutato.
-- Blocco autonomo begin/rollback, fixture fresca, si agisce da OWNER (jwt sub).
--
-- Esecuzione (con Docker locale):
--   docker exec -i supabase_db_wedding-platform psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=0 -f tests/adversarial/D_album_snapshot.sql 2>&1
-- ============================================================================
\set ON_ERROR_STOP 0

begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_entry uuid := gen_random_uuid();
  v_gal   uuid := gen_random_uuid();
  v_l1 jsonb := '{"pages":[{"id":"p1"}],"bleed":3}'::jsonb;             -- layout approvato
  v_l2 jsonb := '{"pages":[{"id":"p1"},{"id":"p2"}],"bleed":3}'::jsonb; -- tentativo di modifica
  v_snap jsonb; v_after jsonb; r jsonb;
begin
  -- Fixture: owner (profilo auto-creato dal trigger), evento, galleria, album con layout v_l1
  insert into auth.users(id) values (v_owner);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  insert into public.calendar_entries(id, owner_id, title, date_from, date_to)
    values (v_entry, v_owner, 'Album snapshot test', current_date, current_date);
  insert into public.event_galleries(id, entry_id, owner_id) values (v_gal, v_entry, v_owner);
  insert into public.album_projects(entry_id, gallery_id, owner_id, format_key, status, layout)
    values (v_entry, v_gal, v_owner, 'SQ_30', 'DRAFT', v_l1);

  -- 1) Approvazione → snapshot uguale al layout del progetto
  r := public.album_approve_layout(v_entry);
  select layout_snapshot into v_snap from public.album_layout_approval where entry_id = v_entry;
  if v_snap is distinct from v_l1 then
    raise exception 'BRK-ALBUM-01: layout_snapshot != layout approvato (% vs %)', v_snap, v_l1;
  end if;

  -- 2) Save con layout DIVERSO deve essere RIFIUTATO e NON cambiare il layout salvato
  r := public.album_project_save(v_entry, v_gal, 'SQ_30', 'DRAFT', v_l2);
  if (r->>'error') is distinct from 'layout_approvato' then
    raise exception 'BRK-ALBUM-02: save su album approvato NON rifiutato (%). Il fotografo può sovrascrivere l''approvazione.', r;
  end if;
  select layout into v_after from public.album_projects where entry_id = v_entry;
  if v_after is distinct from v_l1 then
    raise exception 'BRK-ALBUM-02b: layout cambiato dopo save su album approvato (% -> %)', v_l1, v_after;
  end if;

  -- 3) Riapertura → l'approvazione sparisce e il save torna libero
  r := public.album_reopen_layout(v_entry);
  if exists (select 1 from public.album_layout_approval where entry_id = v_entry) then
    raise exception 'BRK-ALBUM-03: album_reopen_layout non ha revocato l''approvazione';
  end if;
  r := public.album_project_save(v_entry, v_gal, 'SQ_30', 'DRAFT', v_l2);
  if (r->>'ok') is distinct from 'true' then
    raise exception 'BRK-ALBUM-03b: save dopo riapertura fallito (%)', r;
  end if;

  raise notice 'ALBUM-SNAPSHOT: tutti i controlli passati (VERDE)';
end$$;
rollback;
