-- ============================================================================
-- LISTA D'ATTESA MAESTRANZE — raccolta dati pubblica, in vista dell'apertura.
--
-- La pagina è pubblica (deve convertire da Instagram), ma la TABELLA non è mai
-- leggibile dal client: né anon né authenticated. Scrive solo l'Edge Function
-- con service_role, legge solo admin. È dato personale di lavoratori: nome,
-- telefono, email, disponibilità. Vale lo stesso metro della bacheca.
--
-- NOTA DI SCOSTAMENTO DAL BRIEF (professione):
-- Il brief chiedeva un enum di 5 valori (CAMERIERE/ASSISTENTE_FOTO/MUSICISTA/
-- COORDINATORE/ALTRO). È del 16/07, cioè PRIMA che esistesse il vocabolario:
-- oggi in maestranze_skills ci sono 263 mestieri in 25 famiglie. Con l'enum a 5,
-- un organettista o un rigger finirebbero tutti in "ALTRO" + testo libero, e a
-- settembre non si potrebbe pre-compilare il profilo di nessuno (nessun aggancio
-- fra la riga di waitlist e la competenza vera). Quindi: FK al vocabolario reale.
-- Il breakdown admin si fa per FAMIGLIA (25 voci leggibili), che è esattamente
-- il motivo per cui la famiglia esiste. professione_altro resta per i casi veri.
-- ============================================================================

create table if not exists public.maestranze_waitlist (
  id                  uuid primary key default gen_random_uuid(),
  nome                varchar(120) not null,
  email               varchar(255) not null unique,
  telefono            varchar(20)  not null unique,
  skill_id            uuid references public.maestranze_skills(id),
  professione_altro   varchar(80),
  provincia           varchar(4) not null references public.province_regioni(provincia),
  disponibilita       text[] not null default '{}',
  instagram           varchar(255),
  portfolio           text,
  source              varchar(40),
  privacy_version     varchar(20) not null,
  privacy_accepted_at timestamptz not null default now(),
  email_confirmed_at  timestamptz,
  confirm_token       uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  -- O scegli un mestiere dal vocabolario, o scrivi il tuo: uno dei due, sempre.
  constraint waitlist_professione_presente
    check (skill_id is not null or nullif(btrim(coalesce(professione_altro,'')),'') is not null),
  -- Vocabolario chiuso anche qui: niente valori inventati dal client.
  constraint waitlist_disponibilita_valida
    check (disponibilita <@ array['WEEKEND','FESTIVI','SERA','GIORNO','SU_CHIAMATA']::text[])
);

create index if not exists idx_waitlist_provincia on public.maestranze_waitlist(provincia);
create index if not exists idx_waitlist_skill on public.maestranze_waitlist(skill_id);
create index if not exists idx_waitlist_confirmed on public.maestranze_waitlist(email_confirmed_at)
  where email_confirmed_at is not null;
create unique index if not exists idx_waitlist_token on public.maestranze_waitlist(confirm_token);

alter table public.maestranze_waitlist enable row level security;

