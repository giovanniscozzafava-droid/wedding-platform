-- COERENZA REVOCA (write-token): quote_toggle_option (cambia la selezione delle voci opzionali → muove
-- total_client_selected) e quote_questionnaire_submit (sovrascrive il questionario) risolvevano il
-- preventivo per `access_token = p_token` SENZA controllare revoca/scadenza. Su un link REVOCATO dal
-- professionista il cliente poteva ancora modificare selezione e questionario. accept/reject_by_token
-- già controllano la revoca; allineiamo anche queste due scritture.

create or replace function quote_toggle_option(p_token uuid, p_item_id uuid, p_selected boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select qi.id into v_id
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and q.token_revoked_at is null
     and is_token_valid(q.access_token_expires_at)
     and qi.id = p_item_id
     and qi.is_optional = true;
  if v_id is null then return false; end if;

  update quote_items
     set selected_by_client = p_selected,
         client_selected_at = case when p_selected then now() else null end
   where id = v_id;

  insert into quote_views (quote_id, event_type, payload)
  select q.id, 'OPTIONAL_TOGGLE', jsonb_build_object('item_id', p_item_id, 'selected', p_selected)
  from quotes q where q.access_token = p_token;
  return true;
end$$;

create or replace function quote_questionnaire_submit(
  p_token uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_kind text;
  v_id uuid;
begin
  select id, event_kind into v_quote_id, v_kind
    from quotes
   where access_token = p_token
     and token_revoked_at is null
     and is_token_valid(access_token_expires_at)
   limit 1;
  if v_quote_id is null then
    return jsonb_build_object('error', 'token_invalid');
  end if;

  insert into quote_questionnaire_answers (quote_id, event_kind, answers, completed_at)
    values (v_quote_id, coalesce(v_kind, 'matrimonio'), p_answers, now())
  on conflict (quote_id) do update
    set answers = excluded.answers,
        completed_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'event_kind', v_kind);
end$$;
