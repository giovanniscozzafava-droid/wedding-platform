-- NOTIFICA AL REFERRER quando il fornitore SUGGERITO invia un preventivo al cliente segnalato.
-- Es.: Giovanni suggerisce Alfredo (riga supplier_referrals: referrer=Giovanni, suggested=Alfredo,
-- client_email=X). Quando Alfredo (owner del preventivo) porta a INVIATO un preventivo per il cliente
-- X, avvisiamo Giovanni. Una sola volta per segnalazione (flag referrer_notified_quote_at).
alter table public.supplier_referrals
  add column if not exists referrer_notified_quote_at timestamptz;

create or replace function public._notify_referrer_on_suggested_quote()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_supplier text; v_client text;
begin
  if new.status <> 'INVIATO' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'INVIATO' then return new; end if; -- già inviato: non ripetere
  if new.client_email is null then return new; end if;

  select coalesce(nullif(business_name, ''), full_name) into v_supplier from public.profiles where id = new.owner_id;
  v_client := coalesce(nullif(new.client_name, ''), new.client_email);

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

drop trigger if exists trg_notify_referrer_on_suggested_quote on public.quotes;
create trigger trg_notify_referrer_on_suggested_quote
  after insert or update of status on public.quotes
  for each row execute function public._notify_referrer_on_suggested_quote();
