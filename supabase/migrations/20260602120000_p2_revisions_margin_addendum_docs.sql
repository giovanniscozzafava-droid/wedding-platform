-- ============================================================================
-- P2 — quote_context, quote_revisions, margin_mode, contract_addendums,
--       documents.visibility, clause template versioning
-- ============================================================================

-- 1) quote_context (contesto strutturato del preventivo)
alter table public.quotes add column if not exists quote_context jsonb not null default '{}'::jsonb;
comment on column public.quotes.quote_context is
  'Contesto: event_kind, lead_id, supplier_lead_id, source, selected_package, template_id, campaign_data.';

-- 2) quote_revisions: snapshot storico per revisione
create table if not exists public.quote_revisions (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references public.quotes(id) on delete cascade,
  revision_number   int not null,
  created_by        uuid references public.profiles(id) on delete set null,
  reason            text,
  previous_snapshot jsonb,
  new_snapshot      jsonb,
  requires_new_acceptance boolean not null default true,
  client_notified_at timestamptz,
  created_at        timestamptz not null default now(),
  unique (quote_id, revision_number)
);
create index if not exists idx_quote_revisions_quote on public.quote_revisions(quote_id, revision_number desc);

alter table public.quote_revisions enable row level security;
drop policy if exists "quote_revisions_owner" on public.quote_revisions;
create policy "quote_revisions_owner" on public.quote_revisions
  for all using (exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()));
drop policy if exists "quote_revisions_admin" on public.quote_revisions;
create policy "quote_revisions_admin" on public.quote_revisions
  for all using (is_admin()) with check (is_admin());

-- Helper: registra una revisione con snapshot (chiamato dalla modifica forzata)
create or replace function public.record_quote_revision(p_quote_id uuid, p_reason text, p_new_snapshot jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_rev int; v_prev jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select owner_id, revision into v_owner, v_rev from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  select new_snapshot into v_prev from public.quote_revisions
    where quote_id = p_quote_id order by revision_number desc limit 1;
  insert into public.quote_revisions(quote_id, revision_number, created_by, reason, previous_snapshot, new_snapshot)
  values (p_quote_id, coalesce(v_rev,1), v_uid, p_reason, v_prev, p_new_snapshot);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.record_quote_revision(uuid, text, jsonb) to authenticated;

-- 3) margin_mode (modalità marginalità del preventivo)
do $$ begin
  if not exists (select 1 from pg_type where typname='margin_mode') then
    create type public.margin_mode as enum ('HIDDEN_MARKUP','EXPLICIT_COORDINATION_FEE','MIXED');
  end if;
end $$;
alter table public.quotes add column if not exists margin_mode public.margin_mode not null default 'HIDDEN_MARKUP';
comment on column public.quotes.margin_mode is
  'HIDDEN_MARKUP: cliente vede prezzo finale, fornitore il compenso. EXPLICIT_COORDINATION_FEE: cliente vede costi + fee. MIXED: per voce.';

-- 4) contract_addendums (integrazioni a contratto firmato)
create table if not exists public.contract_addendums (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  quote_id        uuid references public.quotes(id) on delete set null,
  entry_id        uuid references public.calendar_entries(id) on delete set null,
  addendum_number int not null default 1,
  status          text not null default 'BOZZA' check (status in ('BOZZA','INVIATO','FIRMATO','ANNULLATO')),
  title           text,
  body            text,
  amount_delta    numeric(12,2),
  date_change     date,
  service_changes jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles(id) on delete set null,
  access_token    uuid default gen_random_uuid(),
  access_token_expires_at timestamptz,
  sent_at         timestamptz,
  signed_at       timestamptz,
  signer_data     jsonb,
  document_hash   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (contract_id, addendum_number)
);
create index if not exists idx_addendums_contract on public.contract_addendums(contract_id);

drop trigger if exists trg_addendums_upd on public.contract_addendums;
create trigger trg_addendums_upd before update on public.contract_addendums
  for each row execute function public.set_updated_at();

alter table public.contract_addendums enable row level security;
drop policy if exists "addendums_owner" on public.contract_addendums;
create policy "addendums_owner" on public.contract_addendums
  for all using (exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid()));
drop policy if exists "addendums_admin" on public.contract_addendums;
create policy "addendums_admin" on public.contract_addendums
  for all using (is_admin()) with check (is_admin());

-- Firma addendum via token (anon, monouso/scadenza-aware)
create or replace function public.addendum_sign_by_token(p_token uuid, p_signer_name text, p_signer_fiscal text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.contract_addendums
   where access_token = p_token and status = 'FIRMATO' and signer_data->>'fiscal_code' = p_signer_fiscal;
  if v_id is not null then return true; end if;
  update public.contract_addendums
     set status='FIRMATO', signed_at=now(),
         signer_data=jsonb_build_object('name',p_signer_name,'fiscal_code',p_signer_fiscal,'at',now())
   where access_token = p_token and status in ('BOZZA','INVIATO')
     and (access_token_expires_at is null or access_token_expires_at > now())
   returning id into v_id;
  return v_id is not null;
end$$;
grant execute on function public.addendum_sign_by_token(uuid, text, text) to anon, authenticated;

-- 5) Document center: visibility su event_documents
do $$ begin
  if not exists (select 1 from pg_type where typname='document_visibility') then
    create type public.document_visibility as enum
      ('PRIVATE_INTERNAL','VISIBLE_TO_CLIENT','VISIBLE_TO_SUPPLIER','VISIBLE_TO_CAPOSTIPITE','PUBLIC_LINK','ADMIN_ONLY');
  end if;
end $$;
alter table public.event_documents
  add column if not exists visibility public.document_visibility not null default 'PRIVATE_INTERNAL';
comment on column public.event_documents.visibility is 'Visibilità del documento per ruolo/destinatario.';

-- 6) Versioning template clausole
alter table public.standard_contract_clauses add column if not exists version int not null default 1;
alter table public.supplier_contract_templates add column if not exists version int not null default 1;
