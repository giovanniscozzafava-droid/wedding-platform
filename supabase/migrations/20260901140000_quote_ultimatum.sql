-- ULTIMATUM sul preventivo (Giovanni, 01/09/2026).
-- Un preventivo inviato che non riceve risposta resta lì a marcire. Il professionista
-- preme "Ultimatum": al cliente arriva una mail che chiede se è ancora interessato,
-- con due pulsanti diretti nella mail. Se dice di no, gli chiediamo il motivo.
-- **Se il motivo è il prezzo, parte da sola una controproposta scontata**, della misura
-- che il professionista ha deciso PRIMA, a monte dell'automazione.
--
-- Il senso: il "no per prezzo" è l'unico no recuperabile senza trattativa, e va
-- recuperato nel momento esatto in cui il cliente lo dice, non tre giorni dopo.

-- Quanto sconto far partire da solo. 0 = automazione spenta (si limita a segnalare).
alter table public.profiles
  add column if not exists ultimatum_discount_percent numeric(5,2) not null default 0;
comment on column public.profiles.ultimatum_discount_percent is
  'Sconto % che parte da solo quando un cliente risponde all''ultimatum "troppo caro". 0 = spento.';

do $$ begin
  create type public.ultimatum_reason as enum
    ('PREZZO','ALTRO_FORNITORE','DATA','RINVIATO','NON_PIU','ALTRO');
exception when duplicate_object then null; end $$;

create table if not exists public.quote_ultimatums (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes(id) on delete cascade,
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  token           uuid not null default gen_random_uuid(),
  sent_at         timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 days',
  responded_at    timestamptz,
  still_interested boolean,
  reason          public.ultimatum_reason,
  note            text,
  -- sconto deciso a monte e congelato QUI: se il pro lo cambia dopo, questo
  -- ultimatum resta quello che il cliente ha visto promesso.
  discount_percent numeric(5,2) not null default 0,
  discount_applied boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_quote_ultimatums_quote on public.quote_ultimatums(quote_id);
create unique index if not exists idx_quote_ultimatums_token on public.quote_ultimatums(token);

alter table public.quote_ultimatums enable row level security;
drop policy if exists quote_ultimatums_owner on public.quote_ultimatums;
create policy quote_ultimatums_owner on public.quote_ultimatums
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Cosa vede il cliente aprendo il link (nessun dato sensibile: solo di chi è e quanto).
create or replace function public.ultimatum_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_u record; v_q record; v_o record;
begin
  select * into v_u from quote_ultimatums where token = p_token;
  if v_u.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_u.expires_at < now() then return jsonb_build_object('error','expired'); end if;
  select * into v_q from quotes where id = v_u.quote_id;
  select business_name, full_name, brand_primary_color, brand_logo_url into v_o
    from profiles where id = v_u.owner_id;
  return jsonb_build_object(
    'ok', true,
    'client_name', v_q.client_name,
    'title', v_q.title,
    'event_date', v_q.event_date,
    'status', v_q.status::text,
    'responded_at', v_u.responded_at,
    'still_interested', v_u.still_interested,
    'reason', v_u.reason,
    'discount_percent', v_u.discount_percent,
    'discount_applied', v_u.discount_applied,
    'owner', jsonb_build_object('business_name', v_o.business_name, 'full_name', v_o.full_name,
                                'brand_primary_color', v_o.brand_primary_color, 'brand_logo_url', v_o.brand_logo_url)
  );
end$$;

-- La risposta del cliente. Se è "no perché costa troppo" e il pro aveva armato uno
-- sconto, lo applica subito e ricalcola i totali (ci pensa trg_quote_discount_recalc).
create or replace function public.ultimatum_respond_by_token(
  p_token uuid, p_interested boolean, p_reason text default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_u record; v_q record; v_applied boolean := false; v_new_pct numeric;
begin
  select * into v_u from quote_ultimatums where token = p_token;
  if v_u.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_u.expires_at < now() then return jsonb_build_object('error','expired'); end if;
  if v_u.responded_at is not null then
    return jsonb_build_object('error','already', 'discount_applied', v_u.discount_applied,
                              'discount_percent', v_u.discount_percent);
  end if;

  select * into v_q from quotes where id = v_u.quote_id;
  -- Un preventivo già firmato o rifiutato non si tocca più.
  if v_q.status::text not in ('INVIATO','BOZZA') then
    update quote_ultimatums set responded_at = now(), still_interested = p_interested,
           reason = nullif(p_reason,'')::ultimatum_reason, note = nullif(trim(coalesce(p_note,'')),'')
     where id = v_u.id;
    return jsonb_build_object('ok', true, 'discount_applied', false, 'stale', true);
  end if;

  if p_interested is false and p_reason = 'PREZZO' and coalesce(v_u.discount_percent,0) > 0 then
    -- greatest: se il pro aveva già scontato di più, l'ultimatum non deve PEGGIORARE
    -- l'offerta che il cliente ha già in mano.
    v_new_pct := greatest(coalesce(v_q.total_discount_percent,0), v_u.discount_percent);
    if v_new_pct > coalesce(v_q.total_discount_percent,0) then
      update quotes set total_discount_percent = v_new_pct, updated_at = now() where id = v_q.id;
      v_applied := true;
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
    case when p_interested then 'Il cliente è ancora interessato'
         else 'Il cliente si è tirato indietro' end,
    coalesce(v_q.client_name, v_q.title) ||
      case when p_interested then ' ha confermato l''interesse sul preventivo.'
           else ' ha risposto: ' || coalesce(p_reason, 'nessun motivo') ||
                case when v_applied then '. Sconto del ' || trim(to_char(v_u.discount_percent,'FM990D99')) || '% applicato in automatico.' else '.' end
      end);

  return jsonb_build_object('ok', true, 'discount_applied', v_applied,
                            'discount_percent', v_u.discount_percent);
end$$;

revoke all on function public.ultimatum_get_by_token(uuid) from public;
revoke all on function public.ultimatum_respond_by_token(uuid, boolean, text, text) from public;
grant execute on function public.ultimatum_get_by_token(uuid) to anon, authenticated;
grant execute on function public.ultimatum_respond_by_token(uuid, boolean, text, text) to anon, authenticated;
