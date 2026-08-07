-- ============================================================================
-- BUGFIX stress test:
--  BX-A-3  Maggiorazione trasferta senza vincoli: free_km/per_km potevano
--          essere negativi (sconto occulto lato cliente o soglia negativa che
--          gonfia la trasferta) e distance_km del preventivo negativo.
--          → CHECK di non-negatività + bonifica dei valori esistenti.
--  BX-F-2  supplier_set_quote_presence non guardava lo stato del preventivo:
--          il fornitore poteva dichiarare la presenza su BOZZE non ancora
--          inviate o su preventivi già accettati/convertiti (dis-confermando
--          voci di un contratto firmato). → si accetta solo su INVIATO vivo.
-- ============================================================================

-- --- BX-A-3: bonifica + vincoli sulla trasferta -----------------------------
update public.price_surcharges set free_km = 0    where free_km < 0;
update public.price_surcharges set per_km  = null  where per_km  < 0;
update public.quotes            set distance_km = null where distance_km < 0;

alter table public.price_surcharges drop constraint if exists price_surcharges_free_km_nonneg;
alter table public.price_surcharges add  constraint price_surcharges_free_km_nonneg
  check (free_km >= 0);

alter table public.price_surcharges drop constraint if exists price_surcharges_per_km_nonneg;
alter table public.price_surcharges add  constraint price_surcharges_per_km_nonneg
  check (per_km is null or per_km >= 0);

alter table public.quotes drop constraint if exists quotes_distance_km_nonneg;
alter table public.quotes add  constraint quotes_distance_km_nonneg
  check (distance_km is null or distance_km >= 0);

-- Ricalcola i soli preventivi con trasferta (gli unici toccati da eventuali bonifiche).
do $$ declare r record; begin
  for r in select id from public.quotes where distance_km is not null loop
    perform public.quotes_recalc_totals(r.id);
  end loop;
end $$;

-- --- BX-F-2: guardia di stato sulla presenza --------------------------------
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

  -- Il preventivo dev'essere ancora "in gioco": inviato dal capostipite e non
  -- archiviato. Su bozze (non inviate) o accettati/convertiti/rifiutati la
  -- presenza non si tocca più — evita di dis-confermare voci a contratto.
  if not exists (
    select 1 from public.quotes
     where id = p_quote_id and status = 'INVIATO' and archived_at is null
  ) then
    raise exception 'quote_not_open';
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
