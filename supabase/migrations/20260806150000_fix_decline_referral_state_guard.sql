-- H7 (integrità stato referral): supplier_decline_referral metteva status='CANCELLED' senza guardia
-- di stato → si poteva "declinare" anche una segnalazione gia' CONVERTED (contratto firmato col
-- cliente, credito emesso quando la contabilita' e' attiva), sporcando l'attribuzione. Ora il declino
-- e' consentito SOLO da 'SUGGESTED'; su CONVERTED/CANCELLED torna not_declinable.

create or replace function public.supplier_decline_referral(p_referral_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.supplier_referrals%rowtype;
begin
  select * into r from public.supplier_referrals where id = p_referral_id;
  if r.id is null then return jsonb_build_object('error','not_found'); end if;
  if r.suggested_id <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('error','not_owner');
  end if;
  update public.supplier_referrals set status = 'CANCELLED'
   where id = p_referral_id and status = 'SUGGESTED';
  if not found then
    return jsonb_build_object('error','not_declinable');  -- gia' CONVERTED o CANCELLED
  end if;
  return jsonb_build_object('ok', true);
end$$;
