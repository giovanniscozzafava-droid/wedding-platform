-- FASE 4.2 — Vista di riconciliazione menu / ospiti + RPC allineamento.
--
-- L'idea: confrontare il numero di ospiti "YES" sull'evento col numero di
-- coperti previsti dal preventivo (somma di quote_items "PER_GUEST"). Quando
-- si scopre delta != 0, la coppia/wp puo` allineare la quantita` delle voci
-- menu al conteggio ospiti reale con un click.
--
-- Note schema reali (da migrazioni esistenti):
--   - `quote_items.unit_snapshot` e` un enum `service_unit` ('PEZZO','PERSONA','ORA','EVENTO').
--   - Il moltiplicatore "per ospite" e` codificato in `quote_items.quantity_basis`
--     (enum `quantity_basis`: 'FLAT','PER_GUEST','PER_TABLE','PER_HOUR').
--   - L'allineamento "menu al conteggio" usa `quantity_basis = 'PER_GUEST'`
--     (semantica reale = "una porzione per ogni invitato"). La traccia di
--     fase 4.2 lo chiama "unit_snapshot='PER_GUEST'" per brevita`: nel codice
--     SQL usiamo la colonna reale `quantity_basis` per evitare cast/confusione.

-- 1. View v_riconciliazione_evento ------------------------------------------

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
  'Riconciliazione menu vs ospiti per evento: confronta ospiti YES con somma quote_items PER_GUEST. delta = count_menu - totale_ospiti_yes. RLS rispettata via security_invoker.';

-- 2. RPC riconciliazione_allinea_menu(p_entry_id) ----------------------------
-- Setta quote_items.quantity = totale_ospiti_yes per tutte le voci
-- `quantity_basis = 'PER_GUEST'` del preventivo dell'evento.
-- Solo owner del calendar_entry o admin puo` chiamarla.

create or replace function public.riconciliazione_allinea_menu(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry         record;
  v_yes           int;
  v_updated       int := 0;
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

  -- Allineamento. quantity ha check > 0 → se v_yes = 0 lasciamo a 1.
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
  'Allinea quote_items.quantity (basis PER_GUEST) al numero ospiti YES dell''evento. Solo owner calendar_entry / admin.';

revoke all on function public.riconciliazione_allinea_menu(uuid) from public;
grant execute on function public.riconciliazione_allinea_menu(uuid) to authenticated;

-- 3. Grants vista (security_invoker rispetta RLS chiamante) ------------------
grant select on public.v_riconciliazione_evento to authenticated;
