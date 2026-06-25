-- SISTEMA PRENOTAZIONI (tipo Calendly): il professionista pubblica disponibilità settimanali;
-- chi visita /prenota/<slug> sceglie uno slot libero e prenota. Si integra col calendario
-- segnando lo slot come BUSY in supplier_availability_slots. Tutto in fuso orario del pro.

-- config per professionista (slug = profiles.slug, già pubblico)
create table if not exists public.booking_settings (
  professional_id uuid primary key references public.profiles(id) on delete cascade,
  enabled         boolean not null default true,
  title           text not null default 'Prenota un appuntamento',
  description     text,
  slot_minutes    int not null default 30 check (slot_minutes between 5 and 480),
  buffer_minutes  int not null default 0 check (buffer_minutes between 0 and 240),
  advance_days    int not null default 30 check (advance_days between 1 and 365),
  min_notice_hours int not null default 12 check (min_notice_hours between 0 and 720),
  timezone        text not null default 'Europe/Rome',
  -- disponibilità settimanale: { "0".."6" (0=dom) : [ ["09:00","13:00"], ["14:00","18:00"] ] }
  weekly          jsonb not null default '{"1":[["09:00","13:00"],["14:00","18:00"]],"2":[["09:00","13:00"],["14:00","18:00"]],"3":[["09:00","13:00"],["14:00","18:00"]],"4":[["09:00","13:00"],["14:00","18:00"]],"5":[["09:00","13:00"],["14:00","18:00"]]}'::jsonb,
  location_type   text not null default 'CALL' check (location_type in ('CALL','VIDEO','INPERSON')),
  location_detail text,
  whatsapp        text,
  color           text not null default '#C9A227',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.booking_settings enable row level security;
drop policy if exists bset_own on public.booking_settings;
create policy bset_own on public.booking_settings for all using (professional_id = auth.uid() or public.is_admin()) with check (professional_id = auth.uid() or public.is_admin());

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  client_name     text not null,
  client_email    text not null,
  client_phone    text,
  note            text,
  status          text not null default 'CONFIRMED' check (status in ('CONFIRMED','CANCELLED')),
  avail_slot_id   uuid,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_bookings_pro_start on public.bookings(professional_id, starts_at);
alter table public.bookings enable row level security;
drop policy if exists bk_own on public.bookings;
create policy bk_own on public.bookings for select using (professional_id = auth.uid() or public.is_admin());
-- niente insert/update/delete pubblici diretti: passa dall'edge function (service role).

-- config pubblica per la pagina /prenota/<slug> (anon). NULL se disabilitata/inesistente.
create or replace function public.booking_public_config(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'professional_id', p.id,
    'name', coalesce(nullif(trim(p.business_name), ''), p.full_name),
    'title', s.title, 'description', s.description,
    'slot_minutes', s.slot_minutes, 'advance_days', s.advance_days,
    'min_notice_hours', s.min_notice_hours, 'timezone', s.timezone,
    'weekly', s.weekly, 'location_type', s.location_type, 'location_detail', s.location_detail,
    'color', s.color
  )
  from public.profiles p join public.booking_settings s on s.professional_id = p.id
  where p.slug = p_slug and s.enabled;
$$;
grant execute on function public.booking_public_config(text) to anon, authenticated;

-- slot liberi tra due date (anon). Genera gli slot dalla disponibilità settimanale e toglie
-- gli occupati: prenotazioni esistenti, slot BUSY di disponibilità, eventi confermati (giornata).
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
    v_dow := extract(dow from d)::int::text;             -- 0=dom..6=sab
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
            'iso', to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
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
