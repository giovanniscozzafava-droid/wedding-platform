-- ============================================================================
-- BUG (display + coerenza legale): sulle superfici pubbliche del preventivo
-- (/p/preview e /p/accept) il cliente vedeva SEMPRE total_client (somma di TUTTE
-- le voci) anche quando aveva selezionato solo alcune voci (client_decision=
-- 'ACCETTATO'). Il contratto/atto/acconto invece legano già total_client_selected
-- (regola R1: selected>0 ? selected : total_client) → la cliente vedeva un importo
-- e ne firmava un altro. 10 preventivi reali con selezione parziale colpiti.
--
-- Fix minimo lato dati: quote_get_by_token ora ESPONE anche total_client_selected.
-- Il frontend userà la stessa regola R1 per mostrare "solo quello che ha scelto".
-- (client_decision per-voce è già esposto: il frontend può marcare le non incluse.)
-- Nessun cambio al motore soldi: total_client_selected è già calcolato e corretto.
-- ============================================================================

create or replace function public.quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
  v_mode    text;
begin
  select * into v_quote from quotes
   where access_token = p_token
     and token_revoked_at is null
     and is_token_valid(access_token_expires_at);
  if v_quote.id is null then
    return null;
  end if;

  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from profiles where id = v_quote.owner_id;

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
           'category', case
             when public.quote_item_is_blind(qi, v_mode) then coalesce(
               (select sc.name from services s join service_categories sc on sc.id = s.category_id where s.id = qi.service_id),
               'Altri servizi')
             else coalesce(
               (select sc.name from services s join service_categories sc on sc.id = s.category_id where s.id = qi.service_id),
               initcap(nullif((select sp2.subrole from profiles sp2 where sp2.id = qi.supplier_id), '')),
               'Altri servizi')
           end,
           'supplier', case
             when public.quote_item_is_blind(qi, v_mode) or qi.supplier_id is null then null
             else (select jsonb_build_object('name', coalesce(sp.business_name, sp.full_name),
                                             'slug', sp.slug, 'subrole', sp.subrole, 'city', sp.city)
                     from profiles sp where sp.id = qi.supplier_id)
           end
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
    -- NUOVO: totale delle sole voci accettate (0 se nessuna selezione per-voce).
    'total_client_selected', v_quote.total_client_selected,
    'pdf_url',           v_quote.pdf_url,
    'pdf_variant',       v_quote.pdf_variant,
    'direct_client_id',  v_quote.direct_client_id,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end
$$;

grant execute on function public.quote_get_by_token(uuid) to anon, authenticated, service_role;
