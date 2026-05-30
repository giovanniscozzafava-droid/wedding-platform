-- ============================================================================
-- REVISIONE D — Location capostipite-erogatore con catalogo proprio
--                (menu + extra) + riconciliazione menu/invitati universale.
--
-- Contesto:
--   - Dopo Task B (revisione_b_erogatore_generico), una LOCATION puo' inserire
--     righe in `services` con fornitore_id = auth.uid() (RLS permette qualsiasi
--     role, vedi services_modify_owner). Quindi pubblica catalogo proprio.
--   - quote_items.erogatore_e_capostipite (bool) disattiva il ricarico quando
--     l'erogatore della voce e' il capostipite stesso (line_client = line_cost).
--   - Per i "menu" tipici della location l'unita' di misura e' PERSONA e il
--     moltiplicatore reale e' quantity_basis = 'PER_GUEST'.
--
-- Verifica fatta sui file esistenti:
--   * 20260530410000_fase4_riconciliazione.sql:
--       - view v_riconciliazione_evento usa quote_items.quantity_basis='PER_GUEST'
--         (NESSUN filtro per role del supplier).
--       - RPC riconciliazione_allinea_menu(uuid) aggiorna
--         where quote_id = ... and quantity_basis = 'PER_GUEST'
--         (NESSUN filtro per role del supplier).
--     => Funziona gia' anche per servizi propri del capostipite (Location).
--
-- Cosa fa questa migrazione:
--   1) Ridichiara view + RPC con CREATE OR REPLACE (stesso comportamento) per
--      AGGIUNGERE commenti che documentano esplicitamente l'uso anche per
--      l'erogatore = capostipite (Location/WP).
--   2) Aggiorna commento su quote_items.erogatore_e_capostipite per
--      esplicitare l'interazione con la riconciliazione PER_GUEST.
--
-- Idempotente: create or replace + comment on. Nessuna alterazione di schema
-- ne' di dati esistenti.
-- ============================================================================

-- 1. View riconciliazione — riemissione con stesso codice + commento esplicito
-- ----------------------------------------------------------------------------

drop view if exists public.v_riconciliazione_evento;
create view public.v_riconciliazione_evento
with (security_invoker = true)
as
with
  guests as (
    select
      eg.entry_id,
      sum(case when eg.rsvp = 'YES'     then coalesce(eg.party_size, 1) else 0 end)::int as totale_ospiti_yes,
      sum(case when eg.rsvp = 'PENDING' then coalesce(eg.party_size, 1) else 0 end)::int as totale_ospiti_pending
    from public.event_guests eg
    group by eg.entry_id
  ),
  menu as (
    -- NB: nessun filtro sul ruolo dell'erogatore (qi.supplier_id). La
    -- semantica e' puramente "voci a porzione" -> quantity_basis = 'PER_GUEST'.
    -- Cosi' la riconciliazione vale anche per i servizi propri del
    -- capostipite (Location/WP che eroga il menu).
    select
      ce.id as entry_id,
      coalesce(sum(qi.quantity)::numeric, 0) as count_menu_for_guest,
      coalesce(sum(qi.line_client)::numeric, 0) as importo_totale_quote,
      coalesce(avg(qi.snapshot_price) filter (
        where qi.quantity_basis = 'PER_GUEST'
      )::numeric, 0) as importo_menu_per_guest
    from public.calendar_entries ce
    left join public.quote_items qi
      on qi.quote_id = ce.quote_id
     and qi.quantity_basis = 'PER_GUEST'
    group by ce.id
  )
select
  ce.id as entry_id,
  coalesce(g.totale_ospiti_yes, 0)        as totale_ospiti_yes,
  coalesce(g.totale_ospiti_pending, 0)    as totale_ospiti_pending,
  coalesce(m.count_menu_for_guest, 0)     as count_menu_for_guest,
  (coalesce(m.count_menu_for_guest, 0) - coalesce(g.totale_ospiti_yes, 0))::numeric as delta,
  coalesce(m.importo_menu_per_guest, 0)   as importo_menu_per_guest,
  coalesce(m.importo_totale_quote, 0)     as importo_totale_quote
