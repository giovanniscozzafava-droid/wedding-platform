-- Stato "opzione data" per la pagina cliente (public, via token): dice se il pro ha ABILITATO
-- l'opzione e se la data è già stata opzionata. Il cliente lo usa per mostrare "Richiedi opzione".
create or replace function public.quote_option_status(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'option_allowed', coalesce(q.option_allowed, false),
    'option_days',    coalesce(q.option_days, 15),
    'optioned',       exists (select 1 from public.quote_option_requests r where r.quote_id = q.id and r.status = 'CONCESSA')
  ) from public.quotes q where q.access_token::text = p_token;
$$;
grant execute on function public.quote_option_status(text) to anon, authenticated;
