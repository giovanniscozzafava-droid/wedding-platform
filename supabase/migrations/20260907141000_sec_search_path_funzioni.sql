-- SEC-07 — funzioni senza `search_path` fissato.
--
-- Una funzione senza `set search_path` risolve i nomi con il search_path di chi
-- la chiama: se un utente riesce a creare un oggetto in uno schema che viene
-- prima (o in `pg_temp`), può far eseguire il proprio codice al posto di quello
-- previsto. Su una SECURITY DEFINER significa farlo eseguire con i privilegi
-- del proprietario. Qui sono soprattutto trigger e helper piccoli, ma il costo
-- della chiusura è nullo.
--
-- Le funzioni delle estensioni (btree_gist: gbt_*) NON si toccano: sono di
-- proprietà dell'estensione e un ALTER le scollegherebbe dal suo ciclo di vita.
do $$
declare
  v_nome text;
  v_sig  text;
begin
  foreach v_nome in array array[
    'assign_referral_code', 'block_mutation_immutable', 'build_default_contract_sections',
    'bump_post_comment_count', 'bump_post_like_count', 'calcola_markup_effettivo',
    'cleanup_lead_attempts', 'cleanup_suggest_attempts', 'fic_numerations_single_default',
    'filo_ago', 'filo_durata', 'filo_eur', 'filo_pct', 'filo_sezione',
    'fn_validate_evento_stato_transition', 'gen_referral_code', 'is_token_valid',
    'it_macro_area', 'mask_doc_number', 'platform_agreement', 'presenza_conteggio_testo',
    'quote_consent_clauses', 'quotes_validate_status_transition', 'reorder_services',
    'set_trial_on_supplier_signup', 'slugify', 'supplier_invites_normalize_email',
    'tg_quotes_bump_version', 'tg_set_doc_last4', 'touch_mood_boards',
    'trg_consenso_updated_at', 'trg_rate_updated_at', 'trg_scad_pagato_il',
    'trg_scad_updated_at', 'trg_sct_updated_at'
  ]
  loop
    for v_sig in
      select format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = v_nome
         and not exists (
           select 1 from pg_depend d
            where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
         )
    loop
      execute format('alter function %s set search_path = public, pg_temp', v_sig);
    end loop;
  end loop;
end$$;
