-- DIAG (read-only): perché "Preventivo non trovato" quando si compila il contratto con AI.
do $$
declare v_qid uuid; v_exists boolean; v_cols text;
begin
  -- colonne che l'edge seleziona da quotes: se una manca, la select va in errore → data null → quote_not_found
  select string_agg(column_name, ',') into v_cols from information_schema.columns
   where table_schema='public' and table_name='quotes'
     and column_name in ('id','owner_id','title','client_name','client_email','event_date','event_location','event_kind','guest_count','total_client','client_country');
  raise notice 'DIAG colonne quotes presenti (di quelle richieste dall''edge): %', v_cols;

  select quote_id into v_qid from public.contracts
    where title ilike '%Napoleone%' order by created_at desc limit 1;
  raise notice 'DIAG contratto Napoleone: quote_id = %', v_qid;
  if v_qid is null then raise notice 'DIAG → quote_id NULL: il contratto non è collegato ad alcun preventivo'; return; end if;
  select exists(select 1 from public.quotes where id = v_qid) into v_exists;
  raise notice 'DIAG → il preventivo % esiste in quotes? %', v_qid, v_exists;
end $$;
