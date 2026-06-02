-- ============================================================================
-- "Lavori da confermare" per PREVENTIVO INTERO (non per singola voce).
-- Il fornitore non conferma l'album o il servizio fotografico uno per uno:
-- dichiara la propria PRESENZA sull'intero preventivo → Si` / No / Forse.
--   * SI`   → partecipa: tutte le sue voci risultano confermate
--             (supplier_confirmed_at), sblocca il budget del capostipite.
--   * NO    → non partecipa: voci non confermate (budget non pronto).
--   * FORSE → in valutazione: voci non confermate (budget non pronto).
-- ----------------------------------------------------------------------------

-- 1) Stato di presenza tri-stato sulla riga (fonte di verita` per voce).
alter table public.quote_items
  add column if not exists supplier_presence text
    check (supplier_presence in ('SI', 'NO', 'FORSE'));

comment on column public.quote_items.supplier_presence is
  'Presenza dichiarata dal fornitore sul preventivo: SI/NO/FORSE. SI => supplier_confirmed_at valorizzato.';

-- 2) RPC: il fornitore imposta la presenza su TUTTE le proprie voci del preventivo.
create or replace function public.supplier_set_quote_presence(p_quote_id uuid, p_status text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer := 0;
  v_evento uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if p_status not in ('SI', 'NO', 'FORSE') then
    raise exception 'invalid_status';
  end if;

  -- Deve esistere almeno una voce di QUESTO fornitore in QUESTO preventivo.
  if not exists (
    select 1 from public.quote_items
     where quote_id = p_quote_id and supplier_id = v_uid
  ) then
    raise exception 'forbidden_not_supplier';
  end if;

  update public.quote_items qi set
    supplier_presence     = p_status,
    supplier_confirmed_at = case when p_status = 'SI' then coalesce(qi.supplier_confirmed_at, now()) else null end,
    supplier_confirmed_by = case when p_status = 'SI' then v_uid else null end,
    updated_at            = now()
  where qi.quote_id = p_quote_id and qi.supplier_id = v_uid;
  get diagnostics v_n = row_count;

  -- Chiudi le notifiche pendenti di conferma voce per questo fornitore/evento.
  begin
    select id into v_evento from public.calendar_entries where quote_id = p_quote_id limit 1;
    update public.notifiche
       set stato = 'DONE', letto_il = coalesce(letto_il, now())
     where destinatario_id = v_uid
       and tipo = 'FORNITORE_CONFERMA_VOCE'
       and (evento_id = v_evento or link_action like '%' || p_quote_id::text || '%')
       and stato = 'PENDING';
  exception when others then null;
  end;

  return v_n;
end$$;

grant execute on function public.supplier_set_quote_presence(uuid, text) to authenticated;

-- 3) Backfill: voci gia` confermate => presenza SI (coerenza storica).
update public.quote_items
   set supplier_presence = 'SI'
 where supplier_confirmed_at is not null
   and supplier_presence is null;
