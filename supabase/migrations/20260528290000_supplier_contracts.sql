-- ============================================================================
-- Contratti per fornitore (3 scenari):
--  1) GLOBAL:   WP↔fornitore (mini-contratto, per impegno servizio)
--  2) BROKER:   fornitore↔coppia (sposi sono clienti diretti)
--  3) STANDALONE: fornitore↔cliente proprio (gestione indipendente)
--
-- Estende `contracts` esistente con:
--   - supplier_id  : il fornitore coinvolto (null se contratto WP↔cliente puro)
--   - party_kind   : tipo di rapporto (CLIENT_WP, SUPPLIER_WP, SUPPLIER_CLIENT)
--   - countersign_at / countersign_data : per la controfirma reciproca
-- Aggiunge tabella `supplier_contract_templates`: ogni fornitore ha N template
-- personalizzati (titolo + sezioni jsonb + categoria di servizio).
-- ============================================================================

-- 1) Enum tipo di parte coinvolta nel contratto
do $$
begin
  if not exists (select 1 from pg_type where typname = 'contract_party_kind') then
    create type contract_party_kind as enum (
      'CLIENT_WP',        -- coppia ↔ WP (modello GLOBAL)
      'SUPPLIER_WP',      -- fornitore ↔ WP (mini-contratto, modello GLOBAL)
      'SUPPLIER_CLIENT'   -- fornitore ↔ coppia (modello BROKER, o standalone)
    );
  end if;
end$$;

alter table contracts
  add column if not exists supplier_id      uuid references profiles(id) on delete set null,
  add column if not exists party_kind       contract_party_kind not null default 'CLIENT_WP',
  add column if not exists countersign_at   timestamptz,
  add column if not exists countersign_data jsonb,
  add column if not exists template_id      uuid;

create index if not exists idx_contracts_supplier on contracts(supplier_id) where supplier_id is not null;
create index if not exists idx_contracts_party    on contracts(party_kind);

comment on column contracts.party_kind is
  'CLIENT_WP = coppia↔WP. SUPPLIER_WP = fornitore↔WP (GLOBAL). SUPPLIER_CLIENT = fornitore↔coppia (BROKER o standalone).';
comment on column contracts.countersign_at is
  'Quando esiste la controfirma reciproca (es. WP firma, fornitore controfirma).';

-- 2) RLS: fornitore vede i contratti dove è supplier_id (oltre ai propri owner_id)
drop policy if exists "contracts_select_supplier" on contracts;
create policy "contracts_select_supplier" on contracts for select using (
  supplier_id = auth.uid()
);

-- I fornitori possono inserire contratti dove supplier_id = se stessi
-- (caso standalone: il fornitore crea il contratto direttamente con un proprio
-- cliente, owner_id = supplier_id).
drop policy if exists "contracts_insert_supplier_own" on contracts;
create policy "contracts_insert_supplier_own" on contracts for insert with check (
  owner_id = auth.uid() or supplier_id = auth.uid()
);

drop policy if exists "contracts_update_supplier_or_owner" on contracts;
create policy "contracts_update_supplier_or_owner" on contracts for update using (
  owner_id = auth.uid() or supplier_id = auth.uid() or is_admin()
);

