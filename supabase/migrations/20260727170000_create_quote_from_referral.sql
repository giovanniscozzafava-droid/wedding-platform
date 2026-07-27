-- ════════════════════════════════════════════════════════════════════════════
-- Canale A (supplier_referrals): il fornitore SUGGERITO crea il preventivo partendo
-- dalla segnalazione. A differenza del canale "modale" (supplier_suggestions, cieco),
-- qui i contatti del cliente sono già visibili al fornitore (client_email è inline sulla
-- riga e leggibile via RLS): quindi il preventivo è NORMALE, non mascherato.
--
-- Idempotente: se il referral ha già un quote_id lo riapre (niente doppioni). Imposta
-- supplier_referrals.quote_id per collegare la segnalazione al preventivo generato.
-- Speculare a create_quote_from_suggestion, ma senza quote_origin='SUPPLIER_SUGGESTION'
-- (così l'editor mostra l'invio normale e non il flusso cieco).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.create_quote_from_referral(p_referral_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.supplier_referrals%rowtype;
  v_quote uuid;
  v_title text;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into r from public.supplier_referrals where id = p_referral_id;
  if r.id is null then return jsonb_build_object('error','not_found'); end if;
  if r.suggested_id <> v_uid and not public.is_admin() then
    return jsonb_build_object('error','not_owner');
  end if;
  if r.quote_id is not null then
    return jsonb_build_object('ok', true, 'quote_id', r.quote_id, 'reused', true);
  end if;

  v_title := 'Preventivo — ' || coalesce(nullif(r.client_name, ''), 'cliente segnalato');
  insert into public.quotes (owner_id, title, client_name, client_email, event_kind)
  values (v_uid, v_title, r.client_name, r.client_email, coalesce(r.event_kind, 'matrimonio'))
  returning id into v_quote;

  update public.supplier_referrals set quote_id = v_quote where id = p_referral_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'reused', false);
end$$;

revoke all on function public.create_quote_from_referral(uuid) from public, anon;
grant execute on function public.create_quote_from_referral(uuid) to authenticated;
