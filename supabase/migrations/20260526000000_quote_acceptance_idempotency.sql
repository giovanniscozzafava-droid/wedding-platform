-- ============================================================================
-- CRITICAL HOTFIX: quote-accept-sign permetteva doppia firma in race condition.
-- Sposo che doppio-clicca "Firma" -> 5 quote_acceptances row + 5 PDF storage +
-- 5 email cliente + 5 audit-trail FES. Implicazioni legali (CAD art.20 +
-- art. 1326 c.c.): un solo atto giuridicamente vincolante e' previsto.
--
-- Defence in depth:
-- 1. Partial unique index su quote_acceptances per (quote_id, quote_revision)
--    quando consent_terms+consent_privacy True -> impedisce duplicate inserts.
-- 2. La edge function deve gia' usare atomic UPDATE...WHERE status='INVIATO'
--    come gate (modifica funzione separata).
-- ============================================================================

-- Cleanup eventuali duplicati storici (race testati durante audit M).
-- Manteniamo la PRIMA acceptance per (quote_id, quote_revision); le successive
-- vengono spostate in tabella audit per traccia, poi rimosse.
create table if not exists quote_acceptances_audit (
  like quote_acceptances including all,
  audit_reason text,
  audit_at timestamptz not null default now()
);
alter table quote_acceptances_audit disable row level security;

with ranked as (
  select id, quote_id, quote_revision,
         row_number() over (partition by quote_id, quote_revision
                            order by created_at asc, id asc) as rn
    from quote_acceptances
   where consent_terms = true and consent_privacy = true
)
insert into quote_acceptances_audit
  select qa.*, 'duplicate_race_cleanup', now()
    from quote_acceptances qa
    join ranked r on r.id = qa.id
   where r.rn > 1;

delete from quote_acceptances qa
 using (
   select id from quote_acceptances qa2
     join (
       select quote_id, quote_revision
         from quote_acceptances
        where consent_terms = true and consent_privacy = true
        group by quote_id, quote_revision
       having count(*) > 1
     ) dups on dups.quote_id = qa2.quote_id and dups.quote_revision = qa2.quote_revision
     where qa2.id not in (
       select id from (
         select id, row_number() over (partition by quote_id, quote_revision
                                       order by created_at asc, id asc) as rn
           from quote_acceptances
          where consent_terms = true and consent_privacy = true
       ) ranked
       where rn = 1
     )
 ) victims
 where qa.id = victims.id;

create unique index if not exists uq_qa_quote_revision
  on quote_acceptances(quote_id, quote_revision)
  where consent_terms = true and consent_privacy = true;

comment on index uq_qa_quote_revision is
  'Impedisce doppia accettazione per stessa revisione di preventivo (race condition su quote-accept-sign): solo una row con entrambi i consensi per (quote_id, revision).';
