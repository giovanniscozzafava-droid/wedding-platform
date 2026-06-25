-- Fix: l'iso degli slot usava OF → '+00' (senza minuti), non parsabile da new Date() in JS.
-- Ora emettiamo ISO UTC con 'Z' (sempre valido). date/label (locali) restano per il display.
create or replace function public.booking_free_slots(p_slug text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.booking_settings%rowtype; v_pid uuid; v_tz text;
  d date; v_dow text; iv jsonb; t_start time; t_end time;
  slot_local timestamp; slot_end_local timestamp; ts timestamptz; te timestamptz;
  out jsonb := '[]'::jsonb; v_max date;
begin
  select pr.id into v_pid from public.profiles pr where pr.slug = p_slug;
  if v_pid is null then return jsonb_build_object('error','not_found'); end if;
  select * into s from public.booking_settings where professional_id = v_pid and enabled;
  if not found then return jsonb_build_object('error','disabled'); end if;
  v_tz := s.timezone;
  v_max := least(p_to, (now() at time zone v_tz)::date + s.advance_days);

  d := greatest(p_from, (now() at time zone v_tz)::date);
  while d <= v_max loop
    v_dow := extract(dow from d)::int::text;
    for iv in select * from jsonb_array_elements(coalesce(s.weekly -> v_dow, '[]'::jsonb)) loop
      t_start := (iv ->> 0)::time; t_end := (iv ->> 1)::time;
      slot_local := d + t_start;
      while (slot_local + (s.slot_minutes || ' minutes')::interval)::time <= t_end
            and (slot_local + (s.slot_minutes || ' minutes')::interval) <= (d + t_end) loop
        slot_end_local := slot_local + (s.slot_minutes || ' minutes')::interval;
        ts := slot_local at time zone v_tz;
        te := slot_end_local at time zone v_tz;
        if ts >= now() + (s.min_notice_hours || ' hours')::interval
           and not exists (select 1 from public.bookings b where b.professional_id = v_pid and b.status = 'CONFIRMED'
                           and tstzrange(b.starts_at, b.ends_at) && tstzrange(ts, te))
           and not exists (select 1 from public.supplier_availability_slots a where a.fornitore_id = v_pid and a.status = 'BUSY' and a.date = d
                           and tstzrange((d + coalesce(a.start_time,'00:00'::time)) at time zone v_tz,
                                         (d + coalesce(a.end_time,'23:59'::time)) at time zone v_tz) && tstzrange(ts, te))
           and not exists (select 1 from public.calendar_entries e where e.owner_id = v_pid
                           and e.status in ('CONFERMATA','OPZIONATA') and d between e.date_from and e.date_to)
        then
          out := out || jsonb_build_object(
            'iso', to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'date', to_char(slot_local, 'YYYY-MM-DD'),
            'label', to_char(slot_local, 'HH24:MI')
          );
        end if;
        slot_local := slot_local + ((s.slot_minutes + s.buffer_minutes) || ' minutes')::interval;
      end loop;
    end loop;
    d := d + 1;
  end loop;
  return out;
end$$;
grant execute on function public.booking_free_slots(text, date, date) to anon, authenticated;
