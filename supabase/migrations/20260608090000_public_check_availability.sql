-- ============================================================================
-- Check disponibilità PUBBLICO per il form di intake. Dato lo slug del
-- professionista (capostipite O fornitore) e una data, dice se ha capienza.
-- Capienza = profiles.daily_capacity (1 = mono-prenotazione come la band;
-- >1 = multi come il fioraio). Non disponibile se: blocco/vacanza, una riga
-- supplier_availability UNAVAILABLE manuale, oppure eventi/appuntamenti del
-- giorno >= capienza. Anon-callable (SECURITY DEFINER bypassa le RLS).
-- ============================================================================
create or replace function public.public_check_availability(p_slug text, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_cap   int;
  v_blocked boolean := false;
  v_manual_block boolean := false;
  v_events int := 0;
begin
  if p_date is null or p_slug is null then
    return jsonb_build_object('available', true, 'unknown', true);
  end if;

  select id, coalesce(daily_capacity, 999) into v_owner, v_cap
    from public.profiles where slug = p_slug limit 1;
  if v_owner is null then
    return jsonb_build_object('available', true, 'unknown', true);
  end if;

  -- Blocco/vacanza che copre la data
  select exists(
    select 1 from public.supplier_appointments
     where owner_id = v_owner and kind in ('BLOCCO','VACANZA')
       and p_date between date and coalesce(end_date, date)
  ) into v_blocked;

  -- Indisponibilità impostata manualmente sul giorno
  select exists(
    select 1 from public.supplier_availability
     where fornitore_id = v_owner and date = p_date and status = 'UNAVAILABLE'
  ) into v_manual_block;

  -- Eventi/appuntamenti che occupano capienza
  select count(*) into v_events from public.supplier_appointments
    where owner_id = v_owner and date = p_date and kind in ('EVENTO','APPUNTAMENTO');

  return jsonb_build_object(
    'available', (not v_blocked and not v_manual_block and v_events < v_cap),
    'capacity',  v_cap,
    'used',      v_events
  );
end$$;
grant execute on function public.public_check_availability(text, date) to anon, authenticated;