-- 3) Tabella template contratto per fornitore
create table if not exists supplier_contract_templates (
  id          uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null references profiles(id) on delete cascade,
  title       varchar(200) not null,
  category    varchar(80),
  sections    jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_sct_fornitore on supplier_contract_templates(fornitore_id);

alter table supplier_contract_templates enable row level security;

-- Il fornitore vede e modifica solo i propri template
drop policy if exists "sct_select_own" on supplier_contract_templates;
create policy "sct_select_own" on supplier_contract_templates for select using (
  fornitore_id = auth.uid() or is_admin()
);
drop policy if exists "sct_modify_own" on supplier_contract_templates;
create policy "sct_modify_own" on supplier_contract_templates for all using (
  fornitore_id = auth.uid()
) with check (
  fornitore_id = auth.uid()
);

-- updated_at automatico
create or replace function trg_sct_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end$$;
drop trigger if exists trg_sct_updated on supplier_contract_templates;
create trigger trg_sct_updated before update on supplier_contract_templates
  for each row execute function trg_sct_updated_at();

-- 4) RPC create_supplier_contract:
--    Crea un contratto fornitore (SUPPLIER_WP o SUPPLIER_CLIENT). Usa template
--    custom se p_template_id valorizzato, altrimenti sezioni minime di default.
create or replace function create_supplier_contract(
  p_entry_id    uuid,
  p_supplier_id uuid,
  p_party_kind  text,
  p_template_id uuid default null,
  p_title       text default null
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry calendar_entries%rowtype;
  v_supplier profiles%rowtype;
  v_owner_role text;
  v_sections jsonb;
  v_title text;
  v_amount numeric(12,2);
  v_owner uuid;
  v_client_name text;
  v_client_email text;
  v_row contracts%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not (p_party_kind in ('SUPPLIER_WP', 'SUPPLIER_CLIENT'))
    then raise exception 'invalid_party_kind'; end if;

  select * into v_entry from calendar_entries where id = p_entry_id;
  if v_entry.id is null then raise exception 'entry_not_found'; end if;
  select * into v_supplier from profiles where id = p_supplier_id;
  if v_supplier.id is null then raise exception 'supplier_not_found'; end if;

  -- Authz: solo owner del wedding (WP) o il fornitore stesso possono creare
  if v_entry.owner_id <> auth.uid() and p_supplier_id <> auth.uid() and not is_admin()
    then raise exception 'forbidden'; end if;

  -- owner_id del contratto:
  --  SUPPLIER_WP   → owner = WP, supplier = fornitore
  --  SUPPLIER_CLIENT → owner = fornitore stesso (lui stipula con cliente)
  if p_party_kind = 'SUPPLIER_WP' then
    v_owner := v_entry.owner_id;
  else
    v_owner := p_supplier_id;
  end if;

  -- Sezioni: template custom se passato, altrimenti default minimo
  if p_template_id is not null then
    select sections, title into v_sections, v_title
      from supplier_contract_templates
     where id = p_template_id and fornitore_id = p_supplier_id;
    if v_sections is null then
      raise exception 'template_not_found_for_supplier';
    end if;
  else
    -- Template minimo: oggetto + corrispettivo + obblighi + recesso
    v_sections := jsonb_build_array(
      jsonb_build_object('heading', 'Oggetto', 'body',
        case when p_party_kind = 'SUPPLIER_WP'
          then 'Il fornitore si impegna a fornire il servizio concordato per l''evento del ' || coalesce(to_char(v_entry.date_from, 'DD/MM/YYYY'), 'data da definire') || ', su mandato del wedding planner.'
          else 'Il fornitore si impegna a fornire il servizio concordato direttamente al committente per l''evento del ' || coalesce(to_char(v_entry.date_from, 'DD/MM/YYYY'), 'data da definire') || '.'
        end),
      jsonb_build_object('heading', 'Corrispettivo', 'body',
        'L''importo dovuto sarà quello definito nel preventivo allegato. Saldo entro la data dell''evento salvo diversa pattuizione.'),
      jsonb_build_object('heading', 'Obblighi del fornitore', 'body',
        'Garantire qualità professionale del servizio, puntualità, rispetto degli accordi presi.'),
      jsonb_build_object('heading', 'Recesso', 'body',
        'In caso di recesso oltre 90 giorni dall''evento, viene trattenuto il 30% dell''acconto. Entro 90 giorni, il 100%.')
    );
    v_title := coalesce(p_title, 'Contratto ' ||
      case when p_party_kind = 'SUPPLIER_WP' then 'fornitore-WP' else 'fornitore-cliente' end);
  end if;

  -- Importo: somma quote_items del supplier per il quote del wedding
  select coalesce(sum(line_client), 0) into v_amount
    from quote_items qi
    join calendar_entries ce on ce.quote_id = qi.quote_id
   where ce.id = p_entry_id and qi.supplier_id = p_supplier_id;

  v_client_name  := v_entry.client_name;
  v_client_email := v_entry.client_email;

  insert into contracts (
    owner_id, supplier_id, quote_id, entry_id, title,
    client_name, client_email, event_date, total_amount,
    sections, status, party_kind, template_id, access_token
  ) values (
    v_owner, p_supplier_id, v_entry.quote_id, p_entry_id, coalesce(p_title, v_title),
    v_client_name, v_client_email, v_entry.date_from, v_amount,
    v_sections, 'BOZZA', p_party_kind::contract_party_kind, p_template_id, gen_random_uuid()
  ) returning * into v_row;

  return v_row;
end$$;

grant execute on function create_supplier_contract(uuid, uuid, text, uuid, text) to authenticated;

-- 5) RPC countersign_contract: controfirma del fornitore (o del WP) su un
--    contratto che è stato firmato dall'altra parte.
create or replace function countersign_contract(
  p_contract_id uuid,
  p_signer_name text,
  p_signer_fiscal text
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row contracts%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;

  update contracts set
    countersign_at   = now(),
    countersign_data = jsonb_build_object(
      'name', p_signer_name,
      'fiscal_code', p_signer_fiscal,
      'at', now(),
      'user_id', auth.uid()
    )
  where id = p_contract_id
    and (owner_id = auth.uid() or supplier_id = auth.uid())
    and countersign_at is null
  returning * into v_row;

  if v_row.id is null then raise exception 'not_authorized_or_already_countersigned'; end if;
  return v_row;
end$$;

grant execute on function countersign_contract(uuid, text, text) to authenticated;

-- 6) RPC list_supplier_contracts: lista contratti dove il fornitore è coinvolto
create or replace function list_supplier_contracts()
returns table (
  id           uuid,
  title        text,
  party_kind   text,
  status       text,
  client_name  text,
  event_date   date,
  total_amount numeric,
  signed_at    timestamptz,
  countersign_at timestamptz,
  entry_id     uuid,
  entry_title  text,
  access_token uuid,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.title, c.party_kind::text, c.status::text,
    c.client_name, c.event_date, c.total_amount,
    c.signed_at, c.countersign_at,
    c.entry_id, ce.title, c.access_token, c.created_at
  from contracts c
  left join calendar_entries ce on ce.id = c.entry_id
  where c.supplier_id = auth.uid()
     or (c.owner_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'FORNITORE'))
  order by c.created_at desc;
$$;

grant execute on function list_supplier_contracts() to authenticated;

-- 7) RPC list_contracts_for_entry: il WP vede TUTTI i contratti del proprio
--    wedding (cliente↔WP + fornitori↔WP + fornitori↔cliente)
create or replace function list_contracts_for_entry(p_entry_id uuid)
returns table (
  id           uuid,
  title        text,
  party_kind   text,
  status       text,
  supplier_id  uuid,
  supplier_name text,
  client_name  text,
  signed_at    timestamptz,
  countersign_at timestamptz,
  total_amount numeric,
  access_token uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.title, c.party_kind::text, c.status::text,
    c.supplier_id,
    coalesce(p.business_name, p.full_name) as supplier_name,
    c.client_name, c.signed_at, c.countersign_at, c.total_amount, c.access_token
  from contracts c
  left join profiles p on p.id = c.supplier_id
  join calendar_entries ce on ce.id = c.entry_id
  where c.entry_id = p_entry_id
    and (ce.owner_id = auth.uid() or c.supplier_id = auth.uid() or is_admin())
  order by c.party_kind, c.created_at desc;
$$;

grant execute on function list_contracts_for_entry(uuid) to authenticated;
