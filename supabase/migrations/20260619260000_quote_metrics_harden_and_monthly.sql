-- 1) HARDENING metriche viste: (a) NON conteggiare aperture su token SCADUTO (oltre che revocato),
--    (b) filtrare bot/scanner email (Outlook/Gmail/anteprime link) che gonfierebbero le aperture.
create or replace function public.track_quote_open(p_token uuid, p_ua text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  -- bot/scanner noti: non è il cliente reale → ignora del tutto (niente conteggio né timeline).
  if p_ua is not null and p_ua ~* '(bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|bingbot|googlebot|headless|python-requests|curl/|wget|preview|scanner|monitor|pingdom|uptime|prerender)' then
    return;
  end if;
  update public.quotes
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where access_token = p_token
     and token_revoked_at is null
     and (access_token_expires_at is null or access_token_expires_at > now())
   returning id into v_id;
  if v_id is not null then
    insert into public.quote_views (quote_id, event_type, payload, user_agent)
    values (v_id, 'OPEN', '{}'::jsonb, left(p_ua, 300));
    perform public.log_access('quotes', v_id::text, 'READ', jsonb_build_object('op','quote_open'));
  end if;
end$$;
grant execute on function public.track_quote_open(uuid, text) to anon, authenticated;

-- 2) CATALOGO preventivi INVIATI per mese/anno (per ogni professionista, owner-scoped): conteggi
--    inviati / accettati / non accettati (rifiutati + ancora in attesa) + valore accettato.
create or replace function public.quotes_monthly_report()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(r order by r->>'ym' desc)
    from (
      select jsonb_build_object(
        'ym',       to_char(date_trunc('month', coalesce(sent_at, created_at)), 'YYYY-MM'),
        'year',     extract(year  from coalesce(sent_at, created_at))::int,
        'month',    extract(month from coalesce(sent_at, created_at))::int,
        'sent',     count(*),
        'accepted', count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')),
        'rejected', count(*) filter (where status = 'RIFIUTATO'),
        'pending',  count(*) filter (where status not in ('ACCETTATO','CONVERTITO_IN_CONTRATTO','RIFIUTATO')),
        'accepted_value', coalesce(sum(total_client) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')), 0)
      ) as r
      from public.quotes
      where owner_id = v_uid
        and (sent_at is not null or status <> 'BOZZA')   -- solo i preventivi INVIATI
      group by date_trunc('month', coalesce(sent_at, created_at)),
               extract(year from coalesce(sent_at, created_at)),
               extract(month from coalesce(sent_at, created_at))
    ) s
  ), '[]'::jsonb));
end$$;
grant execute on function public.quotes_monthly_report() to authenticated;
