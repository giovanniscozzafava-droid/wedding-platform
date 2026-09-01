-- «I test non devono fare statistica» (Giovanni, 01/09/2026).
-- Stesso doppio criterio già usato da professional_funnel_metrics: il preventivo
-- marcato di prova, oppure agganciato a un contatto di prova.
create or replace function public.ultimatum_stats(p_days integer default 365)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (
    select ul.*
      from quote_ultimatums ul
      join quotes q on q.id = ul.quote_id
     where ul.owner_id = auth.uid()
       and ul.sent_at >= now() - make_interval(days => greatest(1, coalesce(p_days, 365)))
       and not coalesce(q.is_test, false)
       and not exists (select 1 from supplier_clients sc
                        where sc.id = q.direct_client_id and sc.is_test))
  select jsonb_build_object(
    'inviati',        (select count(*) from u),
    'risposte',       (select count(*) from u where responded_at is not null),
    'interessati',    (select count(*) from u where still_interested),
    'persi',          (select count(*) from u where still_interested is false),
    'sconti_partiti', (select count(*) from u where discount_applied),
    'recuperati',     (select count(*) from u join quotes q on q.id = u.quote_id
                        where q.accepted_at is not null and q.accepted_at > u.sent_at),
    'valore_recuperato', (select coalesce(sum(case when coalesce(q.total_client_selected,0) > 0
                                                   then q.total_client_selected else q.total_client end), 0)
                            from u join quotes q on q.id = u.quote_id
                           where q.accepted_at is not null and q.accepted_at > u.sent_at),
    'motivi',         coalesce((select jsonb_object_agg(reason::text, n)
                                  from (select reason, count(*) as n from u
                                         where reason is not null group by reason) m), '{}'::jsonb),
    'in_attesa',      (select count(*) from u where responded_at is null and expires_at > now())
  );
$$;

revoke all on function public.ultimatum_stats(integer) from public;
grant execute on function public.ultimatum_stats(integer) to authenticated;
