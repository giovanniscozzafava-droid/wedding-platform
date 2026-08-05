-- SICUREZZA (H5): create_quote_from_suggestion copiava le risposte del questionario sul preventivo
-- CIECO togliendo solo una denylist fissa di chiavi contatto. Ma il questionario ha chiavi
-- STRUTTURATE che portano NOMI (partner1_name, partner2_name, couple_nickname, honoree_name,
-- parents_names, godparents) + campi liberi (how_met, notes) dove il cliente può scrivere nome/
-- telefono. Risultato: il fornitore suggerito vedeva i nomi degli sposi/festeggiato e possibili
-- contatti — il modello "cieco" era bucato via questionario.
--
-- Fix: sanitizzazione key-agnostic. (1) togliamo le chiavi che portano nomi/contatti (pattern +
-- campi liberi a rischio); (2) facciamo lo scrub di email e telefoni da OGNI valore stringa rimasto
-- (backstop per must_haves/allergie/note), preservando date e numeri utili (budget, invitati).

create or replace function public.sanitize_suggestion_answers(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; out jsonb := '{}'::jsonb; s text; arr jsonb;
  c_email text := '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}';
  c_phone text := '[+(]?\d[\d ().\-/]{6,}\d';
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  for k, v in select * from jsonb_each(p) loop
    -- Salta chiavi che portano nomi/contatti o testo libero ad alto rischio identità.
    if k ~* '(name|nome|email|mail|phone|tel|contatt|whatsapp|cell|godparent|instagram|social|indirizz|address)'
       or k in ('how_met','notes','note','messaggio','message','dedica') then
      continue;
    end if;
    if jsonb_typeof(v) = 'string' then
      s := v #>> '{}';
      -- non toccare le date ISO (verrebbero scambiate per telefoni)
      if s !~ '^\d{4}-\d{2}-\d{2}' then
        s := regexp_replace(s, c_email, '▮', 'g');
        s := regexp_replace(s, c_phone, '▮', 'g');
      end if;
      out := out || jsonb_build_object(k, to_jsonb(s));
    elsif jsonb_typeof(v) = 'array' then
      select jsonb_agg(
        case when jsonb_typeof(e) = 'string' and (e #>> '{}') !~ '^\d{4}-\d{2}-\d{2}'
          then to_jsonb(regexp_replace(regexp_replace(e #>> '{}', c_email, '▮','g'), c_phone, '▮','g'))
          else e end)
      into arr from jsonb_array_elements(v) e;
      out := out || jsonb_build_object(k, coalesce(arr, '[]'::jsonb));
    else
      out := out || jsonb_build_object(k, v);   -- numeri/bool/oggetti: invariati
    end if;
  end loop;
  return out;
end$$;

-- create_quote_from_suggestion ora sanitizza con la funzione (niente più denylist fissa).
create or replace function public.create_quote_from_suggestion(p_suggestion_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.supplier_suggestions%rowtype;
  v_quote uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_s from public.supplier_suggestions where id = p_suggestion_id;
  if v_s.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_s.supplier_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  if v_s.quote_id is not null then
    return jsonb_build_object('ok', true, 'quote_id', v_s.quote_id, 'reused', true);
  end if;

  insert into public.quotes (owner_id, title, client_name, client_email, event_date, event_location,
    event_kind, guest_count, status, revision, default_markup_percent, total_cost, total_client,
    margin_amount, margin_percent, quote_origin)
  values (v_uid, 'Preventivo — cliente suggerito', 'Cliente suggerito', '',
    v_s.event_date, v_s.event_location, coalesce(v_s.event_kind,'altro'), v_s.guest_count,
    'BOZZA', 1, 0, 0, 0, 0, 0, 'SUPPLIER_SUGGESTION')
  returning id into v_quote;

  begin
    if v_s.source_quote_id is not null then
      insert into public.quote_questionnaire_answers (quote_id, event_kind, answers)
      select v_quote, coalesce(v_s.event_kind, qa.event_kind, 'altro'),
             public.sanitize_suggestion_answers(qa.answers)
      from public.quote_questionnaire_answers qa
      where qa.quote_id = v_s.source_quote_id
      limit 1;
    end if;
  exception when others then null; end;

  update public.supplier_suggestions
     set status = case when status in ('SENT','VIEWED') then 'QUOTE_CREATED' else status end,
         quote_id = v_quote, updated_at = now()
   where id = p_suggestion_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'reused', false);
end$$;
grant execute on function public.create_quote_from_suggestion(uuid) to authenticated;

-- BACKFILL DI BONIFICA: i preventivi ciechi GIÀ esistenti avevano copiato i nomi → ri-sanitizza.
update public.quote_questionnaire_answers qa
   set answers = public.sanitize_suggestion_answers(qa.answers)
  from public.quotes q
 where q.id = qa.quote_id
   and q.quote_origin = 'SUPPLIER_SUGGESTION'
   and qa.answers is distinct from public.sanitize_suggestion_answers(qa.answers);
