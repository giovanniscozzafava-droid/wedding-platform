-- Un preventivo può avere PIÙ ultimatum (se ne mandi un secondo). Il ciclo li
-- prendeva entrambi e contava lo stesso preventivo due volte: il congelamento è
-- idempotente e non fa danni, ma il numero mentiva. Salto quelli già fermi.
create or replace function public.ultimatum_freeze_silent(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_muti int := 0; v_dopo_sconto int := 0; v_c int := 0; r record; v_gia boolean;
  v_g int := greatest(1, coalesce(p_days, 7));
begin
  for r in
    select u.id as uid, q.id as qid, q.owner_id,
           lower(nullif(trim(coalesce(q.client_email,'')),'')) as em, 'muto'::text as caso
      from quote_ultimatums u join quotes q on q.id = u.quote_id
     where u.responded_at is null
       and u.sent_at < now() - make_interval(days => v_g)
       and q.status::text in ('INVIATO','BOZZA')
       and not coalesce(q.funnel_paused, false)
    union all
    select u.id, q.id, q.owner_id,
           lower(nullif(trim(coalesce(q.client_email,'')),'')), 'dopo_sconto'::text
      from quote_ultimatums u join quotes q on q.id = u.quote_id
     where u.discount_applied
       and u.responded_at is not null
       and u.responded_at < now() - make_interval(days => v_g)
       and q.status::text in ('INVIATO','BOZZA')
       and q.accepted_at is null
       and not coalesce(q.funnel_paused, false)
  loop
    -- rileggo: un giro precedente del ciclo può averlo già congelato
    select coalesce(funnel_paused, false) into v_gia from quotes where id = r.qid;
    if v_gia then continue; end if;

    update quotes set funnel_paused = true, updated_at = now() where id = r.qid;
    if r.caso = 'muto' then v_muti := v_muti + 1; else v_dopo_sconto := v_dopo_sconto + 1; end if;
    if r.em is not null then
      update supplier_clients set automations_blocked_at = now(), updated_at = now()
       where supplier_id = r.owner_id and lower(email) = r.em and automations_blocked_at is null;
      if found then v_c := v_c + 1; end if;
    end if;
    perform public.push_user_notification(
      r.owner_id, 'quote_ultimatum', 'Preventivo congelato',
      case when r.caso = 'muto'
           then 'Nessuna risposta all''ultimatum dopo ' || v_g ||
                ' giorni: smetto di scrivere a questo cliente. Riprendo se ti fai vivo tu.'
           else 'Nemmeno lo sconto ha smosso il cliente dopo ' || v_g ||
                ' giorni: era l''ultima carta, smetto di scrivere. Il preventivo resta valido se si rifà vivo.'
      end,
      '/preventivi/' || r.qid::text, r.qid);
  end loop;
  return jsonb_build_object('ok', true, 'congelati', v_muti + v_dopo_sconto,
                            'muti', v_muti, 'dopo_sconto', v_dopo_sconto,
                            'contatti_bloccati', v_c);
end$$;

revoke all on function public.ultimatum_freeze_silent(integer) from public;
grant execute on function public.ultimatum_freeze_silent(integer) to service_role;
