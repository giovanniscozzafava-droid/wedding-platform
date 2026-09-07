-- «1 fornitori su 2»: il conteggio va declinato al singolare.
create or replace function public.presenza_conteggio_testo(p_ok integer, p_tot integer)
returns text language sql immutable as $$
  select case when coalesce(p_ok, 0) = 1 then '1 fornitore su ' else coalesce(p_ok, 0)::text || ' fornitori su ' end
      || coalesce(p_tot, 0)::text
      || case when coalesce(p_ok, 0) = 1 then ' ha confermato.' else ' hanno confermato.' end;
$$;

create or replace function public.supplier_set_quote_presence(p_quote_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_n            integer := 0;
  v_evento       uuid;
  v_capostipite  uuid;
  v_titolo_prev  text;
  v_fornitore    text;
  v_titolo       text;
  v_descrizione  text;
  v_priorita     integer;
  v_link         text;
  v_tot          integer;
  v_ok           integer;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if p_status not in ('SI', 'NO', 'FORSE') then
    raise exception 'invalid_status';
  end if;

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

  select id into v_evento from public.calendar_entries where quote_id = p_quote_id limit 1;

  begin
    update public.notifiche
       set stato = 'DONE', letto_il = coalesce(letto_il, now())
     where destinatario_id = v_uid
       and tipo = 'FORNITORE_CONFERMA_VOCE'
       and (evento_id = v_evento or link_action like '%' || p_quote_id::text || '%')
       and stato = 'PENDING';
  exception when others then null;
  end;

  begin
    select q.owner_id, coalesce(q.title, 'Preventivo')
      into v_capostipite, v_titolo_prev
      from public.quotes q where q.id = p_quote_id;

    select coalesce(nullif(p.business_name, ''), nullif(p.full_name, ''), 'Un fornitore')
      into v_fornitore
      from public.profiles p where p.id = v_uid;

    if v_capostipite is not null and v_capostipite <> v_uid then
      -- Quanti fornitori del preventivo hanno detto di sì: è la riga che serve
      -- al capostipite per sapere se può chiudere.
      select count(distinct qi.supplier_id) filter (where true),
             count(distinct qi.supplier_id) filter (where qi.supplier_presence = 'SI')
        into v_tot, v_ok
        from public.quote_items qi
       where qi.quote_id = p_quote_id
         and qi.supplier_id is not null
         and qi.supplier_id <> v_capostipite
         and coalesce(qi.erogatore_e_capostipite, false) = false;

      v_link := '/quotes/' || p_quote_id::text;
      v_titolo := case p_status
        when 'SI'    then v_fornitore || ' ci sarà'
        when 'NO'    then v_fornitore || ' non ci sarà'
        else              v_fornitore || ' sta valutando'
      end;
      v_descrizione := case p_status
        when 'SI'    then 'Ha confermato la presenza su «' || v_titolo_prev || '».'
        when 'NO'    then 'Ha declinato «' || v_titolo_prev || '». Serve sostituirlo prima di chiudere il contratto.'
        else              'È in valutazione su «' || v_titolo_prev || '».'
      end
      || ' ' || public.presenza_conteggio_testo(v_ok, v_tot);
      -- Un "non ci sarà" blocca il contratto: sale in cima alla lista.
      v_priorita := case p_status when 'NO' then 8 when 'SI' then 6 else 5 end;

      if v_evento is not null then
        insert into public.notifiche (destinatario_id, evento_id, tipo, titolo, descrizione, link_action, owner_della_mossa, priorita)
        values (v_capostipite, v_evento, 'FORNITORE_PRESENZA', v_titolo, v_descrizione, v_link, v_uid, v_priorita)
        on conflict (destinatario_id, evento_id, tipo) do update
          set titolo            = excluded.titolo,
              descrizione       = excluded.descrizione,
              link_action       = excluded.link_action,
              owner_della_mossa = excluded.owner_della_mossa,
              priorita          = excluded.priorita,
              stato             = 'PENDING',
              letto_il          = null,
              creato_il         = now();
      else
        -- Preventivo senza evento: l'indice unico non aggancia (evento_id nullo),
        -- quindi la vecchia risposta va archiviata a mano prima di scriverne una nuova.
        update public.notifiche
           set stato = 'DONE', letto_il = coalesce(letto_il, now())
         where destinatario_id = v_capostipite
           and tipo = 'FORNITORE_PRESENZA'
           and owner_della_mossa = v_uid
           and link_action = v_link
           and stato = 'PENDING';
        insert into public.notifiche (destinatario_id, evento_id, tipo, titolo, descrizione, link_action, owner_della_mossa, priorita)
        values (v_capostipite, null, 'FORNITORE_PRESENZA', v_titolo, v_descrizione, v_link, v_uid, v_priorita);
      end if;
    end if;
  exception when others then null;
  end;

  return jsonb_build_object('righe', v_n, 'entry_id', v_evento);
end$$;

grant execute on function public.supplier_set_quote_presence(uuid, text) to authenticated;
