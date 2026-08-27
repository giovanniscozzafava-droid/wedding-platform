-- ════════════════════════════════════════════════════════════════════════════
-- "MAI PIÙ": i trigger AFTER-UPDATE di SIDE-EFFECT sui preventivi (backfill referral,
-- sync del valore evento) non devono poter ABORTIRE la transizione di stato critica
-- (firma/invio). Un bug al loro interno (come il cast enum del 25/08) rompeva OGNI
-- cambio stato. Ora il loro corpo è racchiuso in un gestore d'eccezione: se falliscono,
-- il side-effect viene saltato ma l'operazione principale (INVIATO/ACCETTATO) prosegue.
-- NB: i trigger di RICALCOLO (totali) restano "loud" di proposito — devono girare per
-- la correttezza dei numeri; se falliscono è giusto che l'errore emerga.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Referral backfill (Scenario B): mai fatale per firma/invio.
create or replace function public.tg_suggestion_on_quote_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sugg public.supplier_suggestions%rowtype;
  v_priv public.supplier_suggestions_private%rowtype;
  v_client uuid;
begin
  begin
    if new.status = 'ACCETTATO' and coalesce(old.status::text, '') <> 'ACCETTATO' then
      select * into v_sugg from public.supplier_suggestions where quote_id = new.id limit 1;
      if v_sugg.id is not null and v_sugg.status <> 'ACCEPTED' then
        update public.supplier_suggestions set status = 'ACCEPTED', updated_at = now() where id = v_sugg.id;

        select * into v_priv from public.supplier_suggestions_private where suggestion_id = v_sugg.id;
        if v_priv.suggestion_id is not null then
          if new.direct_client_id is null
             and coalesce(nullif(trim(v_priv.client_name),''), nullif(trim(v_priv.client_email),'')) is not null then
            insert into public.supplier_clients (supplier_id, full_name, email, phone, status)
            values (v_sugg.supplier_id,
                    coalesce(nullif(trim(v_priv.client_name),''), 'Cliente'),
                    nullif(trim(v_priv.client_email),''),
                    nullif(trim(v_priv.client_phone),''),
                    'CLIENTE')
            returning id into v_client;
          end if;

          update public.quotes set
            client_name = case
                when coalesce(nullif(trim(client_name),''),'') in ('', 'Cliente suggerito')
                then coalesce(nullif(trim(v_priv.client_name),''), client_name)
                else client_name end,
            client_email = case
                when coalesce(nullif(trim(client_email),''),'') = ''
                then coalesce(nullif(trim(v_priv.client_email),''), client_email)
                else client_email end,
            direct_client_id = coalesce(direct_client_id, v_client)
          where id = new.id;
        end if;

        perform public.push_user_notification(
          v_sugg.supplier_id, 'SUGGESTION_ACCEPTED',
          'Preventivo accettato',
          'Il cliente suggerito ha accettato il tuo preventivo: ora vedi i contatti.',
          '/quotes/' || new.id::text, v_sugg.id);
      end if;
    end if;
  exception when others then
    -- Side-effect non fatale: non rompere mai la transizione di stato del preventivo.
    null;
  end;
  return new;
end$$;

-- 2) Sync del valore evento: mai fatale per il cambio stato/totali.
create or replace function public.sync_event_value_from_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_val numeric;
begin
  begin
    v_val := case when coalesce(new.total_client_selected, 0) > 0
                  then new.total_client_selected
                  else coalesce(new.total_client, 0) end;
    update public.calendar_entries_private cep
       set value_amount = v_val
      from public.calendar_entries ce
     where ce.id = cep.entry_id and ce.quote_id = new.id;
  exception when others then
    null;
  end;
  return new;
end$$;
