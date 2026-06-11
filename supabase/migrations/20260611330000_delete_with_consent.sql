-- Cancellazione TOTALE evento con cerimonia di conferma + registro legale.
-- L'utente deve digitare "VOGLIO CANCELLARE" e accettare due dichiarazioni; restano
-- a noi di Planfully (deletion_log) per tutela legale.
create table if not exists public.deletion_log (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid,            -- niente FK: deve sopravvivere alla cancellazione dell'evento
  entry_title text,
  deleted_by uuid,
  typed_phrase text,
  consent_lose_all boolean,
  consent_no_backup boolean,
  created_at timestamptz not null default now()
);
alter table public.deletion_log enable row level security;
drop policy if exists dl_admin_read on public.deletion_log;
create policy dl_admin_read on public.deletion_log for select using (public.is_admin());
-- nessun insert/update/delete dai client: solo via la RPC security-definer

create or replace function public.delete_event_with_consent(p_entry uuid, p_phrase text, p_lose_all boolean, p_no_backup boolean)
returns table(bucket text, path text) language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select owner_id, coalesce(nullif(title, ''), 'evento') into v_owner, v_title from public.calendar_entries where id = p_entry;
  if v_owner is null then raise exception 'entry_not_found'; end if;
  if v_owner <> auth.uid() and not coalesce(public.is_admin(), false) then raise exception 'forbidden'; end if;
  if upper(btrim(coalesce(p_phrase, ''))) <> 'VOGLIO CANCELLARE' then raise exception 'phrase_mismatch'; end if;
  if not (coalesce(p_lose_all, false) and coalesce(p_no_backup, false)) then raise exception 'consent_required'; end if;

  insert into public.deletion_log(entry_id, entry_title, deleted_by, typed_phrase, consent_lose_all, consent_no_backup)
    values (p_entry, v_title, auth.uid(), p_phrase, p_lose_all, p_no_backup);

  return query select * from public.delete_wedding_cascade(p_entry);
end$$;
grant execute on function public.delete_event_with_consent(uuid, text, boolean, boolean) to authenticated;
