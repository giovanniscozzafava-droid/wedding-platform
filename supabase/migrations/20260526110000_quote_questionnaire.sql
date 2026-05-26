-- ============================================================================
-- QUOTE QUESTIONNAIRE — risposte del cliente al questionario specifico per
-- event_kind, compilate sulla pagina /p/accept/:token prima di firmare il
-- preventivo. Domande hardcoded in frontend/src/lib/eventQuestions.ts.
-- ============================================================================

create table if not exists quote_questionnaire_answers (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  event_kind    text not null default 'matrimonio',
  answers       jsonb not null default '{}'::jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (quote_id)
);

create index if not exists idx_qqa_quote on quote_questionnaire_answers(quote_id);

create trigger trg_qqa_updated_at before update on quote_questionnaire_answers
  for each row execute function set_updated_at();

alter table quote_questionnaire_answers enable row level security;

-- Owner del quote (WP/Location/Fornitore) vede e modifica
drop policy if exists "qqa_owner_all" on quote_questionnaire_answers;
create policy "qqa_owner_all" on quote_questionnaire_answers for all using (
  exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
) with check (
  exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())
);

-- Admin tutto
drop policy if exists "qqa_admin_all" on quote_questionnaire_answers;
create policy "qqa_admin_all" on quote_questionnaire_answers for all
  using (is_admin()) with check (is_admin());

-- Public via access_token (anon insert/update con knowledge del token quote)
-- RPC dedicata sotto evita di esporre RLS a unauthenticated.

-- RPC: salva risposte questionario via access_token (cliente non loggato)
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
    from quotes where access_token = p_token limit 1;
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

grant execute on function quote_questionnaire_submit(uuid, jsonb) to anon, authenticated;

-- RPC: fetch risposte via token (per pre-popolare se rientra a editare)
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
    from quotes where access_token = p_token limit 1;
  if v_quote_id is null then return jsonb_build_object('error', 'token_invalid'); end if;
  select answers, completed_at into v_answers, v_completed
    from quote_questionnaire_answers where quote_id = v_quote_id;
  return jsonb_build_object(
    'event_kind', v_kind,
    'answers', coalesce(v_answers, '{}'::jsonb),
    'completed_at', v_completed
  );
end$$;

grant execute on function quote_questionnaire_get(uuid) to anon, authenticated;

comment on table quote_questionnaire_answers is
  'Risposte del cliente al questionario sul tipo di evento. Una row per quote. Compilato pre-firma sulla pagina /p/accept/:token.';
