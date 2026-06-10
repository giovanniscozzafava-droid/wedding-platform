-- ============================================================================
-- Contatto CERTIFICATO cliente↔fornitore (prova dello scambio tra fornitori).
-- Quando un cliente, arrivato da un SUGGERIMENTO (referrer A → suggested B),
-- contatta B dal suo profilo pubblico, marchiamo la riga supplier_referrals come
-- contatto AVVENUTO e CERTIFICATO (data/ora, IP, user-agent, id del lead, codice
-- ricevuta). È la prova immutabile che fonda il credito di A quando B converte.
-- Il credito vero resta gated dal flag referral_accounting_enabled (cluster 4).
-- ============================================================================
alter table public.supplier_referrals
  add column if not exists contacted_at        timestamptz,
  add column if not exists contact_ip          text,
  add column if not exists contact_user_agent  text,
  add column if not exists contact_lead_id     uuid,
  add column if not exists contact_ref         text;

-- Certifica il contatto. Anti-falsificazione: il sid (p_ref_id) deve riferirsi
-- ESATTAMENTE al fornitore (suggested) del profilo contattato; il referrer è
-- letto dal record server-side, MAI dall'URL.
create or replace function public.certify_referral_contact(
  p_ref_id uuid, p_suggested_slug text, p_lead_id uuid, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_sug uuid; v_ref public.supplier_referrals%rowtype; v_code text;
begin
  if p_ref_id is null then return jsonb_build_object('ok', false, 'reason', 'no_ref'); end if;
  select id into v_sug from public.profiles where slug = p_suggested_slug limit 1;
  select * into v_ref from public.supplier_referrals where id = p_ref_id;
  if v_ref.id is null then return jsonb_build_object('ok', false, 'reason', 'ref_not_found'); end if;
  if v_sug is null or v_ref.suggested_id <> v_sug then
    return jsonb_build_object('ok', false, 'reason', 'ref_mismatch');   -- sid non riferito a questo fornitore
  end if;
  if v_ref.contacted_at is not null then
    return jsonb_build_object('ok', true, 'receipt', v_ref.contact_ref, 'already', true);
  end if;
  v_code := 'CNT-' || upper(substr(replace(p_ref_id::text, '-', ''), 1, 10));
  update public.supplier_referrals
     set contacted_at = now(), contact_ip = p_ip, contact_user_agent = p_ua,
         contact_lead_id = p_lead_id, contact_ref = v_code
   where id = p_ref_id;
  -- notifica il fornitore: contatto certificato in arrivo da una segnalazione
  perform public.push_user_notification(v_ref.suggested_id, 'CONTACT_CERTIFIED',
    'Contatto certificato da una segnalazione',
    'Un cliente segnalato da un collega ti ha contattato dal tuo profilo (rif. ' || v_code || ').',
    '/richieste', p_ref_id);
  return jsonb_build_object('ok', true, 'receipt', v_code, 'referrer', v_ref.referrer_id, 'certified', true);
end$function$;

revoke execute on function public.certify_referral_contact(uuid, text, uuid, text, text) from anon, authenticated;
grant  execute on function public.certify_referral_contact(uuid, text, uuid, text, text) to service_role;
