-- ============================================================================
-- P4 — feature_flags generici ; P5 — product_interest_requests, moderazione feed
-- ============================================================================

-- ── P4: feature flags ──────────────────────────────────────────────────────
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  rollout     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
drop policy if exists "flags_read_all" on public.feature_flags;
create policy "flags_read_all" on public.feature_flags for select using (true);
drop policy if exists "flags_admin_write" on public.feature_flags;
create policy "flags_admin_write" on public.feature_flags for all using (is_admin()) with check (is_admin());

drop trigger if exists trg_flags_upd on public.feature_flags;
create trigger trg_flags_upd before update on public.feature_flags
  for each row execute function public.set_updated_at();

create table if not exists public.feature_flag_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key     text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  primary key (user_id, key)
);
alter table public.feature_flag_overrides enable row level security;
drop policy if exists "flag_ovr_self" on public.feature_flag_overrides;
create policy "flag_ovr_self" on public.feature_flag_overrides for select using (user_id = auth.uid() or is_admin());
drop policy if exists "flag_ovr_admin" on public.feature_flag_overrides;
create policy "flag_ovr_admin" on public.feature_flag_overrides for all using (is_admin()) with check (is_admin());

create or replace function public.feature_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.feature_flag_overrides where key = p_key and user_id = auth.uid()),
    (select enabled from public.feature_flags where key = p_key),
    false);
$$;
grant execute on function public.feature_enabled(text) to anon, authenticated;

insert into public.feature_flags(key, enabled, description) values
  ('community_enabled', true, 'Feed/community professionisti'),
  ('referral_enabled', true, 'Programma referral'),
  ('reviews_enabled', true, 'Recensioni e stelle'),
  ('guest_site_enabled', true, 'Sito ospiti + RSVP'),
  ('payments_enabled', true, 'Scadenzario/pagamenti'),
  ('financing_module', false, 'Modulo finanziamento (soon)'),
  ('insurance_module', false, 'Modulo assicurazione (soon)'),
  ('supplier_team_enabled', true, 'Team/sotto-fornitori'),
  ('embedded_form_enabled', true, 'Form lead embeddabile'),
  ('client_portal_enabled', true, 'Area cliente aggregata'),
  ('addendums_enabled', true, 'Integrazioni contrattuali'),
  ('supplier_leads_enabled', true, 'Pipeline lead fornitore')
on conflict (key) do nothing;

-- ── P5: product interest (raccolta interesse moduli soon) ───────────────────
create table if not exists public.product_interest_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_key text not null,
  event_id   uuid references public.calendar_entries(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_prod_interest_user on public.product_interest_requests(user_id);
alter table public.product_interest_requests enable row level security;
drop policy if exists "prod_interest_self" on public.product_interest_requests;
create policy "prod_interest_self" on public.product_interest_requests
  for all using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- ── P5: moderazione feed ────────────────────────────────────────────────────
alter table public.posts
  add column if not exists moderation_status text not null default 'PUBLISHED'
    check (moderation_status in ('DRAFT','PUBLISHED','HIDDEN','REPORTED','REMOVED')),
  add column if not exists reported_count int not null default 0,
  add column if not exists moderation_note text;

create or replace function public.moderate_post(p_post_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  -- Report: qualsiasi utente autenticato; Hide/Remove/Restore: admin
  if p_action = 'REPORT' then
    update public.posts set reported_count = reported_count + 1,
      moderation_status = case when moderation_status = 'PUBLISHED' then 'REPORTED' else moderation_status end
     where id = p_post_id;
    perform public.log_access('posts', p_post_id::text, 'WRITE', jsonb_build_object('op','report'));
    return jsonb_build_object('ok', true);
  end if;
  if not public.is_admin() then return jsonb_build_object('error','admin_required'); end if;
  update public.posts set
    moderation_status = case p_action when 'HIDE' then 'HIDDEN' when 'REMOVE' then 'REMOVED'
                                      when 'RESTORE' then 'PUBLISHED' else moderation_status end,
    moderation_note = coalesce(p_note, moderation_note)
   where id = p_post_id;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.moderate_post(uuid, text, text) to authenticated;

comment on table public.feature_flags is 'Feature flag globali per rollout controllato. Override per-utente in feature_flag_overrides.';
comment on table public.product_interest_requests is 'Manifestazioni di interesse per moduli in arrivo (finanziamento/assicurazione).';
