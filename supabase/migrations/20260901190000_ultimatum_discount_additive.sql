-- Lo sconto dell'ultimatum è ULTERIORE, non alternativo (Giovanni: «abbiamo previsto
-- per voi un ulteriore sconto del 10% sul totale»).
--
-- Prima usavo greatest(esistente, ultimatum): difensivo, ma sbagliato rispetto a quello
-- che il cliente legge. E aveva un effetto perverso: su un preventivo già scontato al
-- 15% un ultimatum al 10% non faceva NULLA, e il cliente leggeva la promessa di uno
-- sconto che sul preventivo non trovava. Ora si somma, con un tetto al 90%.
create or replace function public.ultimatum_respond_by_token(
  p_token uuid, p_interested boolean, p_reason text default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_q record;
  v_applied boolean := false; v_blocked boolean := false;
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

  if v_q.status::text not in ('INVIATO','BOZZA') then
    update quote_ultimatums set responded_at = now(), still_interested = p_interested,
           reason = nullif(p_reason,'')::ultimatum_reason, note = nullif(trim(coalesce(p_note,'')),'')
     where id = v_u.id;
    return jsonb_build_object('ok', true, 'discount_applied', false, 'stale', true);
  end if;

  if p_interested is false then
    if p_reason = 'PREZZO' and coalesce(v_u.discount_percent,0) > 0 then
      -- ULTERIORE: si somma a quello che c'era. Il tetto al 90% evita che una
      -- configurazione distratta regali il lavoro.
      v_new_pct := least(90, coalesce(v_q.total_discount_percent,0) + v_u.discount_percent);
      if v_new_pct > coalesce(v_q.total_discount_percent,0) then
        -- pdf_url è la copia stampata all'invio, col totale vecchio: azzerarla evita
        -- che il cliente scarichi la cifra di prima subito dopo aver letto lo sconto.
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
         discount_applied = v_applied
   where id = v_u.id;

  perform public.push_user_notification(
    v_u.owner_id, 'quote_ultimatum',
    case when p_interested then 'Il cliente è ancora interessato' else 'Il cliente si è tirato indietro' end,
    coalesce(v_q.client_name, v_q.title) ||
      case when p_interested then ' ha confermato l''interesse sul preventivo.'
           else ' ha risposto: ' || coalesce(p_reason, 'nessun motivo') ||
                case when v_applied then '. Sconto ulteriore del ' || trim(to_char(v_u.discount_percent,'FM990D99'))
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

revoke all on function public.ultimatum_respond_by_token(uuid, boolean, text, text) from public;
grant execute on function public.ultimatum_respond_by_token(uuid, boolean, text, text) to anon, authenticated;
