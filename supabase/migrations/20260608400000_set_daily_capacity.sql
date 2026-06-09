-- ============================================================================
-- Il professionista imposta quanti eventi può gestire in un giorno (capienza).
-- Alimenta la disponibilità: oltre la capienza, la data risulta non disponibile
-- (public_check_availability, suggest_alternatives_full usano daily_capacity).
-- ============================================================================
create or replace function public.set_daily_capacity(p_value int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_val int;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  v_val := greatest(1, least(50, coalesce(p_value, 1)));
  update public.profiles set daily_capacity = v_val where id = v_uid;
  -- Ricalcola la disponibilità dei prossimi giorni con eventi, se la funzione esiste.
  begin
    perform public.recompute_day_availability(v_uid, d::date)
      from generate_series(current_date, current_date + interval '120 days', interval '1 day') g(d)
     where exists (select 1 from public.supplier_appointments a where a.owner_id = v_uid and a.date = d::date);
  exception when undefined_function then null; end;
  return jsonb_build_object('ok', true, 'daily_capacity', v_val);
end$$;
grant execute on function public.set_daily_capacity(int) to authenticated;
