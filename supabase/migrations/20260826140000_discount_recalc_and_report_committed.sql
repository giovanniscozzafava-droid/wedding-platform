-- ════════════════════════════════════════════════════════════════════════════
-- CIFRE NON VERITIERE NELLE STATISTICHE — due cause, entrambe corrette qui:
-- 1) Cambiare lo SCONTO totale (total_discount_percent/amount) NON ricalcolava i
--    totali: c'erano trigger recalc su quotes per DATA e DISTANZA, ma non per lo
--    sconto → total_client/total_client_selected restavano al valore pre-sconto
--    (es. luglio 2490 invece di 2290). Aggiungo il trigger mancante.
-- 2) quotes_monthly_report sommava total_client (TUTTE le voci) invece del valore
--    IMPEGNATO R1 (voci scelte dal cliente): usa total_client_selected se >0,
--    altrimenti total_client. Così "somma solo ciò che il cliente ha scelto",
--    scontato, coerente con atto/anteprima/editor.
-- + Backfill una-tantum: ricalcolo i preventivi con uno sconto (fix dei valori stantii).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Trigger recalc mancante sullo SCONTO (specchio di trg_quote_recalc_on_distance).
create or replace function public.tg_quote_recalc_on_discount()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.quotes_recalc_totals(new.id);
  return new;
end$$;

drop trigger if exists trg_quote_recalc_on_discount on public.quotes;
create trigger trg_quote_recalc_on_discount
  after update of total_discount_percent, total_discount_amount on public.quotes
  for each row execute function public.tg_quote_recalc_on_discount();

-- 2) Report: usa il valore IMPEGNATO (selezionato se >0, altrimenti totale).
create or replace function public.quotes_monthly_report()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(r order by r->>'ym' desc)
    from (
      select jsonb_build_object(
        'ym',       to_char(date_trunc('month', coalesce(sent_at, created_at)), 'YYYY-MM'),
        'year',     extract(year  from coalesce(sent_at, created_at))::int,
        'month',    extract(month from coalesce(sent_at, created_at))::int,
        'sent',     count(*),
        'accepted', count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')),
        'rejected', count(*) filter (where status = 'RIFIUTATO'),
        'pending',  count(*) filter (where status not in ('ACCETTATO','CONVERTITO_IN_CONTRATTO','RIFIUTATO')),
        'accepted_value', coalesce(sum(
            case when coalesce(total_client_selected,0) > 0 then total_client_selected else coalesce(total_client,0) end
          ) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')), 0)
      ) as r
      from public.quotes
      where owner_id = v_uid
        and (sent_at is not null or status <> 'BOZZA')
      group by date_trunc('month', coalesce(sent_at, created_at)),
               extract(year from coalesce(sent_at, created_at)),
               extract(month from coalesce(sent_at, created_at))
    ) s
  ), '[]'::jsonb));
end$$;

-- 3) Backfill: ricalcola i preventivi con uno sconto impostato (valori stantii pre-trigger).
do $$
declare r record;
begin
  for r in select id from public.quotes
           where coalesce(total_discount_amount,0) <> 0 or coalesce(total_discount_percent,0) <> 0 loop
    perform public.quotes_recalc_totals(r.id);
  end loop;
end $$;
