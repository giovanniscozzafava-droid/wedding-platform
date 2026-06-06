-- ============================================================================
-- FASE 0 — IL SISTEMA NERVOSO (notifiche) + COUNTER-OFFER del fornitore.
--  • Cliente avvisato quando il capostipite aggiunge una voce live.
--  • Fornitore + WP avvisati quando il cliente rifiuta / mette in forse una voce.
--  • Il fornitore può proporre uno sconto sulla sua voce → torna al cliente.
-- ----------------------------------------------------------------------------

alter table public.quote_items
  add column if not exists supplier_counter_note text,
  add column if not exists supplier_counter_at   timestamptz;

-- Helper: notifica "il lato cliente" di un preventivo (coppia + cliente diretto).
create or replace function public.notify_quote_client(p_quote_id uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_email text; r record;
begin
  select id into v_entry from public.calendar_entries where quote_id = p_quote_id limit 1;
  select lower(client_email) into v_email from public.quotes where id = p_quote_id;
  if v_entry is not null then
    for r in select user_id from public.wedding_couple_members where entry_id = v_entry loop
      perform public.push_user_notification(r.user_id, p_type, p_title, p_body, '/couple', p_quote_id);
    end loop;
  end if;
  if v_email is not null and v_email <> '' then
    for r in select p.id from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = v_email loop
      perform public.push_user_notification(r.id, p_type, p_title, p_body, '/area-cliente', p_quote_id);
    end loop;
  end if;
end$$;

-- Trigger 1: nuova voce LIVE (su preventivo già accettato) → avvisa il cliente.
create or replace function public.notify_client_new_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.quotes where id = new.quote_id;
  if v_status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
    perform public.notify_quote_client(new.quote_id, 'QUOTE_NEW_ITEM',
      'Nuova proposta dal tuo organizzatore',
      'È stata aggiunta "' || new.name_snapshot || '" al tuo preventivo. Aprila per approvarla, metterla in forse o non accettarla.');
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_client_new_item on public.quote_items;
create trigger trg_notify_client_new_item after insert on public.quote_items
  for each row execute function public.notify_client_new_item();

-- Trigger 2: il cliente rifiuta / mette in forse una voce → avvisa WP + fornitore.
create or replace function public.notify_on_client_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if new.client_decision is distinct from old.client_decision
     and new.client_decision in ('RIFIUTATO','FORSE') then
    select owner_id into v_owner from public.quotes where id = new.quote_id;
    perform public.push_user_notification(v_owner, 'CLIENT_DECISION',
      case new.client_decision when 'RIFIUTATO' then 'Voce rifiutata dal cliente' else 'Voce messa in forse dal cliente' end,
      'Il cliente ' || (case new.client_decision when 'RIFIUTATO' then 'ha rifiutato' else 'è incerto su' end)
        || ' "' || new.name_snapshot || '"' || coalesce(' · Motivo: ' || new.client_decline_reason, ''),
      '/quotes/' || new.quote_id::text, new.quote_id);
    if new.supplier_id is not null and new.supplier_id is distinct from v_owner then
      perform public.push_user_notification(new.supplier_id, 'SUPPLIER_ITEM_REJECTED',
        'Una tua voce non è stata approvata',
        'Il cliente ' || (case new.client_decision when 'RIFIUTATO' then 'ha rifiutato' else 'è incerto su' end)
          || ' "' || new.name_snapshot || '". Puoi proporre uno sconto per recuperarla.',
        '/voci-da-rivedere', new.id);
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_client_decision on public.quote_items;
create trigger trg_notify_client_decision after update of client_decision on public.quote_items
  for each row execute function public.notify_on_client_decision();

-- Lista per il fornitore: le sue voci non approvate dal cliente, da rinegoziare.
create or replace function public.supplier_items_to_review()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', qi.id, 'name', qi.name_snapshot, 'quote_id', qi.quote_id,
    'quote_title', q.title, 'client_name', q.client_name, 'event_date', q.event_date,
    'line_client', qi.line_client, 'decision', qi.client_decision,
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

-- Il fornitore propone uno sconto sulla sua voce → ricalcolo prezzo + torna al cliente.
create or replace function public.supplier_propose_discount(
  p_item_id uuid, p_discount_percent numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sup uuid; v_quote uuid; v_name text; v_owner uuid; v_new numeric;
begin
  select supplier_id, quote_id, name_snapshot into v_sup, v_quote, v_name
    from public.quote_items where id = p_item_id;
  if v_sup is null then return jsonb_build_object('error','not_found'); end if;
  if v_sup is distinct from auth.uid() then return jsonb_build_object('error','forbidden'); end if;
  if p_discount_percent is null or p_discount_percent < 0 or p_discount_percent > 90 then
    return jsonb_build_object('error','bad_discount');
  end if;

  update public.quote_items
     set item_discount_percent = p_discount_percent,   -- il trigger ricalcola line_client
         client_decision = 'IN_ATTESA',
         client_decline_reason = null,
         supplier_counter_note = nullif(trim(coalesce(p_note,'')), ''),
         supplier_counter_at = now()
   where id = p_item_id
   returning line_client into v_new;

  select owner_id into v_owner from public.quotes where id = v_quote;
  perform public.push_user_notification(v_owner, 'SUPPLIER_COUNTER',
    'Offerta scontata da un fornitore',
    'Sconto ' || p_discount_percent || '% su "' || v_name || '"' || coalesce(' · ' || p_note, '')
      || ' · nuovo prezzo € ' || public.fmt_eur_it(v_new),
    '/quotes/' || v_quote::text, v_quote);
  perform public.notify_quote_client(v_quote, 'QUOTE_NEW_ITEM',
    'Offerta aggiornata con sconto',
    '"' || v_name || '" è stata riproposta con uno sconto del ' || p_discount_percent || '% (ora € '
      || public.fmt_eur_it(v_new) || '). Aprila per decidere.');

  return jsonb_build_object('ok', true, 'new_line_client', v_new);
end$$;
revoke all on function public.supplier_propose_discount(uuid, numeric, text) from public;
grant execute on function public.supplier_propose_discount(uuid, numeric, text) to authenticated;
