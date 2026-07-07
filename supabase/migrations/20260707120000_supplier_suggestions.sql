-- ════════════════════════════════════════════════════════════════════════════
-- "SUGGERISCI I MIEI FORNITORI": un WP/fornitore (referrer) che ha inviato un
-- preventivo a un cliente può suggerire i fornitori che segue (collaborations
-- ACTIVE) a quel cliente. Genera 1 mail al cliente (lista) + 1 mail per ogni
-- fornitore suggerito. Il FORNITORE suggerito vede SOLO data/tipo/invitati/luogo
-- (niente PII del cliente); compone un preventivo "cieco" e lo invia via
-- piattaforma. Se il cliente ACCETTA, si sbloccano i contatti al fornitore.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Suggerimento (parte NON sensibile: la vede anche il fornitore suggerito)
create table if not exists public.supplier_suggestions (
  id              uuid primary key default gen_random_uuid(),
  referrer_id     uuid not null references public.profiles(id) on delete cascade,   -- chi suggerisce (Giovanni)
  supplier_id     uuid not null references public.profiles(id) on delete cascade,   -- fornitore suggerito
  source_quote_id uuid references public.quotes(id) on delete set null,            -- preventivo di partenza
  event_kind      text not null default 'matrimonio',
  event_date      date,
  event_location  text,                                                            -- luogo evento (non è PII del cliente)
  guest_count     int,
  status          text not null default 'SENT'
                  check (status in ('SENT','VIEWED','QUOTE_CREATED','QUOTE_SENT','ACCEPTED','DECLINED','EXPIRED')),
  quote_id        uuid references public.quotes(id) on delete set null,            -- preventivo cieco creato dal fornitore
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (referrer_id, supplier_id, source_quote_id)
);
create index if not exists idx_sugg_supplier on public.supplier_suggestions(supplier_id, status);
create index if not exists idx_sugg_referrer on public.supplier_suggestions(referrer_id);
create index if not exists idx_sugg_quote on public.supplier_suggestions(quote_id) where quote_id is not null;

-- 2) Contatti cliente (PII): NASCOSTI al fornitore finché il cliente non accetta
create table if not exists public.supplier_suggestions_private (
  suggestion_id uuid primary key references public.supplier_suggestions(id) on delete cascade,
  client_name   text,
  client_email  text,
  client_phone  text,
  message       text   -- messaggio personale del referrer al cliente
);

alter table public.supplier_suggestions enable row level security;
alter table public.supplier_suggestions_private enable row level security;

-- La riga (non PII) è visibile al referrer e al fornitore suggerito (+admin).
drop policy if exists sugg_select on public.supplier_suggestions;
create policy sugg_select on public.supplier_suggestions for select
  using (referrer_id = auth.uid() or supplier_id = auth.uid() or public.is_admin());

-- Il fornitore può marcare VIEWED / il referrer non modifica a mano: update mirato via RPC.
-- Consento update al fornitore proprietario (per status VIEWED) e al referrer; scritture reali
-- passano comunque da RPC security definer. (INSERT solo service role / RPC.)
drop policy if exists sugg_update_owner on public.supplier_suggestions;
create policy sugg_update_owner on public.supplier_suggestions for update
  using (supplier_id = auth.uid() or referrer_id = auth.uid() or public.is_admin())
  with check (supplier_id = auth.uid() or referrer_id = auth.uid() or public.is_admin());

-- I contatti: il referrer li vede sempre (è il suo cliente); il fornitore SOLO se il
-- suggerimento è ACCEPTED (sblocco all'accettazione). Service role bypassa (per le email).
drop policy if exists sugg_priv_select on public.supplier_suggestions_private;
create policy sugg_priv_select on public.supplier_suggestions_private for select
  using (
    exists (select 1 from public.supplier_suggestions s where s.id = suggestion_id and s.referrer_id = auth.uid())
    or exists (select 1 from public.supplier_suggestions s where s.id = suggestion_id and s.supplier_id = auth.uid() and s.status = 'ACCEPTED')
    or public.is_admin()
  );

create trigger trg_sugg_updated_at before update on public.supplier_suggestions
  for each row execute function public.set_updated_at();

-- 3) Il fornitore suggerito crea un preventivo CIECO dal suggerimento (niente PII cliente).
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

  update public.supplier_suggestions
     set status = case when status in ('SENT','VIEWED') then 'QUOTE_CREATED' else status end,
         quote_id = v_quote, updated_at = now()
   where id = p_suggestion_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'reused', false);
end$$;
grant execute on function public.create_quote_from_suggestion(uuid) to authenticated;

-- 4) Quando il cliente ACCETTA il preventivo cieco → sblocca i contatti al fornitore + notifica.
--    (il preventivo è collegato al suggerimento via supplier_suggestions.quote_id)
create or replace function public.tg_suggestion_on_quote_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sugg public.supplier_suggestions%rowtype; v_who text;
begin
  if new.status = 'ACCETTATO' and coalesce(old.status,'') <> 'ACCETTATO' then
    select * into v_sugg from public.supplier_suggestions where quote_id = new.id limit 1;
    if v_sugg.id is not null and v_sugg.status <> 'ACCEPTED' then
      update public.supplier_suggestions set status = 'ACCEPTED', updated_at = now() where id = v_sugg.id;
      -- notifica in-app al fornitore: ora vede i contatti
      begin
        perform public.push_user_notification(
          v_sugg.supplier_id, 'SUGGESTION_ACCEPTED',
          'Preventivo accettato',
          'Il cliente suggerito ha accettato il tuo preventivo: ora vedi i contatti.',
          '/quotes/' || new.id::text, v_sugg.id);
      exception when others then null; end;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_suggestion_on_quote_accept on public.quotes;
create trigger trg_suggestion_on_quote_accept
  after update of status on public.quotes
  for each row execute function public.tg_suggestion_on_quote_accept();

comment on table public.supplier_suggestions is
  'Referral: un WP/fornitore suggerisce i fornitori che segue a un cliente. Il fornitore vede solo data/tipo/luogo/invitati; i contatti (tabella _private) si sbloccano se il cliente accetta.';
