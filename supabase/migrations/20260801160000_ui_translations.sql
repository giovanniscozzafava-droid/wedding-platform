-- Cache CONDIVISA delle traduzioni UI (auto-traduzione a runtime). La prima persona che apre una
-- pagina in una lingua "paga" la traduzione AI; tutti gli altri la leggono da qui, istantanea.
-- Chiave: (lingua, md5 del testo sorgente italiano) → colonna generata src_hash (il testo puo' essere lungo).
create table if not exists public.ui_translations (
  lang text not null,
  source text not null,
  src_hash text generated always as (md5(source)) stored,
  translated text not null,
  updated_at timestamptz not null default now(),
  unique (lang, src_hash)
);

alter table public.ui_translations enable row level security;
-- Lettura pubblica (serve anche al sito matrimonio per gli ospiti, non autenticati).
drop policy if exists "ui_tr_read_all" on public.ui_translations;
create policy "ui_tr_read_all" on public.ui_translations for select using (true);
-- Scrittura solo lato server (edge con service role): nessuna policy di insert/update.

-- Legge in blocco le traduzioni note per una lingua. Ritorna un oggetto { source: translated }.
create or replace function public.get_ui_translations(p_lang text, p_sources text[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(source, translated), '{}'::jsonb)
  from public.ui_translations
  where lang = p_lang
    and src_hash = any (array(select md5(x) from unnest(p_sources) x));
$$;
grant execute on function public.get_ui_translations(text, text[]) to anon, authenticated;