-- NESSUNA policy per anon/authenticated: la tabella è invisibile dal client.
-- Nessuna policy INSERT: nemmeno un utente loggato può scriverci direttamente.
drop policy if exists "waitlist_solo_admin" on public.maestranze_waitlist;
create policy "waitlist_solo_admin" on public.maestranze_waitlist
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- rate limit
-- Tentativi per IP: l'Edge Function conta quelli dell'ultima ora prima di scrivere.
create table if not exists public.maestranze_waitlist_attempts (
  id         bigserial primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_waitlist_attempts on public.maestranze_waitlist_attempts(ip, created_at desc);
alter table public.maestranze_waitlist_attempts enable row level security;
-- Nessuna policy: solo service_role (che bypassa RLS). Il client non la vede proprio.

-- --------------------------------- vocabolario e province per la pagina PUBBLICA
-- La lista d'attesa è pubblica e deve mostrare i 263 mestieri e le 107 province, ma
-- maestranze_skills e province_regioni hanno RLS `to authenticated` → da anon non si
-- leggono. NON apriamo policy ad anon (l'invariante "nessuna policy maestranze concede
-- ad anon" è un pilastro, e va tenuto): esponiamo due RPC che restituiscono SOLO dati
-- di riferimento — nessun dato personale, nessuna riga di nessuno.
create or replace function public.maestranze_vocabolario()
returns table (id uuid, name varchar, famiglia varchar)
language sql security definer stable set search_path = public as $$
  select s.id, s.name, s.famiglia from maestranze_skills s order by s.famiglia, s.name;
$$;
revoke all on function public.maestranze_vocabolario() from public;
grant execute on function public.maestranze_vocabolario() to anon, authenticated;

create or replace function public.province_elenco()
returns table (provincia varchar, nome varchar, regione varchar)
language sql security definer stable set search_path = public as $$
  select p.provincia, p.nome, p.regione from province_regioni p order by p.nome;
$$;
revoke all on function public.province_elenco() from public;
grant execute on function public.province_elenco() to anon, authenticated;

-- ------------------------------------------------ conteggio pubblico (solo il numero)
-- La pagina di benvenuto mostra "sei tra i primi N": è un aggregato, non un dato
-- personale. SECURITY DEFINER perché la tabella è chiusa, ma restituisce SOLO
-- un intero — nessuna riga, nessun campo. Conta esclusivamente i CONFERMATI:
-- il numero che diamo ai capostipiti dev'essere di email verificate, non di moduli.
create or replace function public.maestranze_waitlist_count()
returns int language sql security definer stable set search_path = public as $$
  select count(*)::int from maestranze_waitlist where email_confirmed_at is not null;
$$;
revoke all on function public.maestranze_waitlist_count() from public;
grant execute on function public.maestranze_waitlist_count() to anon, authenticated;

-- ------------------------------------------------------------ conferma (token)
-- Double opt-in: il token arriva dall'email. SECURITY DEFINER perché la tabella è
-- chiusa; idempotente (ri-cliccare il link non rompe niente e non falsa il conteggio).
create or replace function public.maestranze_waitlist_confirm(p_token uuid)
returns table (nome varchar, gia_confermata boolean)
language plpgsql security definer set search_path = public as $$
declare v_row maestranze_waitlist%rowtype;
begin
  select * into v_row from maestranze_waitlist where confirm_token = p_token;
  if not found then raise exception 'token non valido'; end if;
  if v_row.email_confirmed_at is not null then
    return query select v_row.nome, true; return;
  end if;
  update maestranze_waitlist set email_confirmed_at = now() where id = v_row.id;
  return query select v_row.nome, false;
end $$;
revoke all on function public.maestranze_waitlist_confirm(uuid) from public;
grant execute on function public.maestranze_waitlist_confirm(uuid) to anon, authenticated;

-- --------------------------------------------------- dashboard admin (aggregati)
create or replace function public.maestranze_waitlist_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'totale',      (select count(*) from maestranze_waitlist),
    'confermati',  (select count(*) from maestranze_waitlist where email_confirmed_at is not null),
    'per_famiglia',(select coalesce(jsonb_agg(x order by x->>'n' desc), '[]'::jsonb) from (
                      select jsonb_build_object('famiglia', coalesce(s.famiglia, 'Non in elenco'),
                                                'n', count(*)) as x
                      from maestranze_waitlist w
                      left join maestranze_skills s on s.id = w.skill_id
                      group by coalesce(s.famiglia, 'Non in elenco')) t),
    'per_mestiere',(select coalesce(jsonb_agg(x order by x->>'n' desc), '[]'::jsonb) from (
                      select jsonb_build_object('mestiere',
                               coalesce(s.name, w.professione_altro, '—'), 'n', count(*)) as x
                      from maestranze_waitlist w
                      left join maestranze_skills s on s.id = w.skill_id
                      group by coalesce(s.name, w.professione_altro, '—')) t),
    'per_provincia',(select coalesce(jsonb_agg(x order by x->>'n' desc), '[]'::jsonb) from (
                      select jsonb_build_object('provincia', p.nome, 'regione', p.regione,
                                                'n', count(*)) as x
                      from maestranze_waitlist w
                      join province_regioni p on p.provincia = w.provincia
                      group by p.nome, p.regione) t),
    'per_source',  (select coalesce(jsonb_agg(x order by x->>'n' desc), '[]'::jsonb) from (
                      select jsonb_build_object('source', coalesce(source,'direct'),
                                                'n', count(*)) as x
                      from maestranze_waitlist group by coalesce(source,'direct')) t),
    'per_disponibilita', (select coalesce(jsonb_agg(x order by x->>'n' desc), '[]'::jsonb) from (
                      select jsonb_build_object('quando', d, 'n', count(*)) as x
                      from maestranze_waitlist, unnest(disponibilita) as d
                      group by d) t)
  ) into v;
  return v;
end $$;
revoke all on function public.maestranze_waitlist_stats() from anon, public;
grant execute on function public.maestranze_waitlist_stats() to authenticated;

comment on table public.maestranze_waitlist is
  'Lista d''attesa Maestranze. Tabella CHIUSA al client (nessuna policy anon/authenticated '
  'oltre la SELECT admin): scrive solo l''Edge Function con service_role.';
