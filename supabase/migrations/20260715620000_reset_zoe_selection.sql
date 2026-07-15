-- RESET TEST ZOE: azzera lo stato di selezione per un test pulito.
-- "42 selezionate" = album_choice=KEPT già scritti su tutto l'evento (mie 30 foto test + foto di
-- un'altra galleria dello stesso entry). Lo swipe non le tocca (solo il submit scrive album_choice),
-- quindi restano fisse. Qui: album_choice=null su TUTTE le foto dell'evento + selezione ACTIVE giro 1.
do $$
declare v_entry uuid; v_gal uuid; v_tok uuid; v_gals int; v_upd int; v jsonb;
begin
  select ce.id into v_entry from public.calendar_entries ce
   where ce.title ilike '%zoe%'
      or exists (select 1 from public.calendar_entries_private p where p.entry_id = ce.id and p.client_name ilike '%zoe%')
   order by ce.created_at desc limit 1;
  select count(*) into v_gals from public.event_galleries where entry_id = v_entry;
  -- pin alla galleria del token di test (quella con le mie 30 foto), non a un ordine qualsiasi
  select id, share_token into v_gal, v_tok from public.event_galleries
    where share_token = '19a4ecc1-86de-4469-8b3d-a9bdf5a9e774' limit 1;
  if v_gal is null then
    select id, share_token into v_gal, v_tok from public.event_galleries where entry_id = v_entry order by created_at limit 1;
  end if;
  raise notice 'RESET ZOE: entry=% · gallerie su questo evento=% · gallery test=% token=%', v_entry, v_gals, v_gal, v_tok;

  update public.gallery_media set album_choice = null where entry_id = v_entry;
  get diagnostics v_upd = row_count;
  delete from public.gallery_selection_decisions where gallery_id = v_gal;
  update public.gallery_selection set status = 'ACTIVE', round = 1, submitted_at = null, updated_at = now() where gallery_id = v_gal;

  raise notice 'RESET ZOE: album_choice azzerato su % foto; decisioni cancellate; selezione ACTIVE giro 1', v_upd;
  select public.gallery_get_by_token(v_tok) into v;
  raise notice 'RESET ZOE: RPC total=% pool=% kept=% status=% · link /g/%',
    v->'selection'->>'total', v->'selection'->>'pool', v->'selection'->>'kept', v->'selection'->>'status', v_tok;
end $$;
