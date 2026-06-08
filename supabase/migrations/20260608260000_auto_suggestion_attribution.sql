-- ============================================================================
-- AGGANCIO automatico cliente → fornitore suggerito (attribuzione credito)
-- ----------------------------------------------------------------------------
-- La pagina pubblica del professionista (portfolio + form) è il punto d'ingresso
-- del cliente. Se il professionista è OCCUPATO per quella data, l'email al
-- cliente propone 2 colleghi suggeriti. Da quel momento il sistema AGGANCIA il
-- cliente ai suggeriti: registra una riga in supplier_referrals (referrer = il
-- professionista occupato che ha "girato" il lead; suggested = il collega). Se
-- poi il collega firma un contratto con quello stesso cliente (stessa email), il
-- trigger esistente autocredit_on_referred_contract accredita in automatico il
-- credito (default 39€): lo PAGA il suggerito, lo INCASSA chi ha girato il lead.
--
-- Vincolo di equità: si suggeriscono SOLO i fornitori che hanno accettato di
-- essere suggeriti (accept_referrals = true), perché sono loro a dover pagare il
-- credito a segnalazione andata a buon fine.
-- ============================================================================

-- 1) suggest_alternatives_full: ritorna anche l'id (serve per l'aggancio) e
--    propone solo chi ha accettato di essere suggerito.
create or replace function public.suggest_alternatives_full(p_slug text, p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_owner uuid; v_sub text; v_role user_role; v_city text; v_msg text; v_name text; v_res jsonb;
begin
  if p_slug is null or p_date is null then return jsonb_build_object('found', false); end if;
  select id, subrole, role, city, auto_suggest_message, coalesce(business_name, full_name)
    into v_owner, v_sub, v_role, v_city, v_msg, v_name
    from public.profiles where slug = p_slug limit 1;
  if v_owner is null then return jsonb_build_object('found', false); end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
             'id', c.id,
             'name', coalesce(c.business_name, c.full_name),
             'full_name', c.full_name,
             'subrole', c.subrole, 'city', c.city,
             'phone', c.phone,
             'email', (select u.email from auth.users u where u.id = c.id)
           ) as x
    from public.profiles c
    where c.id <> v_owner and c.is_discoverable = true and c.slug is not null
      and c.accept_referrals = true          -- solo chi accetta di essere suggerito (e di pagare il credito)
      and ((v_sub is not null and c.subrole = v_sub) or (v_sub is null and c.role = v_role))
      and not exists (select 1 from public.supplier_appointments a
                       where a.owner_id = c.id and a.kind in ('BLOCCO','VACANZA')
                         and p_date between a.date and coalesce(a.end_date, a.date))
      and not exists (select 1 from public.supplier_availability sa
                       where sa.fornitore_id = c.id and sa.date = p_date and sa.status in ('BUSY','UNAVAILABLE'))
      and (select count(*) from public.supplier_appointments a2
             where a2.owner_id = c.id and a2.date = p_date and a2.kind in ('EVENTO','APPUNTAMENTO'))
          < coalesce(c.daily_capacity, 999)
    order by (c.city is not distinct from v_city) desc, c.discover_tier desc nulls last, c.created_at desc
    limit 2
  ) s;

  return jsonb_build_object('found', true, 'busy_name', v_name, 'message', v_msg, 'alternatives', v_res);
end$$;
grant execute on function public.suggest_alternatives_full(text, date) to anon, authenticated;

-- 2) record_auto_suggestions: aggancia il cliente ai colleghi suggeriti.
--    referrer = proprietario dello slug (il professionista occupato); suggested =
--    ogni id passato (filtrato a fornitori che accettano segnalazioni). Idempotente.
create or replace function public.record_auto_suggestions(
  p_slug text, p_client_email text, p_client_name text, p_event_kind text, p_suggested_ids uuid[]
)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare v_referrer uuid; v_sid uuid; v_count int := 0;
begin
  if p_slug is null or p_client_email is null or coalesce(array_length(p_suggested_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_params');
  end if;
  select id into v_referrer from public.profiles where slug = p_slug limit 1;
  if v_referrer is null then return jsonb_build_object('ok', false, 'reason', 'no_referrer'); end if;

  foreach v_sid in array p_suggested_ids loop
    if v_sid is not null and v_sid <> v_referrer
       and exists (select 1 from public.profiles p
                    where p.id = v_sid and p.role = 'FORNITORE' and p.accept_referrals = true)
    then
      insert into public.supplier_referrals(referrer_id, suggested_id, client_email, client_name, event_kind)
      values (v_referrer, v_sid, lower(p_client_email), nullif(p_client_name, ''), nullif(p_event_kind, ''))
      on conflict (referrer_id, suggested_id, client_email) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'linked', v_count);
end$$;
grant execute on function public.record_auto_suggestions(text, text, text, text, uuid[]) to anon, authenticated;
