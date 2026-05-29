-- ============================================================================
-- Quote verso sposi: in modalita' GLOBAL il preventivo va mascherato
-- ============================================================================
-- Quando il calendar_entry collegato al preventivo ha business_model='GLOBAL',
-- il WP/Location e' l'unico interlocutore della coppia e firma un contratto
-- unico con loro: i fornitori a monte vanno tenuti riservati per evitare che
-- gli sposi li contattino direttamente bypassando il WP.
--
-- Modifica: quote_get_by_token(token) ora include il campo `business_model`
-- (preso da calendar_entries) e quando GLOBAL striscia `supplier_id` da ogni
-- item della risposta. Il PDF (quote-generate-pdf edge function) usera' lo
-- stesso campo per collassare la sezione "Servizi inclusi" in un unico blocco
-- "Servizi coordinati", senza header per fornitore.
-- ============================================================================

create or replace function public.quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote          quotes%rowtype;
  v_items          jsonb;
  v_owner          record;
  v_business_model text := 'GLOBAL';  -- default sicuro: mascherato
begin
  select * into v_quote from public.quotes where access_token = p_token;
  if v_quote.id is null then
    return null;
  end if;

  -- Cerca business_model sul calendar_entry collegato al preventivo
  select ce.business_model into v_business_model
    from public.calendar_entries ce
   where ce.quote_id = v_quote.id
   limit 1;
  -- Se nessun calendar_entry collegato: default GLOBAL (massima tutela)
  v_business_model := coalesce(v_business_model, 'GLOBAL');

  if v_business_model = 'GLOBAL' then
    -- Striscia supplier_id da ogni item per non leakare l'identita'
    select jsonb_agg(
             (to_jsonb(qi) - 'supplier_id') order by qi.sort_order
           )
      into v_items
      from public.quote_items qi
     where qi.quote_id = v_quote.id;
  else
    -- BROKER: gli sposi firmano direttamente con i fornitori → trasparenza
    select jsonb_agg(to_jsonb(qi) order by qi.sort_order)
      into v_items
      from public.quote_items qi
     where qi.quote_id = v_quote.id;
  end if;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color,
         role, subrole, city
    into v_owner
    from public.profiles where id = v_quote.owner_id;

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
    'business_model',    v_business_model,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end$$;

grant execute on function public.quote_get_by_token(uuid) to anon, authenticated;

comment on function public.quote_get_by_token(uuid) is
  'Quote pubblica via token. v3 (2026-05-29): include business_model dal calendar_entry e maschera supplier_id quando GLOBAL.';
