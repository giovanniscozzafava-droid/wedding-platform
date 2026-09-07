-- ============================================================================
-- "Ci sono" non arrivava a destinazione.
--
-- Il fornitore premeva "Ci sono" su /lavori-da-confermare, la riga veniva
-- aggiornata (supplier_presence='SI') e li` finiva tutto: il capostipite non
-- riceveva nessuna notifica, la sua risposta non compariva da nessuna parte
-- nel preventivo, e il fornitore non aveva un modo per entrare nel lavoro che
-- aveva appena accettato. L'unico posto dove la presenza contava era il gate
-- del contratto, cioe` giorni dopo e solo quando il capostipite provava a
-- chiudere.
--
-- Qui: 1) la risposta del fornitore avvisa il capostipite, 2) il fornitore si
-- porta dietro l'evento su cui e` appena entrato.
-- ============================================================================

-- ── 1) La risposta del fornitore avvisa il capostipite ──────────────────────
-- Cambia il tipo di ritorno (era integer): serve un drop esplicito.
drop function if exists public.supplier_set_quote_presence(uuid, text);

create function public.supplier_set_quote_presence(p_quote_id uuid, p_status text)
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

  select id into v_evento from public.calendar_entries where quote_id = p_quote_id limit 1;

  -- Chiudi le notifiche pendenti di conferma voce per questo fornitore/evento.
  begin
    update public.notifiche
       set stato = 'DONE', letto_il = coalesce(letto_il, now())
     where destinatario_id = v_uid
       and tipo = 'FORNITORE_CONFERMA_VOCE'
       and (evento_id = v_evento or link_action like '%' || p_quote_id::text || '%')
       and stato = 'PENDING';
  exception when others then null;
  end;

  -- Avvisa il capostipite. Senza questo la risposta restava muta: chi ha
  -- costruito il preventivo non sapeva di averla ricevuta.
  begin
    select q.owner_id, coalesce(q.title, 'Preventivo')
      into v_capostipite, v_titolo_prev
      from public.quotes q where q.id = p_quote_id;

    select coalesce(nullif(p.business_name, ''), nullif(p.full_name, ''), 'Un fornitore')
      into v_fornitore
      from public.profiles p where p.id = v_uid;

    if v_capostipite is not null and v_capostipite <> v_uid then
      -- Una risposta si puo` cambiare: vale sempre e solo l'ultima, quindi la
      -- precedente ancora da leggere viene archiviata invece di accumularsi.
      update public.notifiche
         set stato = 'DONE', letto_il = coalesce(letto_il, now())
       where destinatario_id = v_capostipite
         and tipo = 'FORNITORE_PRESENZA'
         and owner_della_mossa = v_uid
         and link_action = '/quotes/' || p_quote_id::text
         and stato = 'PENDING';

      v_titolo := case p_status
        when 'SI'    then v_fornitore || ' ci sara`'
        when 'NO'    then v_fornitore || ' non ci sara`'
        else              v_fornitore || ' sta valutando'
      end;
      v_descrizione := case p_status
        when 'SI'    then 'Ha confermato la presenza su «' || v_titolo_prev || '». Le sue voci sono pronte per il contratto.'
        when 'NO'    then 'Ha declinato «' || v_titolo_prev || '». Serve sostituirlo prima di chiudere il contratto.'
        else              'E` in valutazione su «' || v_titolo_prev || '». Il budget non e` ancora chiuso.'
      end;
      -- Un "non ci sara`" blocca il contratto: sale in cima alla lista.
      v_priorita := case p_status when 'NO' then 8 when 'SI' then 6 else 5 end;

      insert into public.notifiche (destinatario_id, evento_id, tipo, titolo, descrizione, link_action, owner_della_mossa, priorita)
      values (v_capostipite, v_evento, 'FORNITORE_PRESENZA', v_titolo, v_descrizione,
              '/quotes/' || p_quote_id::text, v_uid, v_priorita);
    end if;
  exception when others then null;
  end;

  -- entry_id torna al chiamante: e` il lavoro in cui il fornitore e` appena
  -- entrato, e la pagina ce lo porta subito senza fargli cercare l'evento.
  return jsonb_build_object('righe', v_n, 'entry_id', v_evento);
end$$;

grant execute on function public.supplier_set_quote_presence(uuid, text) to authenticated;

comment on function public.supplier_set_quote_presence(uuid, text) is
  'Il fornitore dichiara la presenza sull''intero preventivo. Notifica il capostipite e restituisce {righe, entry_id}.';

-- ── 2) La lista "Lavori da confermare" porta con se` l'evento ───────────────
create or replace function public.supplier_pending_items()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name_snapshot', qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'quantity', qi.quantity,
           'line_cost', qi.line_cost,
           'quote_id', qi.quote_id,
           'supplier_presence', qi.supplier_presence,
           'supplier_confirmed_at', qi.supplier_confirmed_at,
           'entry_title', coalesce(ce.title, q.title),
           'event_date', coalesce(ce.date_from, q.event_date),
           'client_name', coalesce(cep.client_name, q.client_name),
           -- Nuovi: dove entrare una volta detto "ci sono", e chi lo ha chiesto.
           'entry_id', ce.id,
           'capostipite_name', coalesce(nullif(cap.business_name, ''), nullif(cap.full_name, ''), 'Capostipite')
         ) order by coalesce(ce.date_from, q.event_date) nulls last), '[]'::jsonb)
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
    left join public.profiles cap on cap.id = q.owner_id
    left join public.calendar_entries ce on ce.quote_id = q.id
    left join public.calendar_entries_private cep on cep.entry_id = ce.id
   where qi.supplier_id = auth.uid()
     and q.owner_id <> auth.uid()
     and q.status = 'INVIATO'
     and q.archived_at is null;
$$;

grant execute on function public.supplier_pending_items() to authenticated;
