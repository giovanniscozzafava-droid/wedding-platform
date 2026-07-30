-- Il cliente puo' SCEGLIERE LA QUANTITA' di una voce (es. 2 album). Vale per le voci a unita'
-- fissa (non "per invitato"/"per tavolo", che dipendono dal numero ospiti). Ricalcola line_client
-- (e line_cost) dal prezzo unitario; il trigger sui quote_items aggiorna il totale del preventivo.
create or replace function public.couple_set_item_quantity(p_item_id uuid, p_qty int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); it public.quote_items%rowtype; v_key text; v_unit numeric; v_unit_cost numeric;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into it from public.quote_items where id = p_item_id;
  if it.id is null then return jsonb_build_object('error','not_found'); end if;
  if it.contracted_at is not null then return jsonb_build_object('error','contracted'); end if;
  if coalesce(it.quantity_basis,'') in ('PER_GUEST','PER_TABLE') then return jsonb_build_object('error','not_selectable'); end if;
  v_key := public.quote_event_key(it.quote_id);
  if not public.is_admin() and not exists (
    select 1 from public.wedding_couple_members m
    join public.calendar_entries ce on ce.id = m.entry_id
    where m.user_id = v_uid and (ce.quote_id = it.quote_id or (v_key is not null and public.quote_event_key(ce.quote_id) = v_key))
  ) then return jsonb_build_object('error','forbidden'); end if;

  p_qty := greatest(1, least(99, coalesce(p_qty, 1)));
  -- prezzo unitario: snapshot_price se valorizzato, altrimenti dedotto dalla riga corrente.
  v_unit := coalesce(nullif(it.snapshot_price, 0), case when it.quantity > 0 then it.line_client / it.quantity else it.line_client end);
  v_unit_cost := case when it.quantity > 0 then it.line_cost / it.quantity else it.line_cost end;
  update public.quote_items
     set quantity = p_qty,
         line_client = round(coalesce(v_unit, 0) * p_qty, 2),
         line_cost   = round(coalesce(v_unit_cost, 0) * p_qty, 2)
   where id = p_item_id;
  return jsonb_build_object('ok', true, 'quantity', p_qty, 'line_client', round(coalesce(v_unit,0) * p_qty, 2));
end$$;
revoke all on function public.couple_set_item_quantity(uuid, int) from anon, public;
grant execute on function public.couple_set_item_quantity(uuid, int) to authenticated;
