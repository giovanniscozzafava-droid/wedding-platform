-- REGRESSIONE/GAP (stessa classe): quote_questionnaire_get (anon, SECURITY DEFINER) risolveva il
-- preventivo con `where access_token = p_token` SENZA controllare né la revoca né la scadenza del
-- token, e restituisce le risposte del questionario del cliente (dettagli evento, campi liberi).
-- Un link REVOCATO o SCADUTO permetteva quindi di leggere ancora il questionario. Allineiamo ai
-- controlli di quote_get_by_token (token_revoked_at is null + is_token_valid).

create or replace function quote_questionnaire_get(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_answers jsonb;
  v_completed timestamptz;
  v_kind text;
begin
  select id, event_kind into v_quote_id, v_kind
    from quotes
   where access_token = p_token
     and token_revoked_at is null
     and is_token_valid(access_token_expires_at)
   limit 1;
  if v_quote_id is null then return jsonb_build_object('error', 'token_invalid'); end if;
  select answers, completed_at into v_answers, v_completed
    from quote_questionnaire_answers where quote_id = v_quote_id;
  return jsonb_build_object(
    'event_kind', v_kind,
    'answers', coalesce(v_answers, '{}'::jsonb),
    'completed_at', v_completed
  );
end$$;
