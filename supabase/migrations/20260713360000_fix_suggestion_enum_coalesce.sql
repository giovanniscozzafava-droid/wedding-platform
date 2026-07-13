-- FIX BUG FIRMA: tg_suggestion_on_quote_accept faceva `coalesce(old.status, '')` su un enum
-- quote_status. Con new.status='ACCETTATO' (firma) l'and non va in corto-circuito e PG deve castare
-- '' a quote_status → [22P02] invalid input value for enum quote_status: "" → l'UPDATE ad ACCETTATO
-- falliva → l'edge quote-accept-sign tornava 500 ("Edge Function non-2xx") per OGNI cliente.
-- Fix: `old.status::text` (stessa logica, niente cast di '' all'enum). Come gia' fatto per
-- trg_quote_accept_block_dates in 20260601630000.
create or replace function public.tg_suggestion_on_quote_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sugg public.supplier_suggestions%rowtype;
begin
  if new.status = 'ACCETTATO' and coalesce(old.status::text, '') <> 'ACCETTATO' then
    select * into v_sugg from public.supplier_suggestions where quote_id = new.id limit 1;
    if v_sugg.id is not null and v_sugg.status <> 'ACCEPTED' then
      update public.supplier_suggestions set status = 'ACCEPTED', updated_at = now() where id = v_sugg.id;
      begin
        perform public.push_user_notification(
          v_sugg.supplier_id, 'SUGGESTION_ACCEPTED',
          'Preventivo accettato',
          'Il cliente suggerito ha accettato il tuo preventivo: ora vedi i contatti.',
          '/quotes/' || new.id::text, v_sugg.id);
      exception when others then null; end;
    end if;
  end if;
  return new;
end$$;

-- Ri-verifica sullo stesso preventivo di test: l'UPDATE ad ACCETTATO ora deve PASSARE (rollback finale).
do $$
declare v_q uuid; v_st text;
begin
  select id, status into v_q, v_st from public.quotes
    where client_name ilike '%Giorgio Gatto%' or client_name ilike '%Napoleone%' or title ilike '%destination weekend%'
    order by created_at desc limit 1;
  if v_q is null then raise notice 'RETEST: nessun preventivo di test'; return; end if;
  begin
    if v_st = 'BOZZA' then perform public.quote_promote_to_inviato(v_q); end if;
    update public.quotes set status='ACCETTATO' where id = v_q and status in ('INVIATO','BOZZA');
    raise exception using errcode = '40000', message = '__OK__';
  exception
    when sqlstate '40000' then raise notice 'RETEST FIRMA: OK — l''UPDATE ad ACCETTATO ora passa (bug enum risolto)';
    when others then raise notice 'RETEST FIRMA ANCORA ROTTO: [%] %', SQLSTATE, SQLERRM;
  end;
end $$;
