-- La prima nota non vedeva gli incassi delle rate contratto.
--
-- `prima_nota_sync` leggeva le ENTRATE solo da `quote_items.paid_amount`: era
-- il modello vecchio, quando i pagamenti stavano sulle voci del preventivo. Da
-- quando le rate nascono dal contratto (`contract_payments`, Art. 2.2), un
-- acconto incassato non finiva mai in prima nota. Verificato sullo scenario
-- Baronella dell'08/09/2026: rata da 4.590 € segnata pagata → righe ENTRATA
-- 14 → 14.
--
-- Ora le rate pagate entrano come sorgente `CONTRACT_PAYMENT`, con la stessa
-- chiave idempotente (owner, source, source_ref_id) delle altre righe
-- automatiche: ri-sincronizzare aggiorna, non duplica. Le righe QUOTE_ITEM
-- restano per i preventivi vecchi.
create or replace function public.prima_nota_sync()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count int := 0;
  v_tmp   int := 0;
begin
  if v_owner is null then return 0; end if;

  -- ENTRATE (modello vecchio): pagamenti registrati sulle voci di preventivo
  insert into public.prima_nota_entries
    (owner_id, entry_date, direction, amount, description, category, method, source, source_ref_id)
  select q.owner_id,
         coalesce(qi.paid_at::date, current_date),
         'ENTRATA',
         qi.paid_amount,
         coalesce(nullif(q.client_name, ''), 'Cliente') || ' — ' || qi.name_snapshot,
         'Incasso preventivo',
         case upper(coalesce(qi.payment_method, ''))
           when 'CONTANTI' then 'CONTANTI'
           when 'BONIFICO' then 'BONIFICO'
           when 'POS'      then 'POS'
           when 'ASSEGNO'  then 'ASSEGNO'
           else null end,
         'QUOTE_ITEM',
         qi.id
  from public.quote_items qi
  join public.quotes q on q.id = qi.quote_id
  where q.owner_id = v_owner and qi.paid_amount > 0
  on conflict (owner_id, source, source_ref_id) where source <> 'MANUAL'
  do update set amount      = excluded.amount,
                entry_date  = excluded.entry_date,
                description = excluded.description,
                method      = excluded.method,
                updated_at  = now();
  get diagnostics v_count = row_count;

  -- ENTRATE (modello attuale): rate del contratto incassate
  insert into public.prima_nota_entries
    (owner_id, entry_date, direction, amount, description, category, method, event_id, source, source_ref_id)
  select cp.owner_id,
         coalesce(cp.paid_at::date, current_date),
         'ENTRATA',
         coalesce(nullif(cp.paid_amount, 0), cp.amount),
         coalesce(nullif(c.client_name, ''), 'Cliente') || ' — ' || cp.label
           || case when c.title is not null then ' (' || c.title || ')' else '' end,
         'Incasso contratto',
         case upper(coalesce(cp.method, ''))
           when 'CONTANTI' then 'CONTANTI'
           when 'BONIFICO' then 'BONIFICO'
           when 'POS'      then 'POS'
           when 'ASSEGNO'  then 'ASSEGNO'
           else null end,
         c.entry_id,
         'CONTRACT_PAYMENT',
         cp.id
  from public.contract_payments cp
  join public.contracts c on c.id = cp.contract_id
  where cp.owner_id = v_owner
    and cp.paid
    and coalesce(nullif(cp.paid_amount, 0), cp.amount) > 0
  on conflict (owner_id, source, source_ref_id) where source <> 'MANUAL'
  do update set amount      = excluded.amount,
                entry_date  = excluded.entry_date,
                description = excluded.description,
                method      = excluded.method,
                event_id    = excluded.event_id,
                updated_at  = now();
  get diagnostics v_tmp = row_count;
  v_count := v_count + v_tmp;

  -- USCITE: ordini materie prime ricevuti dal gestionale F&B
  insert into public.prima_nota_entries
    (owner_id, entry_date, direction, amount, description, category, source, source_ref_id)
  select po.location_id,
         coalesce(po.expected_date, po.created_at::date),
         'USCITA',
         po.total_cost,
         'Ordine materie prime — ' || coalesce(s.name, 'fornitore'),
         'Acquisti F&B',
         'FB_PO',
         po.id
  from public.fb_purchase_orders po
  left join public.fb_suppliers s on s.id = po.supplier_id
  where po.location_id = v_owner
    and po.status in ('RICEVUTO', 'RICEVUTO_PARZIALE')
    and po.total_cost > 0
  on conflict (owner_id, source, source_ref_id) where source <> 'MANUAL'
  do update set amount      = excluded.amount,
                entry_date  = excluded.entry_date,
                description = excluded.description,
                updated_at  = now();

  return v_count;
end $$;

grant execute on function public.prima_nota_sync() to authenticated;
