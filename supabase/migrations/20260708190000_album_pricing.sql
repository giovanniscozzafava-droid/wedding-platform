-- ════════════════════════════════════════════════════════════════════════════
-- PREZZO ALBUM (vendita fotografo → coppia)
-- Due livelli:
--   1) LISTINO del fotografo (album_price_settings, uno per owner): riutilizzabile,
--      per formato → prezzo base + pagine incluse + €/pagina extra + box + album
--      famiglia (base + €/pagina) + delta per tier modello.
--   2) CONTRATTO dell'evento (album_projects.price_config): eredita dal listino,
--      ritoccabile, con le scelte reali (modello/box/quantità album famiglia).
-- Le pagine extra si calcolano LIVE dal numero reale di pagine dell'impaginato
-- (client): qui salviamo solo la configurazione, non il totale.
-- La coppia LEGGE il price_config (già dentro ap_rw), lo SCRIVE solo l'owner/admin.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) LISTINO del fotografo ───────────────────────────────────────────────────
create table if not exists public.album_price_settings (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.album_price_settings enable row level security;

drop policy if exists aps_rw on public.album_price_settings;
create policy aps_rw on public.album_price_settings for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- 2) CONTRATTO dell'evento ────────────────────────────────────────────────────
alter table public.album_projects add column if not exists price_config jsonb;

-- Salva/aggiorna il LISTINO del fotografo (il proprio).
create or replace function public.album_price_settings_save(p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth'); end if;
  insert into public.album_price_settings(owner_id, config, updated_at)
    values (auth.uid(), coalesce(p_config, '{}'::jsonb), now())
  on conflict (owner_id) do update set config = excluded.config, updated_at = now();
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_price_settings_save(jsonb) to authenticated;

-- Salva il PREZZO ALBUM di un evento. Solo OWNER della galleria o admin (NON la coppia:
-- la coppia lo vede ma non lo cambia).
create or replace function public.album_price_config_save(p_entry uuid, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if not (coalesce(v_owner, '00000000-0000-0000-0000-000000000000'::uuid) = auth.uid() or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  insert into public.album_projects(entry_id, owner_id, price_config, updated_by, updated_at)
    values (p_entry, coalesce(v_owner, auth.uid()), p_config, auth.uid(), now())
  on conflict (entry_id) do update set
    price_config = excluded.price_config, updated_by = auth.uid(), updated_at = now();
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_price_config_save(uuid, jsonb) to authenticated;
