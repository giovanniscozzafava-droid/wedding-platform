-- Chiudi il cerchio delle richieste di modifica coppia↔WP:
--  (1) all'arrivo di una richiesta, avvisa il WP (owner dell'evento);
--  (2) quando il WP la esamina (APPROVED/REJECTED/APPLIED), avvisa la coppia che l'ha inviata.
-- Prima la coppia inviava e non sapeva più nulla (nessun ritorno).

create or replace function public._notify_ccr_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = new.wedding_id limit 1;
  if v_owner is not null and v_owner <> new.requested_by then
    perform public.push_user_notification(v_owner, 'change_request',
      'Nuova richiesta di modifica',
      coalesce(new.title, 'La coppia ha chiesto una modifica'),
      '/weddings/' || new.wedding_id, new.wedding_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_ccr_insert on public.couple_change_requests;
create trigger trg_notify_ccr_insert after insert on public.couple_change_requests
  for each row execute function public._notify_ccr_insert();

create or replace function public._notify_ccr_reviewed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_msg text;
begin
  if new.status = old.status or new.status not in ('APPROVED','REJECTED','APPLIED') then return new; end if;
  v_msg := case new.status
             when 'APPROVED' then 'approvata'
             when 'REJECTED' then 'non accolta'
             else 'applicata' end;
  if new.requested_by is not null and new.requested_by <> coalesce(new.reviewed_by, auth.uid()) then
    perform public.push_user_notification(new.requested_by, 'change_request_reviewed',
      'Richiesta ' || v_msg,
      coalesce(new.title, 'La tua richiesta') || ' è stata ' || v_msg ||
        coalesce(' · ' || nullif(new.review_note, ''), '') || '.',
      '/couple', new.wedding_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_ccr_reviewed on public.couple_change_requests;
create trigger trg_notify_ccr_reviewed after update of status on public.couple_change_requests
  for each row execute function public._notify_ccr_reviewed();
