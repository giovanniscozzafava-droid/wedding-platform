-- ============================================================================
-- A) ORIGINE DEL CONTATTO (statistiche): da dove arriva il lead/contatto.
--    Domanda nelle "domande" del preventivo → alimenta le statistiche provenienza.
--    Valori: SITO | PASSAPAROLA | PRO_ALTRO_SETTORE | SOCIAL | PLANFULLY | ALTRO
--    (null = non indicato). Nessun enum rigido: text + check morbido, facile da estendere.
-- B) CONSENSO "ricevere preventivi da altri professionisti collegati":
--    gate della feature "Suggerisci professionisti". Se false → non disponibile
--    (ma sbloccabile dal professionista). Default false.
-- ============================================================================

alter table public.quotes
  add column if not exists lead_source text,
  add column if not exists allow_supplier_suggestions boolean not null default false;

comment on column public.quotes.lead_source is 'Origine del contatto (statistiche): SITO | PASSAPAROLA | PRO_ALTRO_SETTORE | SOCIAL | PLANFULLY | ALTRO, o null.';
comment on column public.quotes.allow_supplier_suggestions is 'Il contatto è aperto a ricevere preventivi da altri professionisti collegati → abilita "Suggerisci professionisti". Default false, sbloccabile dal pro.';

-- Check morbido (accetta i valori previsti o null): evita typo, ma resta estendibile.
do $$ begin
  alter table public.quotes add constraint quotes_lead_source_chk
    check (lead_source is null or lead_source in ('SITO','PASSAPAROLA','PRO_ALTRO_SETTORE','SOCIAL','PLANFULLY','ALTRO'));
exception when duplicate_object then null; end $$;

-- Backfill origine da quote_origin dove deducibile (non sovrascrive scelte esistenti).
update public.quotes set lead_source = 'PLANFULLY'
  where lead_source is null and quote_origin = 'SUPPLIER_SUGGESTION';
update public.quotes set lead_source = 'SITO'
  where lead_source is null and quote_origin = 'SUPPLIER_PUBLIC_LEAD';

-- Backfill consenso: i preventivi che HANNO già suggerimenti collegati erano di
-- fatto abilitati → non spegnere una feature già in uso.
update public.quotes q set allow_supplier_suggestions = true
  where allow_supplier_suggestions = false
    and exists (select 1 from public.supplier_suggestions s
                where s.source_quote_id = q.id or s.quote_id = q.id);

-- Statistiche provenienza per il professionista loggato (per il cruscotto).
create or replace function public.lead_source_stats()
returns table(lead_source text, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(q.lead_source, 'NON_INDICATO') as lead_source, count(*) as n
  from public.quotes q
  where q.owner_id = auth.uid() and coalesce(q.archived_at::text, '') = ''
  group by 1
  order by n desc;
$$;
grant execute on function public.lead_source_stats() to authenticated, service_role;
