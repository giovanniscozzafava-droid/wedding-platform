-- ============================================================================
-- RPC pubbliche per pagine cliente (no auth richiesta).
-- Permettono ad anon di leggere/aggiornare un quote SOLO via access_token.
-- ============================================================================

-- 1. Lettura preview pubblica del preventivo --------------------------------
create or replace function quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
begin
  select * into v_quote from quotes where access_token = p_token;
  if v_quote.id is null then
    return null;
  end if;

  select jsonb_agg(to_jsonb(qi) order by qi.sort_order)
    into v_items
    from quote_items qi
   where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',             v_quote.id,
    'title',          v_quote.title,
    'client_name',    v_quote.client_name,
    'event_date',     v_quote.event_date,
    'guest_count',    v_quote.guest_count,
    'status',         v_quote.status,
    'revision',       v_quote.revision,
    'total_client',   v_quote.total_client,
    'pdf_url',        v_quote.pdf_url,
    'pdf_variant',    v_quote.pdf_variant,
    'owner',          to_jsonb(v_owner),
    'items',          coalesce(v_items, '[]'::jsonb)
  );
end$$;

revoke all on function quote_get_by_token(uuid) from public;
grant execute on function quote_get_by_token(uuid) to anon, authenticated;

-- 2. Accettazione preventivo dal cliente ------------------------------------
create or replace function quote_accept_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update quotes
     set status = 'ACCETTATO',
         accepted_at = coalesce(accepted_at, now()),
         client_response_log = client_response_log || jsonb_build_object(
            'event','accepted','at',now()
         )
   where access_token = p_token
     and status in ('INVIATO','ACCETTATO')
   returning id into v_id;

  if v_id is not null then
    update calendar_entries
       set status = 'OPZIONATA', updated_at = now()
     where quote_id = v_id
       and status in ('IN_TRATTATIVA','OPZIONATA');
  end if;

  return v_id is not null;
end$$;

revoke all on function quote_accept_by_token(uuid) from public;
grant execute on function quote_accept_by_token(uuid) to anon, authenticated;

-- 3. Rifiuto preventivo dal cliente -----------------------------------------
create or replace function quote_reject_by_token(p_token uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update quotes
     set status = 'RIFIUTATO',
         rejected_at = coalesce(rejected_at, now()),
         rejection_reason = coalesce(p_reason,''),
         client_response_log = client_response_log || jsonb_build_object(
            'event','rejected','at',now(),'reason',coalesce(p_reason,'')
         )
   where access_token = p_token
     and status in ('INVIATO','RIFIUTATO')
   returning id into v_id;

  if v_id is not null then
    update calendar_entries
       set status = 'CANCELLATA', updated_at = now()
     where quote_id = v_id;
  end if;

  return v_id is not null;
end$$;

revoke all on function quote_reject_by_token(uuid, text) from public;
grant execute on function quote_reject_by_token(uuid, text) to anon, authenticated;
