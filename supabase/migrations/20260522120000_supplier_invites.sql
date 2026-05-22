-- ============================================================================
-- Inviti fornitori via email magic link
-- ============================================================================

-- 1. Tabella supplier_invites -----------------------------------------------
create table if not exists supplier_invites (
  id              uuid primary key default gen_random_uuid(),
  email           varchar(200) not null,
  capostipite_id  uuid not null references profiles(id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  status          text not null default 'PENDING'
                  check (status in ('PENDING','ACCEPTED','EXPIRED','CANCELED')),
  subrole_hint    text,
  message         text,
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (email, capostipite_id, status)
);

create index if not exists idx_supplier_invites_capo on supplier_invites(capostipite_id);
create index if not exists idx_supplier_invites_email on supplier_invites(email);
create index if not exists idx_supplier_invites_token on supplier_invites(token);

create trigger trg_supplier_invites_updated_at before update on supplier_invites
  for each row execute function set_updated_at();

-- RLS
alter table supplier_invites enable row level security;

create policy "si_select_owner_or_admin" on supplier_invites for select using (
  capostipite_id = auth.uid() or is_admin()
);
create policy "si_insert_owner" on supplier_invites for insert with check (
  capostipite_id = auth.uid()
);
create policy "si_update_owner" on supplier_invites for update using (
  capostipite_id = auth.uid() or is_admin()
);
create policy "si_delete_owner" on supplier_invites for delete using (
  capostipite_id = auth.uid() or is_admin()
);

-- 2. Trigger esteso: alla creazione di un auth.user con metadata.invite_token,
--    crea profilo FORNITORE + collaboration PENDING + marca invite ACCEPTED.
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

  -- Se metadata contiene invite_token valido per supplier_invites → forza FORNITORE
  if v_token_text is not null then
    select * into v_invite from supplier_invites
      where token = v_token_text::uuid and status = 'PENDING' and expires_at > now()
      limit 1;
    if found then
      v_role := 'FORNITORE';
      if v_subrole is null then v_subrole := v_invite.subrole_hint; end if;
    end if;
  end if;

  insert into public.profiles (id, role, subrole, full_name)
  values (new.id, v_role, v_subrole, v_full)
  on conflict (id) do nothing;

  -- Crea collaboration PENDING + marca invito
  if v_invite.id is not null then
    insert into collaborations (capostipite_id, fornitore_id, status)
    values (v_invite.capostipite_id, new.id, 'PENDING')
    on conflict (capostipite_id, fornitore_id) do nothing;

    update supplier_invites
      set status = 'ACCEPTED', accepted_at = now()
      where id = v_invite.id;
  end if;

  return new;
end$$;

-- 3. RPC: link invito già esistente quando un fornitore già registrato accetta
--    via link (caso utente già nel sistema che riceve nuovo invito).
create or replace function accept_supplier_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite supplier_invites%rowtype;
begin
  if auth.uid() is null then return false; end if;

  select * into v_invite from supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return false; end if;

  insert into collaborations (capostipite_id, fornitore_id, status)
  values (v_invite.capostipite_id, auth.uid(), 'PENDING')
  on conflict (capostipite_id, fornitore_id) do nothing;

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return true;
end$$;

grant execute on function accept_supplier_invite(uuid) to authenticated;
