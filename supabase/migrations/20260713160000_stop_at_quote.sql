-- STOP ALLA FIRMA DEL PREVENTIVO.
-- Molti professionisti non usano il contratto e si fermano al preventivo firmato (che vale come accordo).
-- Flag di default sul profilo: se true, di norma NON si genera il contratto; il pro può comunque
-- generarne uno per il singolo preventivo (l'azione "Genera contratto" resta disponibile).
alter table public.profiles
  add column if not exists default_stop_at_quote boolean not null default false;

comment on column public.profiles.default_stop_at_quote is
  'Se true il pro di norma si ferma alla firma del preventivo (nessun contratto). Puo comunque generare un contratto per singolo preventivo.';
