-- ============================================================================
-- P3 — Stati disponibilità evoluti (additivi, retrocompatibili)
-- I valori storici AVAILABLE/BUSY/TENTATIVE restano; l'UI continua a mapparli.
-- I nuovi valori abilitano "opziona data" e blocchi qualificati.
-- (ALTER TYPE ADD VALUE deve stare in una migration separata dall'uso.)
-- ============================================================================

alter type public.supplier_avail_status add value if not exists 'OPTIONED';
alter type public.supplier_avail_status add value if not exists 'IN_NEGOTIATION';
alter type public.supplier_avail_status add value if not exists 'BLOCKED_BY_ACCEPTED_QUOTE';
alter type public.supplier_avail_status add value if not exists 'BLOCKED_BY_SIGNED_CONTRACT';
alter type public.supplier_avail_status add value if not exists 'MANUAL_BUSY';
alter type public.supplier_avail_status add value if not exists 'UNAVAILABLE';
