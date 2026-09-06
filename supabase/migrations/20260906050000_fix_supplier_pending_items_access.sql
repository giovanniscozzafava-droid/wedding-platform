-- ============================================================================
-- Bug reale trovato oggi mentre si girava il video tutorial (cattura schermate
-- vere): "Lavori da confermare" (/lavori-da-confermare) mostra sempre "nessun
-- preventivo" per QUALUNQUE fornitore. Causa: la policy RLS che permetteva a
-- un fornitore di leggere le proprie righe di quote_items (qitems_select_
-- supplier) è stata rimossa il 08/08 di proposito (migration
-- 20260808730000_c2_drop_couple_qitems_policy... in realtà la riga incriminata
-- è nel batch 20260808210000_r2_security_hardening_batch.sql, decisione A1
-- dell'audit di sicurezza di rete): una policy RLS è per-riga, non per-colonna,
-- quindi esponeva ANCHE line_client/item_markup_percent/snapshot_price (il
-- margine del capostipite) a chiunque interrogasse la tabella direttamente via
-- API, anche se il frontend chiedeva solo colonne innocue. Rimuoverla era la
-- scelta giusta — ma nessuno ha mai spostato questa pagina dietro una RPC
-- SECURITY DEFINER "cieca sulle colonne sensibili" come già fatto per la
-- coppia (couple_get_quote_detail). Risultato: pagina rotta per tutti da un
-- mese, in produzione.
-- ============================================================================

create or replace function public.supplier_pending_items()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name_snapshot', qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'quantity', qi.quantity,
           'line_cost', qi.line_cost,
           'quote_id', qi.quote_id,
           'supplier_presence', qi.supplier_presence,
           'supplier_confirmed_at', qi.supplier_confirmed_at,
           'entry_title', coalesce(ce.title, q.title),
           'event_date', coalesce(ce.date_from, q.event_date),
           'client_name', coalesce(cep.client_name, q.client_name)
         ) order by coalesce(ce.date_from, q.event_date) nulls last), '[]'::jsonb)
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
    left join public.calendar_entries ce on ce.quote_id = q.id
    left join public.calendar_entries_private cep on cep.entry_id = ce.id
   where qi.supplier_id = auth.uid()
     and q.owner_id <> auth.uid()
     and q.status = 'INVIATO'
     and q.archived_at is null;
$$;

revoke all on function public.supplier_pending_items() from public;
grant execute on function public.supplier_pending_items() to authenticated;

comment on function public.supplier_pending_items() is
  'Sostituisce la lettura diretta di quote_items per "Lavori da confermare": stesso filtro (status INVIATO, non archiviato, non è il proprio preventivo), ma non espone mai line_client/markup/snapshot_price come farebbe una policy RLS per-riga.';
