-- ============================================================================
-- N1 (CRITICO): supplier_items_to_review restituiva line_client (prezzo cliente
-- = costo + markup del capostipite) al fornitore, esponendo il margine del
-- capostipite in "Voci da rivedere". Il fornitore deve vedere il PROPRIO importo
-- (line_cost = quanto incassa dal capostipite), mai line_client.
-- Unica modifica: line_client -> line_cost. Resto invariato.
-- ============================================================================

create or replace function public.supplier_items_to_review()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', qi.id, 'name', qi.name_snapshot, 'quote_id', qi.quote_id,
    'quote_title', q.title, 'client_name', q.client_name, 'event_date', q.event_date,
    'line_cost', qi.line_cost, 'decision', qi.client_decision,
    'decline_reason', qi.client_decline_reason, 'discount_percent', qi.item_discount_percent,
    'counter_note', qi.supplier_counter_note,
    'wp', coalesce(pr.business_name, pr.full_name)
  ) order by qi.client_decided_at desc nulls last), '[]'::jsonb)
  from public.quote_items qi
  join public.quotes q on q.id = qi.quote_id
  left join public.profiles pr on pr.id = q.owner_id
  where qi.supplier_id = auth.uid()
    and qi.client_decision in ('RIFIUTATO','FORSE');
$$;

revoke all on function public.supplier_items_to_review() from public;
grant execute on function public.supplier_items_to_review() to authenticated;
