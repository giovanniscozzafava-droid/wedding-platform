-- Modello di business per matrimonio: due varianti commerciali
-- GLOBAL    = WP/Location contrattualizza con sposi un unico contratto. Sub-contratta
--             ogni fornitore in proprio. Sposi pagano solo a WP.
-- BROKER    = WP/Location organizza ma sposi firmano contratti diretti con ogni
--             fornitore. WP eventualmente prende commissione organizzativa separata.
--
-- Default GLOBAL (comportamento attuale).

alter table calendar_entries
  add column if not exists business_model text not null default 'GLOBAL'
    check (business_model in ('GLOBAL', 'BROKER'));

comment on column calendar_entries.business_model is
  'GLOBAL: WP firma un contratto unico con sposi e sub-contratta fornitori. BROKER: sposi firmano contratti separati con ogni fornitore, WP coordina.';
