-- ============================================================================
-- CLUSTER 1 — "FIRMATO è terminale"
-- Invariante: un atto FIRMATO non si ri-firma, non si ri-collega, non si
-- controfirma prima della firma, non si cancella, e il suo registro legale
-- (signature_audit_trail) non si separa mai da lui.
-- Chiude: BRK-A-06/07/07b/08/09/10/11 · BRK-C-01/02/05/09/10.
-- NON tocca signature_audit_trail (i delete sono BLOCCATI a monte).
-- ============================================================================

-- ── 1) contract_sign_full: no ri-firma su FIRMATO (idempotente, niente
--       overwrite) + token revocato/scaduto bloccano (A-07/07b, A-10, A-11) ──
create or replace function public.contract_sign_full(
  p_token uuid, p_signer_name text, p_signer_fiscal text,
  p_doc_type text default null, p_doc_number text default null, p_doc_issued_by text default null,
  p_signature_data_url text default null, p_consent_terms boolean default false, p_consent_privacy boolean default false)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid; v_quote uuid; v_acc quote_acceptances%rowtype;
  v_status contract_status; v_revoked timestamptz; v_expires timestamptz;
  v_name text; v_fiscal text; v_dtype text; v_dnum text; v_dissued text;
begin
  if not (coalesce(p_consent_terms, false) and coalesce(p_consent_privacy, false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signature_data_url), '') = '' then
    raise exception 'signature_required';
  end if;

  -- stato + token del contratto puntato dal token
  select quote_id, status, token_revoked_at, access_token_expires_at
    into v_quote, v_status, v_revoked, v_expires
    from public.contracts where access_token = p_token;
  if not found then
    return false;
  end if;

  -- token revocato/scaduto: la firma NON deve riuscire (A-10/A-11)
  if v_revoked is not null then raise exception 'token_revoked'; end if;
  if v_expires is not null and v_expires < now() then raise exception 'token_expired'; end if;

  -- già FIRMATO: idempotente, NON riscrive signature_data (A-07/07b)
  if v_status = 'FIRMATO' then
    return true;
  end if;

  if v_quote is not null then
    select * into v_acc from public.quote_acceptances
     where quote_id = v_quote order by accepted_at desc limit 1;
  end if;

  v_name    := coalesce(nullif(trim(p_signer_name), ''),    v_acc.signer_name);
  v_fiscal  := coalesce(nullif(trim(p_signer_fiscal), ''),  v_acc.client_fiscal_code);
  v_dtype   := coalesce(nullif(trim(p_doc_type), ''),       v_acc.doc_type);
  v_dnum    := coalesce(nullif(trim(p_doc_number), ''),     v_acc.doc_number);
  v_dissued := coalesce(nullif(trim(p_doc_issued_by), ''),  v_acc.doc_issued_by);

  if coalesce(trim(v_name), '') = '' then raise exception 'signer_name_required'; end if;

  update public.contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         client_fiscal_code = coalesce(nullif(trim(v_fiscal), ''), client_fiscal_code),
         signature_data = coalesce(signature_data, '{}'::jsonb) || jsonb_build_object(
            'name', v_name, 'fiscal_code', v_fiscal, 'doc_type', v_dtype,
            'doc_number', v_dnum, 'doc_issued_by', v_dissued,
            'signature_image', p_signature_data_url,
            'consent_terms', p_consent_terms, 'consent_privacy', p_consent_privacy, 'at', now())
   where access_token = p_token
     and status in ('BOZZA', 'INVIATO')   -- niente 'FIRMATO': no overwrite
   returning id into v_id;

  return v_id is not null;
end$function$;

-- ── 2) addendum_sign_full: no ri-firma su FIRMATO (idempotente) (A-08) ──────
create or replace function public.addendum_sign_full(
  p_token uuid, p_signer_name text, p_signer_fiscal text,
  p_doc_type text default null, p_doc_number text default null, p_doc_issued_by text default null,
  p_signature_data_url text default null, p_consent_terms boolean default false, p_consent_privacy boolean default false)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid; v_quote uuid; v_status text; v_acc quote_acceptances%rowtype;
  v_name text; v_fiscal text; v_dtype text; v_dnum text; v_dissued text;
