-- «I preventivi che non hanno rinnovato la possibilità di scrivere e non hanno
--  risposto che non sono più interessati, frizzali» (Giovanni, 01/09/2026).
--
-- L'ultimatum è l'ultima domanda: chi non risponde non ci ha detto di no, ma non ci
-- ha nemmeno rinnovato il permesso di insistere. Il silenzio si tratta come il no
-- gentile: si smette di scrivere. Non li marchiamo come persi — non l'hanno detto —
-- ma escono dalle automazioni finché non si rifanno vivi loro.

create or replace function public.ultimatum_freeze_silent(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_c int := 0; r record;
begin
  for r in
    select u.id as uid, q.id as qid, q.owner_id, lower(nullif(trim(coalesce(q.client_email,'')),'')) as em
      from quote_ultimatums u
      join quotes q on q.id = u.quote_id
     where u.responded_at is null
       and u.sent_at < now() - make_interval(days => greatest(1, coalesce(p_days, 7)))
       and q.status::text in ('INVIATO','BOZZA')
       and not coalesce(q.funnel_paused, false)   -- già fermo: niente da fare
  loop
    update quotes set funnel_paused = true, updated_at = now() where id = r.qid;
    v_n := v_n + 1;
    if r.em is not null then
      update supplier_clients set automations_blocked_at = now(), updated_at = now()
       where supplier_id = r.owner_id and lower(email) = r.em and automations_blocked_at is null;
      if found then v_c := v_c + 1; end if;
    end if;
    -- Lo diciamo al professionista: un preventivo che smette di essere seguito non
    -- deve sparire in silenzio, o se lo ritrova morto senza sapere quando.
    perform public.push_user_notification(
      r.owner_id, 'quote_ultimatum',
      'Preventivo congelato',
      'Nessuna risposta all''ultimatum dopo ' || greatest(1, coalesce(p_days,7)) ||
      ' giorni: smetto di scrivere a questo cliente. Riprendo se ti fai vivo tu.',
      '/preventivi/' || r.qid::text, r.qid);
  end loop;
  return jsonb_build_object('ok', true, 'congelati', v_n, 'contatti_bloccati', v_c);
end$$;

revoke all on function public.ultimatum_freeze_silent(integer) from public;
grant execute on function public.ultimatum_freeze_silent(integer) to service_role;

-- La statistica deve dire anche quanti sono morti di silenzio: è un numero che parla
-- del preventivo (o del prezzo) quanto un "no" esplicito.
create or replace function public.ultimatum_stats(p_days integer default 365)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (
    select ul.*, q.funnel_paused
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
    -- congelati = nessuna risposta, e il preventivo è stato messo a riposo
    'congelati',      (select count(*) from u where responded_at is null and funnel_paused),
    'recuperati',     (select count(*) from u join quotes q on q.id = u.quote_id
                        where q.accepted_at is not null and q.accepted_at > u.sent_at),
    'valore_recuperato', (select coalesce(sum(case when coalesce(q.total_client_selected,0) > 0
                                                   then q.total_client_selected else q.total_client end), 0)
                            from u join quotes q on q.id = u.quote_id
                           where q.accepted_at is not null and q.accepted_at > u.sent_at),
    'motivi',         coalesce((select jsonb_object_agg(reason::text, n)
                                  from (select reason, count(*) as n from u
                                         where reason is not null group by reason) m), '{}'::jsonb),
    'in_attesa',      (select count(*) from u where responded_at is null and expires_at > now()
                                              and not coalesce(funnel_paused, false))
  );
$$;

revoke all on function public.ultimatum_stats(integer) from public;
grant execute on function public.ultimatum_stats(integer) to authenticated;
