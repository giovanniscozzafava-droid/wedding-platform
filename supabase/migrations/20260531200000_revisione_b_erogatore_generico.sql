-- ============================================================================
-- REVISIONE B — Erogatore generico (capostipite come fornitore di se' stesso)
--
-- Allarghiamo la semantica della FK `services.fornitore_id`: NON e' piu' solo
-- un utente con role='FORNITORE', ma in generale l'EROGATORE del servizio,
-- che puo' essere:
--   - un fornitore esterno (role='FORNITORE')
--   - il capostipite stesso (role='WEDDING_PLANNER' o 'LOCATION') quando
--     pubblica servizi propri di organizzazione / coordinamento / consulenza
--     o un servizio "tutto incluso" della location.
--
-- Cosi' un WP/LOCATION puo' inserire una voce in preventivo dove e' lui stesso
-- l'erogatore, ottenendo automaticamente NO RICARICO (line_client = line_cost).
--
-- Cosa NON cambia (riuso schema esistente):
--   - services.fornitore_id (FK -> profiles.id) — riutilizzata, semantica
--     allargata via commento.
--   - quote_items.supplier_id (FK -> profiles.id) — riutilizzata.
--   - RLS su services (services_select_owner / services_modify_owner) gia'
--     basate su fornitore_id = auth.uid(): NESSUNA restrizione a role
--     'FORNITORE' esiste oggi. Quindi WP/LOCATION possono gia' INSERT su
--     services con fornitore_id = auth.uid(). (verificato in
--     20260521150200_rls.sql e in 20260526170000_wp_services_categories.sql
--     dove sono state aggiunte categorie standard 'wedding_planner').
--
-- Cosa AGGIUNGIAMO qui:
--   1) colonna quote_items.erogatore_e_capostipite (boolean, default false)
--   2) commento sulla colonna services.fornitore_id (semantica allargata)
--   3) override del trigger di calcolo: se erogatore_e_capostipite = true,
--      ignora item_markup_percent e quote_supplier_markups e default markup
--      (line_client = line_cost, no ricarico).
-- ============================================================================

-- 1) Nuova colonna su quote_items (idempotente)
alter table quote_items
  add column if not exists erogatore_e_capostipite boolean not null default false;

comment on column quote_items.erogatore_e_capostipite is
  'true quando l''erogatore della voce e'' il capostipite stesso (WP/LOCATION fornitore di se'' stesso): comporta no-ricarico — line_client = line_cost.';

-- 2) Allarga semantica della FK su services
comment on column services.fornitore_id is
  'erogatore del servizio — fornitore esterno (role=FORNITORE) OR capostipite stesso (role=WEDDING_PLANNER|LOCATION) che offre servizi propri di organizzazione/coordinamento/all-inclusive.';

-- 3) Override del trigger di ricalcolo line_cost/line_client.
--    Se erogatore_e_capostipite = true → no ricarico.
--    Altrimenti, comportamento esistente (item_markup -> supplier_markup ->
--    quote.default_markup_percent), mantenuto.
create or replace function quote_items_recalc_lines_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base       numeric;
  v_mod        jsonb;
  v_type       text;
  v_value      numeric;
  v_markup_pct numeric;
  v_include    boolean;
begin
  v_base := coalesce(new.snapshot_price, 0) * coalesce(new.quantity, 0);

  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type  := v_mod->>'type';
      v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then
        v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then
        v_base := v_base + v_value;
      end if;
    end loop;
  end if;

  -- Optional non selezionato → escluso dai totali (semantica wedding_suite)
  v_include := not coalesce(new.is_optional, false) or coalesce(new.selected_by_client, false);
  if not v_include then v_base := 0; end if;

  new.line_cost := round(v_base, 2);

  -- REVISIONE B: capostipite come erogatore di se' stesso → no ricarico
  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_client := new.line_cost;
  else
    v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
    new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);
  end if;

  return new;
end$$;

-- Il trigger trg_qitems_recalc_lines (BEFORE INSERT OR UPDATE) e' gia'
-- agganciato a questa funzione (vedi 20260521150700_wedding_suite.sql):
-- l'override e' sufficiente — niente da ri-creare.
