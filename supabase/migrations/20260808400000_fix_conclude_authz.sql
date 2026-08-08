-- Stesso bug di client_decide su quote_conclude_by_client: autorizzava solo per match email cliente
-- → sui preventivi SUGGERITI (client_email='') la coppia non poteva concludere/firmare. Fix: autorizza
-- anche per appartenenza alla coppia dell'evento (chiave-evento, che risolve l'email reale dei suggeriti).
create or replace function public.quote_conclude_by_client(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_owner_email text; v_status quote_status; v_add jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select lower(client_email), status into v_owner_email, v_status from public.quotes where id = p_quote_id;
  if v_status is null then return jsonb_build_object('error','not_found'); end if;
  if not public.is_admin()
     and (v_email = '' or v_owner_email is distinct from v_email)
     and not exists (
       select 1 from public.wedding_couple_members m
       join public.calendar_entries ce on ce.id = m.entry_id
       where m.user_id = v_uid
         and (ce.quote_id = p_quote_id
              or public.quote_event_key(ce.quote_id) = public.quote_event_key(p_quote_id))
     )
  then return jsonb_build_object('error','forbidden'); end if;
  if v_status not in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    return jsonb_build_object('error','not_accepted');
  end if;

  update public.quotes set closed_at = coalesce(closed_at, now()) where id = p_quote_id;
  v_add := public._addendum_build(p_quote_id);
  return jsonb_build_object('ok', true, 'closed', true, 'addendum', v_add);
end$$;
grant execute on function public.quote_conclude_by_client(uuid) to authenticated;