begin
  if not (coalesce(p_consent_terms,false) and coalesce(p_consent_privacy,false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signature_data_url),'') = '' then
    raise exception 'signature_required';
  end if;

  select id, quote_id, status into v_id, v_quote, v_status
    from public.contract_addendums
   where access_token = p_token
     and (access_token_expires_at is null or access_token_expires_at > now());
  if v_id is null then return false; end if;

  -- già FIRMATO: idempotente, niente overwrite del firmatario
  if v_status = 'FIRMATO' then return true; end if;
  if v_status not in ('BOZZA','INVIATO') then return false; end if;

  if v_quote is not null then
    select * into v_acc from public.quote_acceptances
     where quote_id = v_quote order by accepted_at desc limit 1;
  end if;
  v_name    := coalesce(nullif(trim(p_signer_name), ''),    v_acc.signer_name);
  v_fiscal  := coalesce(nullif(trim(p_signer_fiscal), ''),  v_acc.client_fiscal_code);
  v_dtype   := coalesce(nullif(trim(p_doc_type), ''),       v_acc.doc_type);
  v_dnum    := coalesce(nullif(trim(p_doc_number), ''),     v_acc.doc_number);
  v_dissued := coalesce(nullif(trim(p_doc_issued_by), ''),  v_acc.doc_issued_by);
  if coalesce(trim(v_name),'') = '' then raise exception 'signer_name_required'; end if;

  update public.contract_addendums
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         signer_data = jsonb_build_object(
            'name', v_name, 'fiscal_code', v_fiscal, 'doc_type', v_dtype,
            'doc_number', v_dnum, 'doc_issued_by', v_dissued,
            'signature_image', p_signature_data_url,
            'consent_terms', p_consent_terms, 'consent_privacy', p_consent_privacy, 'at', now())
   where id = v_id and status in ('BOZZA','INVIATO')
   returning id into v_id;
  return v_id is not null;
end$function$;

-- ── 3) countersign_contract: solo su contratto FIRMATO e firmato (A-09) ─────
create or replace function public.countersign_contract(p_contract_id uuid, p_signer_name text, p_signer_fiscal text)
returns contracts language plpgsql security definer set search_path to 'public'
as $function$
declare v_row contracts%rowtype; v_status contract_status; v_signed timestamptz;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;

  select status, signed_at into v_status, v_signed from contracts where id = p_contract_id;
  if not found then raise exception 'contract_not_found'; end if;
  if v_status <> 'FIRMATO' or v_signed is null then
    raise exception 'contract_not_signed_yet';   -- niente controfirma prima della firma del cliente
  end if;

  update contracts set
    countersign_at   = now(),
    countersign_data = jsonb_build_object('name', p_signer_name, 'fiscal_code', p_signer_fiscal, 'at', now(), 'user_id', auth.uid())
  where id = p_contract_id
    and (owner_id = auth.uid() or supplier_id = auth.uid())
    and status = 'FIRMATO' and signed_at is not null
    and countersign_at is null
  returning * into v_row;

  if v_row.id is null then raise exception 'not_authorized_or_already_countersigned'; end if;
  return v_row;
end$function$;

-- ── 4) contracts_enforce_quote_accettato: anche su UPDATE OF quote_id +
--       blocco re-link di contratto FIRMATO (A-06) ───────────────────────────
create or replace function public.contracts_enforce_quote_accettato()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_status quote_status;
begin
  if coalesce(new.party_kind::text, 'CLIENT_WP') <> 'CLIENT_WP' then
    return new;
  end if;

  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN') then
    return new;  -- override admin (emergenze)
  end if;

  -- no re-link di un contratto FIRMATO (A-06)
  if tg_op = 'UPDATE' and old.status = 'FIRMATO' and new.quote_id is distinct from old.quote_id then
    raise exception 'Contratto FIRMATO: impossibile ri-collegare il preventivo.' using errcode = 'P0001';
  end if;

  if new.quote_id is null then
    raise exception 'Contratto CLIENT_WP richiede un preventivo collegato (quote_id mancante).'
      using errcode = 'P0001';
  end if;

  select status into v_status from public.quotes where id = new.quote_id;
  if v_status is null then
    raise exception 'Preventivo % non trovato.', new.quote_id using errcode = 'P0001';
  end if;
  if v_status not in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    raise exception 'Il preventivo collegato e'' in stato %, devi farlo firmare prima di collegarlo.', v_status
      using errcode = 'P0001';
  end if;

  return new;
end$function$;

drop trigger if exists trg_contracts_enforce_quote_upd on public.contracts;
create trigger trg_contracts_enforce_quote_upd
  before update of quote_id on public.contracts
  for each row execute function contracts_enforce_quote_accettato();

-- ── 5) Atti firmati non cancellabili — BACKSTOP a livello trigger (vale per
--       OGNI path/ruolo, anche superuser e cascate) (C-01/02/05/09/10) ───────
create or replace function public.tg_block_delete_quote_with_signed_act()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.contracts c where c.quote_id = old.id and c.status = 'FIRMATO')
     or exists (select 1 from public.quote_acceptances qa where qa.quote_id = old.id) then
    raise exception 'cannot_delete_quote_with_signed_act'
      using hint = 'Il preventivo ha un atto firmato (contratto FIRMATO o accettazione): non e'' cancellabile.';
  end if;
  return old;
end$function$;

