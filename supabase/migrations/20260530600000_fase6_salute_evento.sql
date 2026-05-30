-- FASE 6.1 — Salute evento
--
-- View `v_salute_evento` aggrega, per ogni calendar_entry, gli indicatori
-- che servono al badge "salute evento":
--   - evento_stato  : stato del workflow (FASE 1.3)
--   - giorni_alla_data : differenza in giorni fra date_from e CURRENT_DATE
--                        (negativo se evento gia` passato)
--   - blocchi_aperti_count : numero di notifiche PENDING con priorita >= 7
--                            collegate all'evento. Sono le "azioni che
--                            bloccano" il workflow (firma, riconferma data,
--                            dropout fornitore, etc.).
--   - ultimo_audit_il : timestamp dell'ultima riga in audit_log che ha
--                       record_id = entry.id (qualunque tabella, qualunque
--                       operazione). Utile per "vivacita`" e drift detection.
--   - salute_label  : OTTIMA | OK | ATTENZIONE | CRITICA
--                     (regole sotto, deterministiche e monotone).
--
-- La view e` security_invoker via grant: leggono solo gli utenti che hanno
-- accesso al calendar_entry secondo le sue RLS (Supabase delega).
--
-- Regole salute_label:
--   - CRITICA   : evento_stato='ANNULLATO' OR blocchi_aperti_count > 3
--                 OR (giorni_alla_data BETWEEN 0 AND 7 AND blocchi_aperti_count > 0)
--   - ATTENZIONE: blocchi_aperti_count BETWEEN 1 AND 3
--                 OR (giorni_alla_data BETWEEN 0 AND 30 AND evento_stato NOT IN ('CHECKLIST','SVOLTO','ANNULLATO'))
--   - OTTIMA    : blocchi_aperti_count = 0 AND evento_stato = 'SVOLTO'
--   - OK        : tutti gli altri casi (default sano)

create or replace view public.v_salute_evento as
with blocchi as (
  select
    n.evento_id as entry_id,
    count(*)::int as blocchi_aperti_count
  from public.notifiche n
  where n.stato = 'PENDING'
    and n.priorita >= 7
    and n.evento_id is not null
  group by n.evento_id
),
ultimo_audit as (
  select
    a.record_id as entry_id,
    max(a.eseguito_il) as ultimo_audit_il
  from public.audit_log a
  where a.record_id is not null
  group by a.record_id
)
select
  ce.id                                                          as entry_id,
  ce.evento_stato                                                as evento_stato,
  (ce.date_from - current_date)::int                             as giorni_alla_data,
  coalesce(b.blocchi_aperti_count, 0)::int                       as blocchi_aperti_count,
  ua.ultimo_audit_il                                             as ultimo_audit_il,
  (
    case
      when ce.evento_stato = 'ANNULLATO' then 'CRITICA'
      when coalesce(b.blocchi_aperti_count, 0) > 3 then 'CRITICA'
      when (ce.date_from - current_date) between 0 and 7
           and coalesce(b.blocchi_aperti_count, 0) > 0 then 'CRITICA'
      when coalesce(b.blocchi_aperti_count, 0) between 1 and 3 then 'ATTENZIONE'
      when (ce.date_from - current_date) between 0 and 30
           and ce.evento_stato not in ('CHECKLIST','SVOLTO','ANNULLATO') then 'ATTENZIONE'
      when coalesce(b.blocchi_aperti_count, 0) = 0
           and ce.evento_stato = 'SVOLTO' then 'OTTIMA'
      else 'OK'
    end
  )::text                                                         as salute_label
from public.calendar_entries ce
left join blocchi b on b.entry_id = ce.id
left join ultimo_audit ua on ua.entry_id = ce.id;

comment on view public.v_salute_evento is
  'FASE 6.1: indicatori di salute per evento (calendar_entry). Aggrega evento_stato, giorni alla data, blocchi aperti (notifiche PENDING priorita>=7), ultimo audit, e calcola salute_label OTTIMA/OK/ATTENZIONE/CRITICA. Leggibile solo se l''utente puo` leggere il calendar_entry (RLS upstream).';

-- Accesso lettura: lo stesso pattern usato per le altre view (anon/authenticated)
grant select on public.v_salute_evento to anon, authenticated;
