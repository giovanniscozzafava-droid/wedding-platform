-- ============================================================================
-- Dedup notifiche lato cliente.
-- Prima: un utente che è SIA membro della coppia SIA match su client_email
-- riceveva 2 notifiche identiche (una con link /couple, una con /area-cliente).
-- Ora: raccogliamo gli user_id distinti in un'unica passata; se l'utente è
-- membro della coppia il link è /couple (la sua home), altrimenti /area-cliente.
-- ============================================================================

create or replace function public.notify_quote_client(p_quote_id uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  v_email text;
  r record;
begin
  select id into v_entry from public.calendar_entries where quote_id = p_quote_id limit 1;
  select lower(client_email) into v_email from public.quotes where id = p_quote_id;

  for r in
    -- user_id distinti dal lato cliente: membri della coppia + chi ha lo stesso
    -- client_email. UNION deduplica chi rientra in entrambi.
    select user_id as uid
      from public.wedding_couple_members
      where v_entry is not null and entry_id = v_entry
    union
    select p.id as uid
      from public.profiles p
      join auth.users u on u.id = p.id
      where v_email is not null and v_email <> '' and lower(u.email) = v_email
  loop
    -- se l'utente è anche membro coppia, manda alla sua home /couple
    perform public.push_user_notification(
      r.uid, p_type, p_title, p_body,
      case when exists (
        select 1 from public.wedding_couple_members
        where v_entry is not null and entry_id = v_entry and user_id = r.uid
      ) then '/couple' else '/area-cliente' end,
      p_quote_id
    );
  end loop;
end$$;
