-- Fornitore suggerito: deve vedere TUTTO quello che il cliente ha scritto nel form (stile, priorita',
-- must-have, budget, "a che punto siete", num. invitati…) TRANNE nome e contatti. Le risposte del
-- questionario (quote_questionnaire_answers.answers) sono gia' contact-free; al momento pero' NON
-- venivano copiate sul preventivo cieco → il suggerito vedeva solo data/tipo/luogo/invitati.
-- Ora create_quote_from_suggestion copia le answers dal preventivo del REFERRER (source_quote_id)
-- al preventivo cieco (con strip difensivo di eventuali chiavi contatto). Copre tutti i path che
-- impostano source_quote_id (suggest-my-suppliers, claim_supplier_invite, ecc.).

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

  -- Preventivo del fornitore, cliente MASCHERATO (nessun nome/email reale visibile).
  insert into public.quotes (owner_id, title, client_name, client_email, event_date, event_location,
    event_kind, guest_count, status, revision, default_markup_percent, total_cost, total_client,
    margin_amount, margin_percent, quote_origin)
  values (v_uid, 'Preventivo — cliente suggerito', 'Cliente suggerito', '',
    v_s.event_date, v_s.event_location, coalesce(v_s.event_kind,'altro'), v_s.guest_count,
    'BOZZA', 1, 0, 0, 0, 0, 0, 'SUPPLIER_SUGGESTION')
  returning id into v_quote;

  -- Risposte del form del cliente dal preventivo del referrer → sul preventivo cieco, SENZA contatti.
  begin
    if v_s.source_quote_id is not null then
      insert into public.quote_questionnaire_answers (quote_id, event_kind, answers)
      select v_quote, coalesce(v_s.event_kind, qa.event_kind, 'altro'),
             (coalesce(qa.answers, '{}'::jsonb)
               - 'client_name' - 'client_email' - 'client_phone'
               - 'name' - 'email' - 'phone' - 'telefono' - 'contatti' - 'contatto')
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

-- BACKFILL: preventivi ciechi GIA' esistenti senza risposte → copiale dal referrer (senza contatti).
insert into public.quote_questionnaire_answers (quote_id, event_kind, answers)
select q.id, coalesce(q.event_kind, qa.event_kind, 'altro'),
       (coalesce(qa.answers, '{}'::jsonb)
         - 'client_name' - 'client_email' - 'client_phone'
         - 'name' - 'email' - 'phone' - 'telefono' - 'contatti' - 'contatto')
from public.quotes q
join public.supplier_suggestions ss on ss.quote_id = q.id and ss.source_quote_id is not null
join public.quote_questionnaire_answers qa on qa.quote_id = ss.source_quote_id
where q.quote_origin = 'SUPPLIER_SUGGESTION'
  and not exists (select 1 from public.quote_questionnaire_answers x where x.quote_id = q.id);
