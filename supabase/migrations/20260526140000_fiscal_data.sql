-- ============================================================================
-- DATI FISCALI — Profiles (riusati su ogni contratto) + snapshot su contracts
-- al momento della firma cliente. Il cliente NON ha un profile; i suoi dati
-- vengono raccolti su /p/accept e congelati nel contract.
-- ============================================================================

-- 1) Profile: campi fiscali mancanti (vat_number/fiscal_code/address/city/zip/country
--    già esistono da onboarding_v2). Aggiungo provincia, codice SDI, PEC,
--    ragione sociale legale.
alter table profiles
  add column if not exists province           varchar(8),
  add column if not exists sdi_code           varchar(10),
  add column if not exists pec_email          varchar(200),
  add column if not exists business_legal_name varchar(200);

comment on column profiles.province is             'Sigla provincia ISO (es. CS, MI). Per contratti e fatture elettroniche.';
comment on column profiles.sdi_code is             'Codice destinatario SDI 7 caratteri per fattura elettronica B2B.';
comment on column profiles.pec_email is            'Indirizzo PEC del fornitore, alternativa a SDI per ricezione fatture.';
comment on column profiles.business_legal_name is  'Ragione sociale completa (es. "Fuyue Srl"), distinta da business_name (brand).';

-- 2) Contracts: snapshot dati fiscali del cliente al momento della firma.
--    Una volta firmato il contratto, questi dati non devono cambiare anche se
--    cliente aggiorna i propri dati. client_fiscal_code esisteva già.
alter table contracts
  add column if not exists client_vat_number    varchar(40),
  add column if not exists client_business_name varchar(200),
  add column if not exists client_address       varchar(260),
  add column if not exists client_city          varchar(120),
  add column if not exists client_zip           varchar(16),
  add column if not exists client_province      varchar(8),
  add column if not exists client_country       varchar(80),
  add column if not exists client_sdi_code      varchar(10),
  add column if not exists client_pec_email     varchar(200);

comment on column contracts.client_vat_number     is 'Snapshot P.IVA cliente al momento della firma. Immutabile.';
comment on column contracts.client_business_name  is 'Snapshot ragione sociale cliente (se persona giuridica). Immutabile.';
comment on column contracts.client_address       is 'Snapshot indirizzo cliente. Immutabile post-firma.';

-- 3) Supplier_clients: dati fiscali per clienti diretti fornitore (per pre-riempire
--    contratti futuri se il cliente torna a comprare).
alter table supplier_clients
  add column if not exists vat_number     varchar(40),
  add column if not exists business_name  varchar(200),
  add column if not exists address        varchar(260),
  add column if not exists city           varchar(120),
  add column if not exists zip            varchar(16),
  add column if not exists province       varchar(8),
  add column if not exists country        varchar(80) default 'Italia',
  add column if not exists sdi_code       varchar(10),
  add column if not exists pec_email      varchar(200);

-- 4) Quote_acceptances: snapshot fiscale al momento della firma (audit trail).
alter table quote_acceptances
  add column if not exists client_fiscal_code    varchar(32),
  add column if not exists client_vat_number     varchar(40),
  add column if not exists client_business_name  varchar(200),
  add column if not exists client_address        varchar(260),
  add column if not exists client_city           varchar(120),
  add column if not exists client_zip            varchar(16),
  add column if not exists client_province       varchar(8),
  add column if not exists client_country        varchar(80),
  add column if not exists client_sdi_code       varchar(10),
  add column if not exists client_pec_email      varchar(200);

comment on column quote_acceptances.client_fiscal_code is
  'Snapshot legale: dati fiscali del cliente dichiarati al momento della firma elettronica del preventivo. Insieme a IP/UA/timestamp costituiscono la prova FES ex art. 20 CAD.';
