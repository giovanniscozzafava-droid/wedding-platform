-- ============================================================================
-- IL CLIENTE NON DEVE MAI VEDERE IL RICARICO. quote_get_by_token restituiva
-- to_jsonb(qi) = TUTTA la riga voce (line_cost, item_markup_percent,
-- snapshot_price) nel payload pubblico → visibile in devtools. Ora si espongono
-- SOLO i campi client-safe (nome, descrizione, unità, quantità, PREZZO FINALE).
-- ----------------------------------------------------------------------------
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
  select * into v_quote from quotes
   where access_token = p_token
     and is_token_valid(access_token_expires_at);
  if v_quote.id is null then
    return null;
  end if;

  -- WHITELIST: nessun costo/ricarico. Solo prezzo finale al cliente.
  select jsonb_agg(jsonb_build_object(
           'id',                  qi.id,
           'name_snapshot',       qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot',       qi.unit_snapshot,
           'quantity',            qi.quantity,
           'line_client',         qi.line_client,
           'sort_order',          qi.sort_order,
           'is_optional',         qi.is_optional,
           'alternative_group',   qi.alternative_group,
           'selected_by_client',  qi.selected_by_client,
           'client_decision',     qi.client_decision,
           'supplier_id',         qi.supplier_id
         ) order by qi.sort_order)
    into v_items
    from quote_items qi
   where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color,
         role, subrole, city
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',                v_quote.id,
    'title',             v_quote.title,
    'client_name',       v_quote.client_name,
    'client_email',      v_quote.client_email,
    'event_date',        v_quote.event_date,
    'event_kind',        v_quote.event_kind,
    'event_location',    v_quote.event_location,
    'guest_count',       v_quote.guest_count,
    'status',            v_quote.status,
    'revision',          v_quote.revision,
    'total_client',      v_quote.total_client,
    'pdf_url',           v_quote.pdf_url,
    'pdf_variant',       v_quote.pdf_variant,
    'direct_client_id',  v_quote.direct_client_id,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end$$;
