-- ============================================================================
-- Forma giuridica del fornitore
-- ----------------------------------------------------------------------------
-- Un fornitore puo essere persona fisica (Ditta individuale), una SRL/SRLS,
-- una SPA, una SAS/SNC, una ASD/Associazione (potrebbe non avere P.IVA), o
-- una cooperativa. Il campo serve a contestualizzare la P.IVA opzionale e a
-- popolare correttamente i contratti.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'legal_form') then
    create type legal_form as enum (
      'INDIVIDUAL',     -- Ditta individuale / Libero professionista
      'SRL',
      'SRLS',
      'SPA',
      'SAS',
      'SNC',
      'COOPERATIVE',    -- Cooperativa
      'ASSOCIATION',    -- Associazione / ASD (P.IVA spesso non richiesta)
      'OTHER'
    );
  end if;
end$$;

alter table profiles
  add column if not exists legal_form legal_form;

comment on column profiles.legal_form is
  'Forma giuridica del fornitore. ASSOCIATION puo non avere vat_number.';
