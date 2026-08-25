-- ============================================================================
-- PDF/contratto: il generatore PDF stampa un blocco "Committente" NATIVO dalle
-- colonne contract.client_* (oltre alle "Premesse" prodotte da build_contract_sections).
-- Se quelle colonne restano vuote alla creazione, il blocco nativo mostra dati
-- mancanti mentre le Premesse (ora corrette, mig 181000) mostrano il fiscale reale
-- → identità del cliente incoerente nello stesso documento.
-- Fix: alla CREAZIONE del contratto, travasare l'identità del cliente dalle
-- fonti reali (ultima quote_acceptances → fallback supplier_clients) nelle
-- colonne contract.client_*. Solo per contratti verso il cliente
-- (CLIENT_WP / SUPPLIER_CLIENT) e solo se il campo è ancora vuoto.
-- ============================================================================
create or replace function public.contracts_fill_client_identity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_acc record; v_sc record; v_qemail text;
begin
  if new.quote_id is null then return new; end if;
  if new.party_kind is not null and new.party_kind not in ('CLIENT_WP','SUPPLIER_CLIENT') then
    return new;
  end if;

  select qa.* into v_acc from public.quote_acceptances qa
    where qa.quote_id = new.quote_id order by qa.created_at desc limit 1;
  select sc.* into v_sc from public.supplier_clients sc
    join public.quotes q on q.id = new.quote_id and q.direct_client_id = sc.id;
  select client_email into v_qemail from public.quotes where id = new.quote_id;

  new.client_name          := coalesce(nullif(trim(new.client_name),''),          nullif(trim(v_acc.signer_name),''),           nullif(trim(v_sc.full_name),''),      new.client_name);
  new.client_email         := coalesce(nullif(trim(new.client_email),''),         nullif(trim(v_qemail),''),                    new.client_email);
  new.client_business_name := coalesce(nullif(trim(new.client_business_name),''),  nullif(trim(v_acc.client_business_name),''),  nullif(trim(v_sc.business_name),''));
  new.client_fiscal_code   := coalesce(nullif(trim(new.client_fiscal_code),''),    nullif(trim(v_acc.client_fiscal_code),''),    nullif(trim(v_sc.fiscal_code),''));
  new.client_vat_number    := coalesce(nullif(trim(new.client_vat_number),''),     nullif(trim(v_acc.client_vat_number),''),     nullif(trim(v_sc.vat_number),''));
  new.client_address       := coalesce(nullif(trim(new.client_address),''),        nullif(trim(v_acc.client_address),''),        nullif(trim(v_sc.address),''));
  new.client_city          := coalesce(nullif(trim(new.client_city),''),           nullif(trim(v_acc.client_city),''),           nullif(trim(v_sc.city),''));
  new.client_zip           := coalesce(nullif(trim(new.client_zip),''),            nullif(trim(v_acc.client_zip),''),            nullif(trim(v_sc.zip),''));
  new.client_province      := coalesce(nullif(trim(new.client_province),''),       nullif(trim(v_acc.client_province),''),       nullif(trim(v_sc.province),''));
  new.client_country       := coalesce(nullif(trim(new.client_country),''),        nullif(trim(v_acc.client_country),''),        nullif(trim(v_sc.country),''));
  new.client_sdi_code      := coalesce(nullif(trim(new.client_sdi_code),''),       nullif(trim(v_acc.client_sdi_code),''),       nullif(trim(v_sc.sdi_code),''));
  new.client_pec_email     := coalesce(nullif(trim(new.client_pec_email),''),      nullif(trim(v_acc.client_pec_email),''),      nullif(trim(v_sc.pec_email),''));
  return new;
end$$;

drop trigger if exists trg_contracts_fill_client_identity on public.contracts;
create trigger trg_contracts_fill_client_identity
  before insert on public.contracts
  for each row execute function public.contracts_fill_client_identity();
