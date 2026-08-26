-- ============================================================================
-- Suggerimenti professionisti — due allineamenti richiesti:
-- 1) Chi suggerisce è LIBERO di farlo anche PRIMA che il proprio preventivo sia
--    accettato/firmato. L'unico gate è il CONSENSO DEL CLIENTE (form:
--    allow_supplier_suggestions). suggest_suppliers_to_client bloccava su
--    'quote_not_signed' e NON controllava il consenso: invertiamo.
-- 2) Il suggerito deve COLLIMARE tra fase-preventivo ed evento: se un fornitore è
--    GIA' nel cerchio dell'evento (voci preventivo / partecipante) o GIA' suggerito
--    (uno dei due canali: supplier_referrals aperto, supplier_suggestions cieco),
--    chi suggerisce va avvisato. RPC quote_suggestion_conflicts espone i due insiemi.
-- ============================================================================

-- (1) Gate: consenso cliente al posto di "preventivo firmato".
create or replace function public.suggest_suppliers_to_client(p_quote_id uuid, p_suggested_ids uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_q public.quotes%rowtype; v_count int := 0; v_sid uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  if v_q.owner_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  -- Consenso del CLIENTE (dal form): suggerire è a discrezione del cliente finale.
  if not coalesce(v_q.allow_supplier_suggestions, false) and not public.is_admin() then
    return jsonb_build_object('error','suggestions_not_allowed');
  end if;
  if v_q.client_email is null then return jsonb_build_object('error','no_client_email'); end if;
  -- RIMOSSO il gate "preventivo firmato": libero di suggerire anche in fase preventivo.

  foreach v_sid in array coalesce(p_suggested_ids, '{}') loop
    if v_sid <> v_uid
       and exists (select 1 from public.follows f where f.follower_id = v_uid and f.followed_id = v_sid and f.status = 'APPROVED')
       and exists (select 1 from public.profiles p where p.id = v_sid and p.role = 'FORNITORE' and p.accept_referrals = true)
    then
      insert into public.supplier_referrals(referrer_id, suggested_id, client_email, client_name, quote_id, event_kind)
      values (v_uid, v_sid, lower(v_q.client_email), v_q.client_name, p_quote_id, v_q.event_kind)
      on conflict (referrer_id, suggested_id, client_email) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'suggested', v_count);
end$$;

-- (2) Conflitti di suggerimento per un preventivo: chi è GIA' nel cerchio dell'evento
--     e chi è GIA' stato suggerito (entrambi i canali). Usato dalle UI in fase preventivo
--     per avvisare ("già dentro, non serve suggerirlo").
create or replace function public.quote_suggestion_conflicts(p_quote uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_entry uuid; v_key text;
        v_circle uuid[]; v_sugg uuid[];
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select owner_id into v_owner from public.quotes where id = p_quote;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner <> v_uid and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;

  select ce.id into v_entry from public.calendar_entries ce where ce.quote_id = p_quote limit 1;
  v_key := public.quote_event_key(p_quote);

  -- GIA' NEL CERCHIO/EVENTO: fornitori nelle voci dei preventivi dello STESSO evento
  -- (per quote_id o per chiave-evento) + partecipanti dell'evento.
  select coalesce(array_agg(distinct sid), '{}') into v_circle from (
    select qi.supplier_id as sid
      from public.quote_items qi
      join public.quotes q2 on q2.id = qi.quote_id
     where qi.supplier_id is not null
       and (q2.id = p_quote or (v_key is not null and public.quote_event_key(q2.id) = v_key))
    union
    select cep.user_id
      from public.calendar_entry_participants cep
     where v_entry is not null and cep.entry_id = v_entry and cep.user_id is not null
  ) t;

  -- GIA' SUGGERITI per questo preventivo/evento, su ENTRAMBI i canali.
  select coalesce(array_agg(distinct sid), '{}') into v_sugg from (
    select sr.suggested_id as sid from public.supplier_referrals sr
      join public.quotes q3 on q3.id = sr.quote_id
     where sr.quote_id = p_quote or (v_key is not null and public.quote_event_key(q3.id) = v_key)
    union
    select ss.supplier_id from public.supplier_suggestions ss
      join public.quotes q4 on q4.id = ss.source_quote_id
     where ss.source_quote_id = p_quote or (v_key is not null and public.quote_event_key(q4.id) = v_key)
  ) t;

  return jsonb_build_object('ok', true, 'in_circle', v_circle, 'already_suggested', v_sugg);
end$$;

revoke all on function public.quote_suggestion_conflicts(uuid) from anon, public;
grant execute on function public.quote_suggestion_conflicts(uuid) to authenticated;
