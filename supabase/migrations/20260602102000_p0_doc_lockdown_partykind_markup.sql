-- ============================================================================
-- P0-D/E/F — hash PDF contratto (colonna), lockdown PII firma,
--            coerenza party_kind↔business_model, constraint markup
-- ============================================================================

-- P0-D: colonna hash PDF contratto (idempotente; popolata dall'edge function)
alter table public.contracts add column if not exists contract_pdf_hash text;
comment on column public.contracts.contract_pdf_hash is 'SHA-256 del PDF contratto generato, per integrità legale.';

-- Allinea il trigger signature audit all'hash reale del contratto
create or replace function public.sig_audit_from_contract_sign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') then
    insert into public.signature_audit_trail(document_type, document_id, signer_name, signer_email,
      doc_type, doc_number_masked, document_hash, signed_at, metadata)
    values ('contract', new.id,
      coalesce(new.signature_data->>'name', new.client_name), new.client_email,
      new.signature_data->>'doc_type',
      public.mask_doc_number(coalesce(new.signature_data->>'fiscal_code', new.client_fiscal_code)),
      coalesce(new.contract_pdf_hash, new.signature_data->>'pdf_hash'),
      coalesce(new.signed_at, now()),
      jsonb_build_object('offline', coalesce(new.signed_offline, false)))
    on conflict (document_type, document_id, signed_at) do nothing;
  end if;
  return new;
end$$;

-- P0-E: lockdown grant su quote_acceptances (PII firma: doc_number, IP, ecc.).
-- La RLS già limita la lettura a owner/admin; revochiamo i grant ridondanti e
-- pericolosi (DELETE/TRUNCATE/INSERT/UPDATE) da anon/authenticated. Il flusso di
-- firma usa service_role (bypassa RLS) quindi non serve grant diretto.
revoke all on public.quote_acceptances from anon;
revoke insert, update, delete, truncate, references, trigger on public.quote_acceptances from authenticated;
-- authenticated mantiene solo SELECT (gated dalla policy owner/admin).

-- P0-F.1: constraint range markup (dati attuali: item NULL, supplier 5..30).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'qitems_markup_range') then
    alter table public.quote_items
      add constraint qitems_markup_range
      check (item_markup_percent is null or item_markup_percent between -100 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qsupmarkup_range') then
    alter table public.quote_supplier_markups
      add constraint qsupmarkup_range
      check (markup_percent is null or markup_percent between -100 and 1000);
  end if;
end$$;

-- P0-F.2: coerenza party_kind ↔ business_model / direct_client_id.
-- Conservativo: blocca solo le combinazioni chiaramente illegali, con bypass admin.
create or replace function public.enforce_contract_party_kind()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_model text;
begin
  -- Admin bypass (data-fix straordinari)
  if public.is_admin() then return new; end if;

  -- Contratto verso cliente diretto del fornitore → deve essere SUPPLIER_CLIENT
  if new.direct_client_id is not null and new.party_kind <> 'SUPPLIER_CLIENT' then
    raise exception 'party_kind_illegale: contratto diretto fornitore→cliente deve essere SUPPLIER_CLIENT (ricevuto %)', new.party_kind;
  end if;

  -- Modello dell'evento collegato
  if new.entry_id is not null then
    select business_model into v_model from public.calendar_entries where id = new.entry_id;
    if v_model = 'BROKER' and new.party_kind = 'SUPPLIER_WP' then
      raise exception 'party_kind_illegale: in modello BROKER il fornitore firma col cliente (SUPPLIER_CLIENT), non col capostipite (SUPPLIER_WP)';
    end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_contracts_party_kind on public.contracts;
create trigger trg_contracts_party_kind before insert on public.contracts
  for each row execute function public.enforce_contract_party_kind();

comment on function public.enforce_contract_party_kind() is
  'Coerenza party_kind↔business_model/direct_client_id lato server. SUPPLIER_CLIENT obbligatorio per contratti diretti fornitore; vietato SUPPLIER_WP in BROKER. Bypass admin.';
