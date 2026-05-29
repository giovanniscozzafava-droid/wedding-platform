-- RPC: promuove un quote da BOZZA a INVIATO. Usata dall'edge fn
-- quote-accept-sign quando il cliente sta firmando un preventivo ancora in BOZZA
-- (atterrato direttamente sull'accept page, senza passare per quote-send).
--
-- Cast esplicito su quote_status per evitare ambiguita' enum sotto PostgREST.

create or replace function public.quote_promote_to_inviato(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
     set status = 'INVIATO'::quote_status,
         sent_at = coalesce(sent_at, now())
   where id = p_quote_id
     and status = 'BOZZA'::quote_status;
end$$;

grant execute on function public.quote_promote_to_inviato(uuid) to service_role;

comment on function public.quote_promote_to_inviato(uuid) is
  'Edge fn helper: promuove quote da BOZZA a INVIATO con cast enum esplicito. Chiamata da quote-accept-sign per superare il trigger di macchina stati che vieta BOZZA -> ACCETTATO diretto.';
