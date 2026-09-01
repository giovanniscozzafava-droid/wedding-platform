-- BUCO trovato da Giovanni (01/09/2026): «i clienti che dicono di aver scelto un
-- altro professionista per il prezzo, come fanno a capire che ricevono uno sconto?»
--
-- Non lo capivano. I due motivi si sovrappongono: chi se ne va perché un altro
-- costava meno clicca "Abbiamo scelto un altro professionista", non "Costa troppo",
-- e finiva nel ramo del commiato senza vedere nessuna controproposta. Cioè perdeva
-- lo sconto ESATTAMENTE nel caso in cui glielo avresti fatto volentieri.
--
-- Ora, dopo "un altro professionista", si chiede se è stata una questione di prezzo.
-- Se sì lo sconto parte lo stesso, ma il motivo resta ALTRO_FORNITORE: la statistica
-- deve continuare a distinguere "troppo caro in assoluto" da "battuto sul prezzo".

alter table public.quote_ultimatums
  add column if not exists price_related boolean not null default false;
comment on column public.quote_ultimatums.price_related is
  'Il motivo non è PREZZO ma il prezzo c''entra (es. un concorrente ha fatto meno): lo sconto parte lo stesso.';

drop function if exists public.ultimatum_respond_by_token(uuid, boolean, text, text);

create or replace function public.ultimatum_respond_by_token(
  p_token uuid, p_interested boolean, p_reason text default null,
  p_note text default null, p_price boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_q record;
  v_applied boolean := false; v_blocked boolean := false; v_prezzo boolean;
  v_new_pct numeric; v_email text; v_qtok uuid;
begin
  select * into v_u from quote_ultimatums where token = p_token;
  if v_u.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_u.expires_at < now() then return jsonb_build_object('error','expired'); end if;

  select * into v_q from quotes where id = v_u.quote_id;

  if v_u.responded_at is not null then
    return jsonb_build_object('error','already', 'discount_applied', v_u.discount_applied,
                              'discount_percent', v_u.discount_percent,
                              'still_interested', v_u.still_interested,
                              'quote_token', case when coalesce(v_u.still_interested,false) or v_u.discount_applied
                                                  then v_q.access_token end);
  end if;

  v_email := lower(nullif(trim(coalesce(v_q.client_email,'')),''));
  -- Il prezzo c'entra se lo dicono apertamente O se se ne vanno per un'offerta migliore.
  v_prezzo := (p_reason = 'PREZZO') or coalesce(p_price, false);

  if v_q.status::text not in ('INVIATO','BOZZA') then
    update quote_ultimatums set responded_at = now(), still_interested = p_interested,
           reason = nullif(p_reason,'')::ultimatum_reason, note = nullif(trim(coalesce(p_note,'')),''),
           price_related = coalesce(p_price,false)
     where id = v_u.id;
    return jsonb_build_object('ok', true, 'discount_applied', false, 'stale', true);
  end if;

  if p_interested is false then
    if v_prezzo and coalesce(v_u.discount_percent,0) > 0 then
      v_new_pct := least(90, coalesce(v_q.total_discount_percent,0) + v_u.discount_percent);
      if v_new_pct > coalesce(v_q.total_discount_percent,0) then
        update quotes set total_discount_percent = v_new_pct, pdf_url = null, updated_at = now()
         where id = v_q.id;
        v_applied := true;
      end if;
    else
      update quotes set funnel_paused = true, updated_at = now()
       where owner_id = v_q.owner_id
         and status::text in ('INVIATO','BOZZA')
         and (id = v_q.id or (v_email is not null and lower(client_email) = v_email));
      if v_email is not null then
        update supplier_clients set automations_blocked_at = now(), updated_at = now()
         where supplier_id = v_q.owner_id and lower(email) = v_email
           and automations_blocked_at is null;
      end if;
      v_blocked := true;
    end if;
  end if;

  if p_interested is true or v_applied then
    v_qtok := v_q.access_token;
    if v_qtok is null then
      v_qtok := gen_random_uuid();
      update quotes set access_token = v_qtok,
             access_token_expires_at = coalesce(access_token_expires_at, now() + interval '90 days')
       where id = v_q.id;
    end if;
  end if;

  update quote_ultimatums
     set responded_at = now(), still_interested = p_interested,
         reason = nullif(p_reason,'')::ultimatum_reason,
         note = nullif(trim(coalesce(p_note,'')),''),
         price_related = coalesce(p_price, false),
         discount_applied = v_applied
   where id = v_u.id;

  perform public.push_user_notification(
    v_u.owner_id, 'quote_ultimatum',
    case when p_interested then 'Il cliente è ancora interessato' else 'Il cliente si è tirato indietro' end,
    coalesce(v_q.client_name, v_q.title) ||
      case when p_interested then ' ha confermato l''interesse sul preventivo.'
           else ' ha risposto: ' || coalesce(p_reason, 'nessun motivo')
                || case when coalesce(p_price,false) then ' (per il prezzo)' else '' end
                || case when v_applied then '. Sconto ulteriore del ' || trim(to_char(v_u.discount_percent,'FM990D99'))
                                           || '% applicato: totale ora scontato del ' || trim(to_char(v_new_pct,'FM990D99')) || '%.'
                        when v_blocked then '. Automazioni sospese per questo contatto.'
                        else '.' end
      end,
    '/preventivi/' || v_q.id::text, v_q.id);

  return jsonb_build_object('ok', true, 'discount_applied', v_applied,
                            'discount_percent', v_u.discount_percent,
                            'sconto_totale', v_new_pct,
                            'automations_blocked', v_blocked,
                            'quote_token', v_qtok);
end$$;

revoke all on function public.ultimatum_respond_by_token(uuid, boolean, text, text, boolean) from public;
grant execute on function public.ultimatum_respond_by_token(uuid, boolean, text, text, boolean) to anon, authenticated;

-- La statistica distingue: "troppo caro" e "battuto sul prezzo" sono due sconfitte
-- diverse, ma sommate dicono quanto il prezzo ti costa davvero.
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
    'congelati',      (select count(*) from u where responded_at is null and funnel_paused),
    -- quante volte il prezzo c'entra, comunque l'abbiano detto
    'per_prezzo',     (select count(*) from u where reason = 'PREZZO' or price_related),
    'battuti_prezzo', (select count(*) from u where reason = 'ALTRO_FORNITORE' and price_related),
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
