-- ============================================================================
-- Regola: il cliente vede il PREZZO del preventivo solo dopo essersi iscritto
-- e aver accettato (spuntando ogni voce) che i propri dati diventano di
-- Fuyue Srl, che può utilizzarli anche per finalità commerciali e cederli a
-- terzi. Il consenso viene registrato (prova legale).
-- ============================================================================

create table if not exists public.quote_view_consents (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  client_email text not null,
  client_name  text,
  consents     jsonb not null default '{}'::jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_qview_consents_quote on public.quote_view_consents(quote_id, lower(client_email));

alter table public.quote_view_consents enable row level security;
revoke all on public.quote_view_consents from anon, authenticated, public;
-- L'owner del preventivo può vedere i consensi raccolti (prova).
drop policy if exists "qview_consents_owner" on public.quote_view_consents;
create policy "qview_consents_owner" on public.quote_view_consents
  for select using (exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()) or is_admin());

-- Le voci di consenso obbligatorie (testo ufficiale).
create or replace function public.quote_consent_clauses()
returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('key','registration', 'text','Mi registro su Planfully per visualizzare il prezzo del preventivo.'),
    jsonb_build_object('key','data_fuyue', 'text','Acconsento al trattamento dei miei dati personali da parte di Fuyue Srl, titolare del marchio Planfully, che ne diventa titolare.'),
    jsonb_build_object('key','commercial_third_parties', 'text','Acconsento all''utilizzo dei miei dati anche per finalità commerciali e alla loro eventuale cessione a terzi da parte di Fuyue Srl.'),
    jsonb_build_object('key','privacy_policy', 'text','Dichiaro di aver letto e compreso l''informativa privacy.')
  );
$$;
grant execute on function public.quote_consent_clauses() to anon, authenticated;

-- Registrazione + consenso → sblocca il prezzo. Anon-callable via token.
-- Richiede che TUTTE le voci obbligatorie siano spuntate (true).
create or replace function public.register_quote_view(
  p_token uuid, p_email text, p_name text, p_consents jsonb,
  p_ip text default null, p_user_agent text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_qid uuid; v_clause record; v_ok boolean := true;
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error','invalid_email');
  end if;
  select id into v_qid from public.quotes where access_token = p_token
    and token_revoked_at is null
    and (access_token_expires_at is null or access_token_expires_at > now());
  if v_qid is null then return jsonb_build_object('error','quote_not_available'); end if;

  -- Tutte le voci obbligatorie devono essere true
  for v_clause in select jsonb_array_elements(public.quote_consent_clauses()) as c loop
    if coalesce((p_consents ->> (v_clause.c ->> 'key'))::boolean, false) = false then
      v_ok := false;
    end if;
  end loop;
  if not v_ok then return jsonb_build_object('error','consents_required'); end if;

  insert into public.quote_view_consents(quote_id, client_email, client_name, consents, ip_address, user_agent)
  values (v_qid, lower(trim(p_email)), p_name, p_consents, p_ip, p_user_agent);

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.register_quote_view(uuid, text, text, jsonb, text, text) to anon, authenticated;

comment on table public.quote_view_consents is
  'Consensi raccolti dal cliente per sbloccare il prezzo del preventivo: registrazione + dati a Fuyue Srl + uso commerciale/cessione a terzi + privacy. Prova legale.';
