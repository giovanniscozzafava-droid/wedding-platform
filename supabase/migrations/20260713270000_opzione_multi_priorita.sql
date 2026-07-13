-- OPZIONE DATA MULTI-CLIENTE con PRIORITÀ.
-- Più clienti possono opzionare la STESSA data (coda): l'opzione è "soft" e sta solo sull'evento della
-- coppia (calendar_entries OPZIONATA + countdown) — niente più lock esclusivo per il flusso cliente
-- (il lock esclusivo resta solo per il blocco MANUALE del pro, blocca_data_preventivo).
-- Chi FIRMA per primo prende la data: alla conferma, gli altri eventi OPZIONATA sulla stessa data+pro
-- tornano IN_TRATTATIVA (data persa) e le loro richieste vanno RILASCIATA.

create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_pos int;
begin
  select q.id, ce.id as entry_id, q.owner_id, q.client_email, q.option_allowed, coalesce(q.option_days,15) as days, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.access_token::text = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if not coalesce(v_q.option_allowed, false) then return jsonb_build_object('error','non_abilitato'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;
  if exists (select 1 from public.quote_option_requests where quote_id = v_q.id and status='CONCESSA') then
    return jsonb_build_object('error','gia_opzionata');
  end if;

  v_days := greatest(1, v_q.days);
  v_exp  := now() + make_interval(days => v_days);

  -- opzione SOFT sull'evento della coppia (multi-cliente: nessun lock esclusivo sulla data del pro)
  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email
   where id=v_q.entry_id and status in ('IN_TRATTATIVA','OPZIONATA');
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', v_days);

  -- posizione in coda = opzioni attive sulla stessa data+professionista (1 = solo tu)
  select count(*) into v_pos from public.quote_option_requests r
    join public.calendar_entries ce on ce.id = r.entry_id
   where r.owner_id = v_q.owner_id and ce.date_from = v_q.date_from and r.status='CONCESSA';
  return jsonb_build_object('ok', true, 'scade', v_exp, 'posizione', v_pos, 'contesa', v_pos > 1);
end$$;
grant execute on function public.richiedi_opzione_da_preventivo(text) to anon, authenticated;

-- "Il primo che firma se la prende": alla CONFERMATA, libera le opzioni degli altri sulla stessa data.
create or replace function public.tg_release_options_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'CONFERMATA' and (old.status is distinct from 'CONFERMATA') and new.date_from is not null then
    update public.quote_option_requests r set status='RILASCIATA'
      where r.owner_id = new.owner_id and r.status='CONCESSA' and r.entry_id <> new.id
        and r.entry_id in (select id from public.calendar_entries where owner_id = new.owner_id and date_from = new.date_from);
    update public.calendar_entries
       set status='IN_TRATTATIVA', option_expires_at=null, option_requested_by=null
     where owner_id = new.owner_id and date_from = new.date_from and id <> new.id and status='OPZIONATA';
  end if;
  return new;
end$$;
drop trigger if exists trg_release_options_on_confirm on public.calendar_entries;
create trigger trg_release_options_on_confirm
  after update of status on public.calendar_entries
  for each row execute function public.tg_release_options_on_confirm();
