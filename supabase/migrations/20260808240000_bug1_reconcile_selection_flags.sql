-- ============================================================================
-- BUG1 (CRITICO): due meccanismi di "scelta" mai riconciliati.
--  • L'inclusione della riga nel totale usa selected_by_client (opzioni/alternative).
--  • total_client_selected / atto / contratto / acconto Stripe usano client_decision
--    ='ACCETTATO'.
--  • quote_toggle_option e quote_pick_alternative scrivevano SOLO selected_by_client;
--    client_decide_quote_item scriveva SOLO client_decision. Nessuno li allineava.
-- Effetti: la coppia sceglie un'opzione/alternativa (selected_by_client) ma
-- total_client_selected resta 0 → acconto sul preventivo PIENO e atto VUOTO; oppure
-- accetta un'opzionale (client_decision) senza selezionarla → contribuisce €0.
-- Fix: teniamo allineate le due bandiere in tutti e tre i punti di scrittura.
-- ============================================================================

-- 1) Toggle opzione: scegliere = selezionata + accettata; togliere = deselezionata + in attesa.
create or replace function public.quote_toggle_option(p_token uuid, p_item_id uuid, p_selected boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select qi.id into v_id
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and q.token_revoked_at is null
     and is_token_valid(q.access_token_expires_at)
     and qi.id = p_item_id
     and qi.is_optional = true;
  if v_id is null then return false; end if;

  update quote_items
     set selected_by_client = p_selected,
         client_selected_at = case when p_selected then now() else null end,
         -- BUG1: allinea la decisione cliente (opzione scelta = accettata).
         client_decision = case when p_selected then 'ACCETTATO' else 'IN_ATTESA' end,
         client_decided_at = now()
   where id = v_id;

  insert into quote_views (quote_id, event_type, payload)
  select q.id, 'OPTIONAL_TOGGLE', jsonb_build_object('item_id', p_item_id, 'selected', p_selected)
  from quotes q where q.access_token = p_token;
  return true;
end$$;

-- 2) Scelta alternativa: la scelta = selezionata + accettata; le altre del gruppo = deselezionate + in attesa.
create or replace function public.quote_pick_alternative(p_token uuid, p_item_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_qid uuid; v_group text;
begin
  select qi.quote_id, qi.alternative_group into v_qid, v_group
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and q.token_revoked_at is null
     and public.is_token_valid(q.access_token_expires_at)
     and qi.id = p_item_id
     and qi.alternative_group is not null;
  if v_qid is null then return false; end if;

  update public.quote_items
     set selected_by_client = false, client_decision = 'IN_ATTESA', client_decided_at = now()
   where quote_id = v_qid and alternative_group = v_group;
  update public.quote_items
     set selected_by_client = true, client_selected_at = now(),
         client_decision = 'ACCETTATO', client_decided_at = now()
   where id = p_item_id;

  insert into public.quote_views (quote_id, event_type, payload)
  values (v_qid, 'ALTERNATIVE_PICK', jsonb_build_object('item_id', p_item_id, 'group', v_group));
  return true;
end$$;

-- 3) Decisione per-voce: per le OPZIONALI allinea selected_by_client (accettata = inclusa).
create or replace function public.client_decide_quote_item(p_item_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_quote uuid; v_owner text; v_closed timestamptz; v_qstatus quote_status; v_contracted timestamptz;
  v_accepted numeric; v_pending numeric; v_forse numeric;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA','FORSE') then
    return jsonb_build_object('error','bad_decision');
  end if;

  select qi.quote_id, lower(q.client_email), q.closed_at, q.status, qi.contracted_at
    into v_quote, v_owner, v_closed, v_qstatus, v_contracted
    from public.quote_items qi join public.quotes q on q.id = qi.quote_id
   where qi.id = p_item_id;
  if v_quote is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;
  if v_closed is not null then return jsonb_build_object('error','closed'); end if;
  if v_contracted is not null or v_qstatus = 'CONVERTITO_IN_CONTRATTO'::quote_status then
    return jsonb_build_object('error','contracted');
  end if;

  update public.quote_items
     set client_decision = p_decision, client_decided_at = now(),
         client_decline_reason = case when p_decision = 'RIFIUTATO' then p_reason else null end,
         -- BUG1: per le voci OPZIONALI, accettata = inclusa/prezzata; altrimenti esclusa.
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

-- Le pagine pubbliche (token, senza login) le chiamano da anon: preserva i grant.
grant execute on function public.quote_toggle_option(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.quote_pick_alternative(uuid, uuid) to anon, authenticated;
grant execute on function public.client_decide_quote_item(uuid, text, text) to anon, authenticated;
