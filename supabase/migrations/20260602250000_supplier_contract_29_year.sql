-- ============================================================================
-- Contratto vincolante Fuyue Srl (Planfully) ↔ Fornitore
-- Durata 12 mesi (365 gg) dal 1° gennaio 2027. Canone 29€/anno in un'unica
-- soluzione anticipata. Fino al 31/12/2026 uso gratuito (beta).
-- ============================================================================

-- Abbonamento del fornitore
create table if not exists public.supplier_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.profiles(id) on delete cascade,
  plan         text not null default 'FORNITORE_ANNUAL',
  amount       numeric(10,2) not null default 29,
  currency     text not null default 'EUR',
  period_start date not null default date '2027-01-01',
  period_end   date not null default date '2027-12-31',
  status       text not null default 'PENDING' check (status in ('PENDING','ACTIVE','EXPIRED','CANCELLED')),
  accepted_at  timestamptz,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (supplier_id, period_start)
);
create index if not exists idx_sub_supplier on public.supplier_subscriptions(supplier_id, status);

drop trigger if exists trg_sub_upd on public.supplier_subscriptions;
create trigger trg_sub_upd before update on public.supplier_subscriptions
  for each row execute function public.set_updated_at();

alter table public.supplier_subscriptions enable row level security;
drop policy if exists "sub_own" on public.supplier_subscriptions;
create policy "sub_own" on public.supplier_subscriptions for select using (supplier_id = auth.uid() or is_admin());
drop policy if exists "sub_admin" on public.supplier_subscriptions;
create policy "sub_admin" on public.supplier_subscriptions for all using (is_admin()) with check (is_admin());

-- Testo del contratto (versione 2) — articolato vincolante, role-aware
create or replace function public.platform_agreement(p_role text default 'FORNITORE')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 2,
    'title', 'Contratto di abbonamento alla piattaforma Planfully',
    'parties', 'Tra Fuyue Srl (titolare del marchio Planfully) e il Professionista.',
    'articles', jsonb_build_array(
      jsonb_build_object('n','Art. 1 — Oggetto',
        'text','Fuyue Srl concede al Professionista l''accesso e l''utilizzo della piattaforma Planfully per la gestione di lead, preventivi, contratti, firma elettronica, disponibilità, rete tra professionisti e strumenti correlati.'),
      jsonb_build_object('n','Art. 2 — Durata',
        'text','Il presente contratto ha durata di 12 mesi (365 giorni), dal 1° gennaio 2027 al 31 dicembre 2027. Fino al 31 dicembre 2026 l''utilizzo della piattaforma è gratuito (fase beta).'),
      jsonb_build_object('n','Art. 3 — Corrispettivo',
        'text', case when upper(coalesce(p_role,'FORNITORE'))='FORNITORE'
          then 'Il Fornitore corrisponde a Fuyue Srl un canone annuo di 29€ (ventinove euro), da pagarsi in un''UNICA SOLUZIONE anticipata per l''intero periodo di 12 mesi.'
          else 'Per i partner fondatori (wedding planner/location) l''utilizzo resta gratuito; eventuali condizioni economiche saranno comunicate in anticipo.' end),
      jsonb_build_object('n','Art. 4 — Crediti tra professionisti',
        'text','Per ogni segnalazione di un collega che si trasforma in un contratto firmato è riconosciuto un credito FISSO di 39€ tra i professionisti coinvolti.'),
      jsonb_build_object('n','Art. 5 — Commissioni future',
        'text','Fuyue Srl si riserva il diritto di introdurre e/o modificare in futuro commissioni sulle segnalazioni e le condizioni economiche e di servizio. Tutto può cambiare e ci riserviamo di farlo.'),
      jsonb_build_object('n','Art. 6 — Trattamento dati',
        'text','I dati inseriti e gestiti tramite Planfully sono trattati da Fuyue Srl, titolare del marchio, secondo l''informativa privacy e per le finalità del servizio.'),
      jsonb_build_object('n','Art. 7 — Rinnovo',
        'text','Salvo diversa comunicazione tra le parti, il contratto si intende rinnovabile per un uguale periodo di 12 mesi alle condizioni allora vigenti.'),
      jsonb_build_object('n','Art. 8 — Modifiche',
        'text','Le presenti condizioni potranno essere aggiornate. L''uso continuato del servizio costituisce accettazione delle versioni aggiornate.'),
      jsonb_build_object('n','Art. 9 — Foro competente',
        'text','Per ogni controversia relativa al presente contratto è competente il foro della sede legale di Fuyue Srl.'),
      jsonb_build_object('n','Art. 10 — Accettazione',
        'text','La spunta dell''apposita casella e l''invio del modulo di registrazione costituiscono accettazione vincolante del presente contratto.')
    )
  );
$$;
grant execute on function public.platform_agreement(text) to anon, authenticated;
-- compat: vecchia firma senza parametro
drop function if exists public.platform_agreement();

-- Accettazione: registra le condizioni + crea l'abbonamento PENDING (fornitore)
create or replace function public.accept_platform_agreement()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role user_role;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select role into v_role from public.profiles where id = v_uid;
  update public.profiles set platform_terms_accepted_at = now(), platform_terms_version = 2 where id = v_uid;
  if v_role = 'FORNITORE' then
    insert into public.supplier_subscriptions(supplier_id, accepted_at)
    values (v_uid, now())
    on conflict (supplier_id, period_start) do update set accepted_at = now();
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.accept_platform_agreement() to authenticated;

-- Quando un nuovo fornitore accetta le condizioni in registrazione → abbonamento
create or replace function public.create_sub_on_terms_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.platform_terms_accepted_at is not null
     and (tg_op = 'INSERT' or old.platform_terms_accepted_at is null) and new.role = 'FORNITORE' then
    insert into public.supplier_subscriptions(supplier_id, accepted_at)
    values (new.id, new.platform_terms_accepted_at)
    on conflict (supplier_id, period_start) do nothing;
  end if;
  return new;
end$$;
drop trigger if exists trg_sub_on_terms on public.profiles;
create trigger trg_sub_on_terms after insert or update of platform_terms_accepted_at on public.profiles
  for each row execute function public.create_sub_on_terms_accept();

comment on table public.supplier_subscriptions is
  'Abbonamento fornitore: 29€/anno una soluzione, 12 mesi dal 1/1/2027. Da qui inizia la monetizzazione.';
