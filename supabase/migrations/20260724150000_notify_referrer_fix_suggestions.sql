-- FIX: la notifica al referrer deve coprire ENTRAMBI i canali di suggerimento:
--  1) "Suggerisci i miei fornitori" (modale) → tabella supplier_suggestions (+ client_email in
--     supplier_suggestions_private). È il caso Giovanni→Alfredo.
--  2) suggerimenti automatici (data occupata) → tabella supplier_referrals (client_email inline).
-- Il trigger su quotes (già creato) resta; qui riscriviamo solo la funzione.
create or replace function public._notify_referrer_on_suggested_quote()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_supplier text; v_client text;
begin
  if new.status <> 'INVIATO' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'INVIATO' then return new; end if;
  if new.client_email is null then return new; end if;

  select coalesce(nullif(business_name, ''), full_name) into v_supplier from public.profiles where id = new.owner_id;
  v_client := coalesce(nullif(new.client_name, ''), new.client_email);

  -- (1) supplier_suggestions (modale). client_email sta in _private, collegato da suggestion_id.
  for r in
    select ss.id, ss.referrer_id
      from public.supplier_suggestions ss
      join public.supplier_suggestions_private pv on pv.suggestion_id = ss.id
     where ss.supplier_id = new.owner_id
       and lower(pv.client_email) = lower(new.client_email)
       and ss.status in ('SENT', 'VIEWED', 'QUOTE_CREATED')
  loop
    perform public.push_user_notification(
      r.referrer_id, 'referral_quote_sent',
      coalesce(v_supplier, 'Un fornitore') || ' ha inviato un preventivo',
      'Il fornitore che hai suggerito ha creato e inviato un preventivo a ' || v_client || '.',
      '/rete', null);
    update public.supplier_suggestions set status = 'QUOTE_SENT', quote_id = new.id where id = r.id;
  end loop;

  -- (2) supplier_referrals (auto-suggerimenti). client_email inline.
  for r in
    select id, referrer_id from public.supplier_referrals
     where suggested_id = new.owner_id
       and lower(client_email) = lower(new.client_email)
       and status <> 'CANCELLED'
       and referrer_notified_quote_at is null
  loop
    perform public.push_user_notification(
      r.referrer_id, 'referral_quote_sent',
      coalesce(v_supplier, 'Un fornitore') || ' ha inviato un preventivo',
      'Il fornitore che hai suggerito ha creato e inviato un preventivo a ' || v_client || '.',
      '/rete', null);
    update public.supplier_referrals set referrer_notified_quote_at = now() where id = r.id;
  end loop;

  return new;
end$$;
