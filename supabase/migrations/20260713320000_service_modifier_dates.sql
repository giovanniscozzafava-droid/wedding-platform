-- SUPPLEMENTI PER-SERVIZIO CON DATE: un modifier del servizio può valere solo in un periodo.
-- Se la data dell'evento cade nel periodo, il supplemento entra nel preventivo (auto-applicato).
-- date_from NULL = sempre (comportamento attuale). date_to NULL = giorno singolo (= date_from).
alter table public.service_modifiers
  add column if not exists date_from date,
  add column if not exists date_to   date;
comment on column public.service_modifiers.date_from is
  'Se valorizzata, il modifier si applica solo se la data evento e'' nel periodo [date_from, date_to]. NULL = sempre.';

-- Modifier del servizio da applicare a una certa data (per popolare quote_items.modifiers_applied).
-- SECURITY INVOKER: rispetta la RLS (il pro vede i modifier dei propri servizi).
create or replace function public.service_modifiers_for_date(p_service_id uuid, p_date date)
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'type', m.modifier_type, 'value', m.value)), '[]'::jsonb)
  from public.service_modifiers m
  where m.service_id = p_service_id
    and (m.date_from is null
         or (p_date is not null and p_date between m.date_from and coalesce(m.date_to, m.date_from)));
$$;
grant execute on function public.service_modifiers_for_date(uuid, date) to authenticated;
