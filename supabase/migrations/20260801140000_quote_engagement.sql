-- Quando il cliente inizia a valutare un preventivo (clic su una voce: ACCETTATO/FORSE), il
-- professionista riceve notifica + email UNA sola volta. Colonna-flag per de-duplicare l'avviso.
alter table public.quotes add column if not exists engagement_notified_at timestamptz;
