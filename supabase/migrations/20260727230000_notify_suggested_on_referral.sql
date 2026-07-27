-- I fornitori suggeriti via CANALE APERTO (supplier_referrals: "suggerisci colleghi" da preventivo
-- firmato + auto-suggerimenti "data occupata") NON ricevevano alcuna notifica in-app: solo il canale
-- cieco (edge fn suggest-my-suppliers) notificava. Qui aggiungiamo la notifica anche al canale aperto,
-- con il nudge "non perdere l'occasione, crea il preventivo partendo dal catalogo".
create or replace function public._notify_suggested_on_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  if new.status = 'CANCELLED' then return new; end if;
  select coalesce(nullif(business_name, ''), full_name) into v_ref from public.profiles where id = new.referrer_id;
  perform public.push_user_notification(
    new.suggested_id,
    'SUGGESTION_RECEIVED',
    'Sei stato suggerito',
    coalesce(v_ref, 'Un collega') || ' ti ha suggerito a un suo cliente per un '
      || coalesce(new.event_kind, 'evento')
      || '. Non perdere l''occasione: crea la tua offerta partendo dal catalogo.',
    '/suggerimenti-ricevuti',
    new.id);
  return new;
end$$;

drop trigger if exists trg_notify_suggested_on_referral on public.supplier_referrals;
create trigger trg_notify_suggested_on_referral
  after insert on public.supplier_referrals
  for each row execute function public._notify_suggested_on_referral();
