-- ============================================================================
-- ALBUM — SNAPSHOT ALL'APPROVAZIONE + BLOCCO MODIFICHE POST-APPROVAZIONE
-- ----------------------------------------------------------------------------
-- PROBLEMA:
--   1) album_layout_approval registra approved_at/approved_by ma NON quale layout
--      è stato approvato. Nessuno snapshot.
--   2) album_project_save fa `on conflict do update set layout = excluded.layout`
--      SENZA controllare l'approvazione → il fotografo può riscrivere l'impaginazione
--      dopo il "sì" degli sposi e il sistema continua a dire "approvato". Gli sposi
--      approvano X, ricevono Y, nessuna traccia.
--   3) album_layout_approval.entry_id non ha la FK a calendar_entries.
--
-- FIX (stesso principio dei fix firme: ciò che il cliente approva viene CONGELATO):
--   - all'approvazione si salva layout_snapshot + pages_count;
--   - album_project_save rifiuta modifiche se esiste un'approvazione, salvo riapertura;
--   - riaprire = revoca esplicita dell'approvazione (album_reopen_layout).
-- Idempotente. Non tocca album_can_edit né la geometria testata.
-- ============================================================================

-- 1) FK mancante + colonne snapshot su album_layout_approval
alter table public.album_layout_approval
  add column if not exists layout_snapshot jsonb,
  add column if not exists pages_count int;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='album_layout_approval'
      and constraint_type='FOREIGN KEY'
  ) then
    if exists (
      select 1 from public.album_layout_approval a
      left join public.calendar_entries ce on ce.id = a.entry_id
      where ce.id is null
    ) then
      raise notice 'album_layout_approval: righe orfane presenti, FK NON aggiunta. Bonificare prima.';
    else
      alter table public.album_layout_approval
        add constraint album_layout_approval_entry_fk
        foreign key (entry_id) references public.calendar_entries(id) on delete cascade;
    end if;
  end if;
end$$;

-- 2) RPC di approvazione che FOTOGRAFA il layout corrente
create or replace function public.album_approve_layout(p_entry uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_layout jsonb; v_pages int;
begin
  if not public.album_can_edit(p_entry) then
    return jsonb_build_object('error','forbidden');
  end if;
  select layout, coalesce(jsonb_array_length(layout->'pages'),0)
    into v_layout, v_pages
    from public.album_projects where entry_id = p_entry;
  if v_layout is null then
    return jsonb_build_object('error','no_layout');
  end if;
  insert into public.album_layout_approval(entry_id, approved_by, approved_at, layout_snapshot, pages_count)
    values (p_entry, auth.uid(), now(), v_layout, v_pages)
  on conflict (entry_id) do update set
    approved_by = auth.uid(), approved_at = now(),
    layout_snapshot = excluded.layout_snapshot, pages_count = excluded.pages_count;
  return jsonb_build_object('ok', true, 'pages', v_pages);
end$$;
grant execute on function public.album_approve_layout(uuid) to authenticated;

-- 3) GUARD: album_project_save rifiuta modifiche a un layout APPROVATO
create or replace function public.album_project_save(p_entry uuid, p_gallery uuid, p_format text, p_status text, p_layout jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;

  -- NUOVO: se l'album è approvato, il layout è congelato. Va riaperto prima.
  if exists (select 1 from public.album_layout_approval where entry_id = p_entry) then
    return jsonb_build_object('error', 'layout_approvato',
      'message', 'L''album è approvato: riaprilo per modificarlo (l''approvazione degli sposi verrà revocata).');
  end if;

  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  insert into public.album_projects(entry_id, gallery_id, owner_id, format_key, status, layout, updated_by, updated_at)
    values (p_entry, p_gallery, coalesce(v_owner, auth.uid()),
            coalesce(nullif(p_format,''), 'SQ_30'), coalesce(nullif(p_status,''), 'DRAFT'),
            coalesce(p_layout, '{"pages":[]}'::jsonb), auth.uid(), now())
  on conflict (entry_id) do update set
    gallery_id = coalesce(excluded.gallery_id, public.album_projects.gallery_id),
    format_key = excluded.format_key,
    status     = excluded.status,
    layout     = excluded.layout,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

-- 4) Riapertura esplicita: revoca l'approvazione e sblocca il save
create or replace function public.album_reopen_layout(p_entry uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error','forbidden'); end if;
  delete from public.album_layout_approval where entry_id = p_entry;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_reopen_layout(uuid) to authenticated;
