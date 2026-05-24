-- ============================================================================
-- Pagamenti, finanziamento, assicurazione
-- ============================================================================

-- 1. Stato pagamenti su quote_items: chi ha già pagato e chi no
alter table quote_items
  add column if not exists payment_status text not null default 'NON_PAGATO'
    check (payment_status in ('NON_PAGATO', 'ACCONTO', 'SALDATO', 'STORNATO')),
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text;
  -- BONIFICO, CONTANTI, ASSEGNO, CARTA, FINANZIAMENTO, ALTRO

create index if not exists idx_qitems_payment on quote_items(payment_status);

-- RLS: il fornitore può LEGGERE lo stato pagamenti delle proprie voci
-- (la policy esistente quote_items_select già lo include via supplier_id = auth.uid())

-- 2. Tema matrimonio + nomi tavoli su calendar_entries
alter table calendar_entries
  add column if not exists theme text,
  add column if not exists tables_naming_style text default 'NUMERATI';
  -- 'NUMERATI', 'CITTA', 'FIORI', 'STELLE', 'MARE', 'PERSONALIZZATO'

-- 3. Finanziamento (predisposizione)
create table if not exists finance_offers (
  id              uuid primary key default gen_random_uuid(),
  partner_name    varchar(160) not null,
  partner_logo_url text,
  apr_percent     numeric(5,2),
  max_amount      numeric(12,2),
  max_months      int,
  description     text,
  contract_terms  text,
  is_active       boolean not null default true,
  exclusive_until timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table finance_offers enable row level security;
create policy "fin_select_all_authenticated" on finance_offers for select to authenticated using (true);
create policy "fin_modify_admin" on finance_offers for all using (is_admin()) with check (is_admin());

create table if not exists finance_applications (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid references finance_offers(id) on delete set null,
  quote_id        uuid not null references quotes(id) on delete cascade,
  applicant_id    uuid not null references profiles(id) on delete cascade,
  amount          numeric(12,2) not null,
  months          int not null,
  status          text not null default 'BOZZA'
                  check (status in ('BOZZA','INVIATA','APPROVATA','RIFIUTATA','EROGATA','RIMBORSATA')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table finance_applications enable row level security;
create policy "finapp_select_own" on finance_applications for select using (
  applicant_id = auth.uid() or is_admin()
  or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
);
create policy "finapp_modify_own" on finance_applications for all using (
  applicant_id = auth.uid()
  or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
) with check (
  applicant_id = auth.uid()
  or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
);

-- 4. Assicurazione matrimonio (predisposizione)
create table if not exists insurance_offers (
  id              uuid primary key default gen_random_uuid(),
  partner_name    varchar(160) not null,
  partner_logo_url text,
  product_name    varchar(200) not null,
  coverage_type   text,
    -- 'ANNULLAMENTO','MALATTIA','MALTEMPO','RC_OSPITI','ALL_INCLUSIVE'
  base_price      numeric(10,2),
  description     text,
  contract_terms  text,
  is_active       boolean not null default true,
  exclusive_until timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table insurance_offers enable row level security;
create policy "ins_select_all_authenticated" on insurance_offers for select to authenticated using (true);
create policy "ins_modify_admin" on insurance_offers for all using (is_admin()) with check (is_admin());

create table if not exists insurance_policies (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid references insurance_offers(id) on delete set null,
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  policy_number   varchar(80),
  premium         numeric(10,2),
  status          text not null default 'PREVENTIVO'
                  check (status in ('PREVENTIVO','ATTIVA','SCADUTA','SINISTRO','LIQUIDATA','RIFIUTATA')),
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table insurance_policies enable row level security;
create policy "ins_pol_select" on insurance_policies for select using (
  is_admin()
  or exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))
);
create policy "ins_pol_modify" on insurance_policies for all using (
  is_admin()
  or exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  is_admin()
  or exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Seed partner placeholder
insert into finance_offers (partner_name, apr_percent, max_amount, max_months, description) values
  ('Findomestic Wedding', 7.5, 50000, 60, 'Finanziamento dedicato matrimoni — accordo quadro Planfully')
on conflict do nothing;

insert into insurance_offers (partner_name, product_name, coverage_type, base_price, description) values
  ('AXA Wedding', 'Polizza Matrimonio Plus', 'ALL_INCLUSIVE', 240, 'Annullamento + maltempo + RC ospiti — partner esclusivo Planfully')
on conflict do nothing;
