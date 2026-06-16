-- Il credito per segnalazione è 39€ (referral_credit del debitore, default 39), non 100.
create or replace function public._grant_referral_credit(p_entry uuid, p_supplier uuid, p_creditor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_kind text; v_label text; v_amt numeric;
begin
  if p_creditor is null or p_supplier is null or p_creditor = p_supplier then return; end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then return; end if;
  if exists (select 1 from public.supplier_credits
              where creditor_id = p_creditor and debtor_id = p_supplier and entry_id = p_entry
                and status <> 'CANCELLED') then return; end if;
  select event_kind, title into v_kind, v_label from public.calendar_entries where id = p_entry;
  select coalesce(referral_credit, 39) into v_amt from public.profiles where id = p_supplier;
  v_amt := coalesce(v_amt, 39);
  insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, entry_id, created_by, status)
  values (p_creditor, p_supplier, v_amt, 'Segnalazione al cerchio evento', v_kind, v_label, p_entry, p_creditor, 'PENDING');
  perform public.push_user_notification(p_supplier, 'CREDIT_NEW', 'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato su un evento: hai un credito da riconoscere di ' || v_amt::text || '€', '/crediti', null);
end$$;

-- Correggi i crediti da segnalazione già creati con l'importo sbagliato (100 → 39/referral_credit).
update public.supplier_credits sc
   set amount = coalesce((select referral_credit from public.profiles p where p.id = sc.debtor_id), 39)
 where sc.reason = 'Segnalazione al cerchio evento' and sc.status = 'PENDING';
