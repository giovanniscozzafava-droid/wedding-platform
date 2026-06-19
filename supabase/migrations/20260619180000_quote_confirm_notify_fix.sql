-- FIX catena "da confermare" per il fornitore inserito in un preventivo:
--  (1) il link puntava a /supplier/contracts?confirm=... (rotta inesistente) → /lavori-da-confermare;
--  (2) la richiesta viveva solo in `notifiche` (vista da Prossima mossa) ma NON in `user_notifications`
--      → campanella e puntino per-evento (unread_by_entry) restavano spenti. Ora scriviamo anche lì,
--      con guardia anti-duplicati (un solo non-letto per fornitore+evento) e senza auto-notificarsi.
create or replace function public.trg_notify_supplier_quote_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote   public.quotes%rowtype;
  v_entry   public.calendar_entries%rowtype;
  v_evento  uuid;
  v_titolo  text;
  v_descr   text;
begin
  if new.supplier_id is null then return new; end if;
  if new.supplier_confirmed_at is not null then return new; end if;

  select * into v_quote from public.quotes where id = new.quote_id;
  select * into v_entry from public.calendar_entries where quote_id = new.quote_id limit 1;

  v_evento := v_entry.id;
  v_titolo := 'Conferma la tua disponibilità';
  v_descr  := coalesce(new.name_snapshot, 'Voce') ||
              case when v_entry.date_from is not null
                then ' · evento del ' || to_char(v_entry.date_from, 'DD/MM/YYYY')
                else '' end;

  -- (1) canale "notifiche" (Prossima mossa) — link corretto
  begin
    insert into public.notifiche (
      destinatario_id, evento_id, tipo, titolo, descrizione,
      link_action, owner_della_mossa, stato, priorita
    ) values (
      new.supplier_id, v_evento, 'FORNITORE_CONFERMA_VOCE', v_titolo, v_descr,
      '/lavori-da-confermare', v_quote.owner_id, 'PENDING', 7
    )
    on conflict (destinatario_id, evento_id, tipo) do update set
      titolo = excluded.titolo, descrizione = excluded.descrizione,
      link_action = excluded.link_action, stato = 'PENDING', letto_il = null, creato_il = now();
  exception when others then null;
  end;

  -- (2) canale "user_notifications" (campanella + puntino per-evento) — non a se stessi, no duplicati
  if new.supplier_id <> coalesce(v_quote.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and not exists (
       select 1 from public.user_notifications
        where user_id = new.supplier_id and type = 'quote_confirm_request'
          and ref_id is not distinct from v_evento and read_at is null
     ) then
    perform public.push_user_notification(new.supplier_id, 'quote_confirm_request',
      'Conferma la tua disponibilità', v_descr, '/lavori-da-confermare', v_evento);
  end if;

  return new;
end$$;
