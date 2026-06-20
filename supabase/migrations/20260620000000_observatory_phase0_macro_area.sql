-- OSSERVATORIO · FASE 0 (audit schema) — UNICO pezzo eseguibile ora.
-- NON è l'Osservatorio: nessuna tabella snapshot, nessuna vista materializzata, nessuna UI,
-- nessun consenso. Aggiunge solo il PRIMITIVO mancante per poter aggregare DOMANI a livello
-- macro-area (DECISIONE D3): la derivazione provincia ISO → ripartizione geografica ISTAT.
-- Funzione pura/immutable, senza accesso a dati: nessuna superficie RLS, nessun rischio.
-- Il resto del modulo resta CONGELATO dietro il gate di Fase 1.

create or replace function public.it_macro_area(p_province text)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(p_province)) = any (array[
      'TO','VC','NO','CN','AT','AL','BI','VB','AO','IM','SV','GE','SP',
      'VA','CO','SO','MI','BG','BS','PV','CR','MN','LC','LO','MB'])                 then 'NORD_OVEST'
    when upper(trim(p_province)) = any (array[
      'TN','BZ','VR','VI','BL','TV','VE','PD','RO','UD','GO','TS','PN',
      'PC','PR','RE','MO','BO','FE','RA','FC','RN'])                                 then 'NORD_EST'
    when upper(trim(p_province)) = any (array[
      'MS','LU','PT','FI','LI','PI','AR','SI','GR','PO','PG','TR',
      'PU','AN','MC','AP','FM','VT','RI','RM','LT','FR'])                            then 'CENTRO'
    when upper(trim(p_province)) = any (array[
      'AQ','TE','PE','CH','CB','IS','CE','BN','NA','AV','SA',
      'FG','BA','TA','BR','LE','BT','PZ','MT','CS','CZ','RC','KR','VV'])             then 'SUD'
    when upper(trim(p_province)) = any (array[
      'TP','PA','ME','AG','CL','EN','CT','RG','SR',
      'SS','NU','CA','OR','SU','OT','OG','VS','CI'])                                 then 'ISOLE'
    else null
  end;
$$;

comment on function public.it_macro_area(text) is
  'Osservatorio Fase 0: provincia ISO (es. CS, MI) → ripartizione geografica ISTAT '
  '(NORD_OVEST/NORD_EST/CENTRO/SUD/ISOLE). Pura, immutable. Abilita l''aggregazione geografica '
  'a macro-area (D3) senza esporre dati. Il supplier_geo e gli snapshot sono Fase 1 (gated).';