from public.calendar_entries ce
left join guests g on g.entry_id = ce.id
left join menu m   on m.entry_id = ce.id;

comment on view public.v_riconciliazione_evento is
  'Riconciliazione menu vs ospiti per evento. Confronta ospiti YES con somma quote_items aventi quantity_basis=PER_GUEST. NESSUN filtro per ruolo dell''erogatore: funziona anche per servizi propri del capostipite (Location/WP che eroga il menu). RLS rispettata via security_invoker.';

-- 2. RPC allineamento — riemissione con stesso codice + commento esplicito
-- ----------------------------------------------------------------------------

create or replace function public.riconciliazione_allinea_menu(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry   record;
  v_yes     int;
  v_updated int := 0;
begin
  -- Authz: owner del calendar_entry o admin.
  select id, owner_id, quote_id
    into v_entry
    from public.calendar_entries
   where id = p_entry_id;
  if not found then
    raise exception 'evento non trovato';
  end if;
  if v_entry.owner_id <> auth.uid() and not public.is_admin() then
    raise exception 'non autorizzato' using errcode = '42501';
  end if;
  if v_entry.quote_id is null then
    return jsonb_build_object('updated', 0, 'reason', 'no_quote');
  end if;

  -- Conteggio ospiti YES.
  select coalesce(sum(case when rsvp = 'YES' then coalesce(party_size, 1) else 0 end), 0)::int
    into v_yes
    from public.event_guests
   where entry_id = p_entry_id;

  -- Allineamento. quantity ha check > 0 -> se v_yes = 0 lasciamo a 1.
  -- NB: nessun filtro sul ruolo dell'erogatore (qi.supplier_id). Vale per voci
  -- "a porzione" indipendentemente da chi le eroga: fornitore esterno OR il
  -- capostipite stesso (Location/WP) che pubblica il proprio menu PER_GUEST.
  update public.quote_items
     set quantity = greatest(v_yes, 1)
   where quote_id = v_entry.quote_id
     and quantity_basis = 'PER_GUEST';

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'updated', v_updated,
    'totale_ospiti_yes', v_yes,
    'quote_id', v_entry.quote_id
  );
end;
$$;

comment on function public.riconciliazione_allinea_menu(uuid) is
  'Allinea quote_items.quantity (basis PER_GUEST) al numero ospiti YES dell''evento. NESSUN filtro sul ruolo del supplier_id: la ricezione PER_GUEST funziona anche per servizi propri del capostipite (Location/WP che eroga il menu). Solo owner calendar_entry / admin.';

revoke all on function public.riconciliazione_allinea_menu(uuid) from public;
grant execute on function public.riconciliazione_allinea_menu(uuid) to authenticated;

grant select on public.v_riconciliazione_evento to authenticated;

-- 3. Commento esteso su quote_items.erogatore_e_capostipite (best-effort:
--    skip se la colonna non esiste — la creiamo in Task B; questa migrazione
--    non deve fallire se applicata in stato parziale).
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'quote_items'
       and column_name = 'erogatore_e_capostipite'
  ) then
    execute $cmt$
      comment on column public.quote_items.erogatore_e_capostipite is
        'true quando l''erogatore della voce e'' il capostipite stesso (WP/LOCATION fornitore di se'' stesso): comporta no-ricarico (line_client = line_cost). Compatibile con la riconciliazione menu/invitati: una voce con erogatore_e_capostipite=true e quantity_basis=PER_GUEST viene comunque allineata da riconciliazione_allinea_menu (la riconciliazione si basa solo su quantity_basis, non sul ruolo dell''erogatore).'
    $cmt$;
  end if;
end$$;
