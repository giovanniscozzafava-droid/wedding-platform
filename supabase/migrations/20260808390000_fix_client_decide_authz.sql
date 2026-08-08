-- BUG (bloccante): la coppia NON può scegliere le voci dei preventivi SUGGERITI. client_decide_quote_item
-- autorizzava solo confrontando l'email del chiamante con quotes.client_email; ma i preventivi suggeriti
-- hanno client_email='' (blind: il fornitore non vede il cliente) → nessun match → "forbidden" →
-- "Non hai i permessi per questa azione su questo preventivo". Fix: autorizza ANCHE per appartenenza
-- alla coppia dell'evento (stessa chiave-evento), come couple_set_item_quantity/couple_get_quote_detail.
-- Resto invariato (guard stato + allineamento selected_by_client per le opzionali + totali).
create or replace function public.client_decide_quote_item(p_item_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_quote uuid; v_client_email text; v_closed timestamptz; v_qstatus quote_status; v_contracted timestamptz;
  v_accepted numeric; v_pending numeric; v_forse numeric;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA','FORSE') then
    return jsonb_build_object('error','bad_decision');
  end if;

  select qi.quote_id, lower(q.client_email), q.closed_at, q.status, qi.contracted_at
    into v_quote, v_client_email, v_closed, v_qstatus, v_contracted
    from public.quote_items qi join public.quotes q on q.id = qi.quote_id
   where qi.id = p_item_id;
  if v_quote is null then return jsonb_build_object('error','not_found'); end if;

  -- Autorizzazione: email del cliente che combacia OPPURE membro della coppia dell'evento
  -- (i suggeriti hanno client_email vuoto → serve il match per appartenenza/chiave-evento).
  if not public.is_admin()
     and (v_email = '' or v_client_email is distinct from v_email)
     and not exists (
       select 1 from public.wedding_couple_members m
       join public.calendar_entries ce on ce.id = m.entry_id
       where m.user_id = v_uid
         and (ce.quote_id = v_quote
              or public.quote_event_key(ce.quote_id) = public.quote_event_key(v_quote))
     )
  then return jsonb_build_object('error','forbidden'); end if;

  if v_closed is not null then return jsonb_build_object('error','closed'); end if;
  if v_contracted is not null or v_qstatus = 'CONVERTITO_IN_CONTRATTO'::quote_status then
    return jsonb_build_object('error','contracted');
  end if;

  update public.quote_items
     set client_decision = p_decision, client_decided_at = now(),
         client_decline_reason = case when p_decision = 'RIFIUTATO' then p_reason else null end,
         selected_by_client = case when coalesce(is_optional,false) then (p_decision = 'ACCETTATO') else selected_by_client end
   where id = p_item_id;

  select coalesce(sum(line_client) filter (where client_decision='ACCETTATO'),0),
         coalesce(sum(line_client) filter (where client_decision='IN_ATTESA'),0),
         coalesce(sum(line_client) filter (where client_decision='FORSE'),0)
    into v_accepted, v_pending, v_forse
    from public.quote_items where quote_id = v_quote;
  return jsonb_build_object('ok', true, 'accepted_total', v_accepted,
                            'pending_total', v_pending, 'forse_total', v_forse);
end$$;
grant execute on function public.client_decide_quote_item(uuid, text, text) to anon, authenticated;