drop trigger if exists trg_block_delete_quote_signed on public.quotes;
create trigger trg_block_delete_quote_signed
  before delete on public.quotes
  for each row execute function tg_block_delete_quote_with_signed_act();

create or replace function public.tg_block_delete_entry_with_signed_act()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if exists (
        select 1 from public.contracts c
         where c.status = 'FIRMATO'
           and (c.entry_id = old.id or (old.quote_id is not null and c.quote_id = old.quote_id)))
     or exists (
        select 1 from public.quote_acceptances qa
         where old.quote_id is not null and qa.quote_id = old.quote_id) then
    raise exception 'cannot_delete_entry_with_signed_act'
      using hint = 'L''evento ha un atto firmato collegato: non e'' cancellabile.';
  end if;
  return old;
end$function$;

drop trigger if exists trg_block_delete_entry_signed on public.calendar_entries;
create trigger trg_block_delete_entry_signed
  before delete on public.calendar_entries
  for each row execute function tg_block_delete_entry_with_signed_act();

-- ── 6) Raise esplicito nelle RPC cascade (messaggio chiaro, fail-fast) ──────
create or replace function public.delete_quote_cascade(p_quote_id uuid)
returns table(bucket text, path text) language plpgsql security definer set search_path to 'public'
as $function$
declare v_owner uuid; v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select owner_id into v_owner from quotes where id = p_quote_id;
  if v_owner is null then raise exception 'quote_not_found'; end if;
  select is_admin() into v_is_admin;
  if v_owner <> auth.uid() and not coalesce(v_is_admin, false) then raise exception 'forbidden'; end if;

  -- atto firmato collegato: NON cancellabile (C-01)
  if exists (select 1 from contracts where quote_id = p_quote_id and status = 'FIRMATO')
     or exists (select 1 from quote_acceptances where quote_id = p_quote_id) then
    raise exception 'cannot_delete_quote_with_signed_act';
  end if;

  create temporary table _tmp_paths on commit drop as select * from _quote_storage_paths(p_quote_id);
  update calendar_entries set quote_id = null where quote_id = p_quote_id;
  delete from contracts where quote_id = p_quote_id;
  delete from quotes where id = p_quote_id;
  return query select t.bucket, t.path from _tmp_paths t where t.path is not null and t.path <> '';
end$function$;

create or replace function public.delete_wedding_cascade(p_entry_id uuid)
returns table(bucket text, path text) language plpgsql security definer set search_path to 'public'
as $function$
declare v_owner uuid; v_is_admin boolean; v_quote_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select owner_id, quote_id into v_owner, v_quote_id from calendar_entries where id = p_entry_id;
  if v_owner is null then raise exception 'entry_not_found'; end if;
  select is_admin() into v_is_admin;
  if v_owner <> auth.uid() and not coalesce(v_is_admin, false) then raise exception 'forbidden'; end if;

  -- atto firmato collegato (via evento o via preventivo): NON cancellabile (C-02)
  if exists (select 1 from contracts where status = 'FIRMATO'
               and (entry_id = p_entry_id or (v_quote_id is not null and quote_id = v_quote_id)))
     or exists (select 1 from quote_acceptances where v_quote_id is not null and quote_id = v_quote_id) then
    raise exception 'cannot_delete_entry_with_signed_act';
  end if;

  create temporary table _tmp_paths on commit drop as select * from _wedding_storage_paths(p_entry_id);
  delete from calendar_entries where id = p_entry_id;
  if v_quote_id is not null then
    delete from contracts where quote_id = v_quote_id;
    delete from quotes where id = v_quote_id;
  end if;
  return query select t.bucket, t.path from _tmp_paths t where t.path is not null and t.path <> '';
end$function$;

-- ── 7) Difesa in profondità: stringi le policy RLS di DELETE diretto, così un
--       owner authenticated non puo' nemmeno tentare il DELETE che scavalca la
--       RPC (C-09/C-10). Il backstop al §5 copre comunque ogni altro ruolo. ──
create or replace function public._quote_has_signed_act(p_quote_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from contracts where quote_id = p_quote_id and status = 'FIRMATO')
      or exists (select 1 from quote_acceptances where quote_id = p_quote_id);
$$;

create or replace function public._entry_has_signed_act(p_entry_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from contracts c
     left join calendar_entries e on e.id = p_entry_id
     where c.status = 'FIRMATO'
       and (c.entry_id = p_entry_id or (e.quote_id is not null and c.quote_id = e.quote_id)));
$$;

drop policy if exists quotes_delete_owner on public.quotes;
create policy quotes_delete_owner on public.quotes
  for delete using (owner_id = auth.uid() and not public._quote_has_signed_act(id));

drop policy if exists calentry_delete_owner on public.calendar_entries;
create policy calentry_delete_owner on public.calendar_entries
  for delete using (owner_id = auth.uid() and not public._entry_has_signed_act(id));
