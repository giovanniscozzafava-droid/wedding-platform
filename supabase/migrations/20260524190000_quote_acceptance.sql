-- Accettazione preventivo con valore legale (firma elettronica semplice).
-- Cattura: dati identità, firma touchscreen, IP, user-agent, timestamp,
-- hash del PDF preventivo per garantire integrità del documento accettato.

create table quote_acceptances (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references quotes(id) on delete cascade,
  access_token      uuid not null,  -- token link cliente al momento dell'accettazione
  quote_revision    int not null,    -- snapshot revisione accettata
  quote_pdf_hash    text,            -- SHA-256 del PDF firmato (per integrita)
  signer_name       varchar(160) not null,
  signer_email      varchar(200) not null,
  signer_phone      varchar(40),
  doc_type          text not null check (doc_type in ('CARTA_IDENTITA', 'PASSAPORTO', 'PATENTE')),
  doc_number        varchar(40) not null,
  doc_issued_by     varchar(120),
  signature_url     text not null,   -- PNG firma salvato in storage
  ip_address        text,
  user_agent        text,
  consent_terms     boolean not null default true,
  consent_privacy   boolean not null default true,
  acceptance_pdf_url text,           -- PDF atto di accettazione controfirmato (generato dopo)
  accepted_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_qa_quote on quote_acceptances(quote_id);
create index idx_qa_email on quote_acceptances(signer_email);

alter table quote_acceptances enable row level security;

-- L'owner del preventivo (WP) puo vedere le accettazioni dei propri preventivi
create policy "qa_select_owner"
  on quote_acceptances for select
  using (
    exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
    or is_admin()
  );

-- INSERT solo da edge function (service_role), non da client diretto
create policy "qa_admin_modify"
  on quote_acceptances for all
  using (is_admin())
  with check (is_admin());

-- Bucket per le firme + documenti identita (privato, solo signed URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-signatures', 'quote-signatures', false, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Solo service role scrive; owner del quote puo leggere (signed URL)
drop policy if exists "qa_sig_read_owner" on storage.objects;
create policy "qa_sig_read_owner"
  on storage.objects for select
  using (
    bucket_id = 'quote-signatures'
    and (
      is_admin()
      or exists (
        select 1 from quote_acceptances qa
        join quotes q on q.id = qa.quote_id
        where (qa.signature_url like '%' || name || '%' or qa.acceptance_pdf_url like '%' || name || '%')
          and q.owner_id = auth.uid()
      )
    )
  );

comment on table quote_acceptances is 'Accettazioni preventivo con firma elettronica semplice (FES). Cattura dati identita, firma, IP, user-agent, timestamp e hash PDF preventivo per audit trail legalmente valido (art. 20 CAD, art. 1326 c.c.).';
