-- ============================================================================
-- Portale CLIENTE + brief competenza fornitore→cliente
-- ----------------------------------------------------------------------------
-- 1) handle_new_auth_user: il ruolo CLIENT nasce gia` "onboardato" (niente
--    wizard da professionista).
-- 2) supplier_client_briefs: ciò che il FORNITORE comunica al cliente per la
--    PROPRIA competenza (es. data consegna foto, scaletta del fotografo,
--    setlist della band, brani scelti...). Una riga per preventivo.
-- 3) client_portal_overview(): vista aggregata del cliente autenticato (per
--    email verificata), raggruppata e distinta per professionista. Mostra
--    SEMPRE preventivi e contratti, più il brief di competenza.
-- ============================================================================

-- 1) Trigger: CLIENT senza onboarding wizard --------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role        user_role;
  v_subrole     text;
  v_full        text;
  v_invite      supplier_invites%rowtype;
  v_token_text  text;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';

  if v_token_text is not null then
    select * into v_invite from supplier_invites
      where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
      limit 1;
    if found then
      v_role := 'FORNITORE';
      if v_subrole is null then v_subrole := v_invite.subrole_hint; end if;
    end if;
  end if;

  insert into public.profiles (id, role, subrole, full_name, onboarding_complete)
  values (new.id, v_role, v_subrole, v_full, (v_role = 'CLIENT'))
  on conflict (id) do update
    set role     = excluded.role,
        subrole  = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name);

  return new;
end$$;

-- 2) Brief competenza fornitore→cliente -------------------------------------
create table if not exists public.supplier_client_briefs (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null unique references public.quotes(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  subrole        text,
  delivery_label text,         -- es. "Consegna foto", "Consegna video", "Prove musicali"
  delivery_date  date,         -- es. data di consegna prevista
  headline       text,         -- breve sintesi che il cliente legge in cima
  items          jsonb not null default '[]'::jsonb,  -- [{label, value}] competenza: scaletta, setlist, brani...
  note           text,
  shared_at      timestamptz,  -- valorizzato quando il fornitore "pubblica" il brief al cliente
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_briefs_owner on public.supplier_client_briefs(owner_id);

drop trigger if exists trg_briefs_updated_at on public.supplier_client_briefs;
create trigger trg_briefs_updated_at before update on public.supplier_client_briefs
  for each row execute function set_updated_at();

alter table public.supplier_client_briefs enable row level security;

drop policy if exists "briefs_owner_all" on public.supplier_client_briefs;
create policy "briefs_owner_all" on public.supplier_client_briefs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "briefs_admin_all" on public.supplier_client_briefs;
create policy "briefs_admin_all" on public.supplier_client_briefs
  for all using (is_admin()) with check (is_admin());

comment on table public.supplier_client_briefs is
  'Informazioni di competenza che il FORNITORE comunica al cliente per il singolo preventivo (data consegna, scaletta/setlist propria, brani scelti, note). Lette dal cliente nel suo portale.';

-- 2b) Upsert del brief da parte del fornitore (proprietario del preventivo) --
create or replace function public.upsert_quote_client_brief(
  p_quote_id       uuid,
  p_delivery_label text,
  p_delivery_date  date,
  p_headline       text,
  p_items          jsonb,
  p_note           text,
  p_share          boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_owner   uuid;
  v_subrole text;
  v_id      uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;
  select q.owner_id, p.subrole into v_owner, v_subrole
    from public.quotes q join public.profiles p on p.id = q.owner_id
   where q.id = p_quote_id;
  if v_owner is null then
    return jsonb_build_object('error', 'quote_not_found');
  end if;
  if v_owner <> v_uid and not public.is_admin() then
    return jsonb_build_object('error', 'not_quote_owner');
  end if;

  insert into public.supplier_client_briefs as b
    (quote_id, owner_id, subrole, delivery_label, delivery_date, headline, items, note, shared_at)
  values
    (p_quote_id, v_owner, v_subrole, nullif(trim(coalesce(p_delivery_label,'')),''),
     p_delivery_date, nullif(trim(coalesce(p_headline,'')),''),
     coalesce(p_items, '[]'::jsonb), nullif(trim(coalesce(p_note,'')),''),
     case when p_share then now() else null end)
  on conflict (quote_id) do update set
     delivery_label = excluded.delivery_label,
     delivery_date  = excluded.delivery_date,
     headline       = excluded.headline,
     items          = excluded.items,
     note           = excluded.note,
     shared_at      = case when p_share then now() else b.shared_at end
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

grant execute on function public.upsert_quote_client_brief(uuid, text, date, text, jsonb, text, boolean) to authenticated;

-- 3) Vista aggregata del cliente (per email verificata dal JWT) -------------
create or replace function public.client_portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_result jsonb;
begin
  if v_email = '' then
    return jsonb_build_object('error', 'no_email');
  end if;

  -- Raggruppa per professionista (owner). Ogni gruppo: anagrafica professionista,
  -- i suoi preventivi, i suoi contratti, e i brief di competenza condivisi.
  select coalesce(jsonb_agg(grp order by grp->>'business_name'), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'owner_id', pr.id,
      'business_name', coalesce(pr.business_name, pr.full_name),
      'role', pr.role,
      'subrole', pr.subrole,
      'brand_logo_url', pr.brand_logo_url,
      'brand_primary_color', pr.brand_primary_color,
      'city', pr.city,
      'quotes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'status', q.status,
          'event_kind', q.event_kind,
          'event_date', q.event_date,
          'event_location', q.event_location,
          'total_client', q.total_client,
          'access_token', q.access_token,
          'revision', q.revision,
          'pdf_url', q.pdf_url,
          'brief', (
            select jsonb_build_object(
              'delivery_label', b.delivery_label,
              'delivery_date', b.delivery_date,
              'headline', b.headline,
              'items', b.items,
              'note', b.note
            )
            from public.supplier_client_briefs b
            where b.quote_id = q.id and b.shared_at is not null
          )
        ) order by q.event_date nulls last, q.created_at desc), '[]'::jsonb)
        from public.quotes q
        where q.owner_id = pr.id and lower(q.client_email) = v_email
      ),
      'contracts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'status', c.status,
          'access_token', c.access_token,
          'signed_at', c.signed_at,
          'pdf_url', c.pdf_url
        ) order by c.created_at desc), '[]'::jsonb)
        from public.contracts c
        where c.owner_id = pr.id and lower(c.client_email) = v_email
      )
    ) as grp
    from public.profiles pr
    where pr.id in (
      select owner_id from public.quotes where lower(client_email) = v_email
      union
      select owner_id from public.contracts where lower(client_email) = v_email
    )
  ) groups;

  return jsonb_build_object('ok', true, 'email', v_email, 'professionals', v_result);
end$$;

grant execute on function public.client_portal_overview() to authenticated;

comment on function public.client_portal_overview() is
  'Portale cliente: aggrega, per email verificata del JWT, tutti i preventivi/contratti/brief ricevuti, raggruppati e distinti per professionista (anche fornitori non connessi tra loro).';
