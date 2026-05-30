-- FASE 3.3 — Conferma riga preventivo da parte del fornitore.
-- Quando il WP crea una quote_item con supplier_id valorizzato, il fornitore
-- riceve una notifica "Conferma la tua voce in preventivo" e puo` confermarla
-- via RPC supplier_confirm_quote_item, che marca supplier_confirmed_at e
-- supplier_confirmed_by con auth.uid().

-- 1) Colonne di conferma ----------------------------------------------------
alter table public.quote_items
  add column if not exists supplier_confirmed_at timestamptz,
  add column if not exists supplier_confirmed_by uuid references public.profiles(id) on delete set null;

comment on column public.quote_items.supplier_confirmed_at is
  'Quando il fornitore (supplier_id) ha confermato la propria voce nel preventivo.';
comment on column public.quote_items.supplier_confirmed_by is
  'Utente fornitore che ha confermato (deve coincidere con supplier_id).';

create index if not exists idx_qitems_pending_confirm
  on public.quote_items(supplier_id)
  where supplier_id is not null and supplier_confirmed_at is null;

-- 2) RPC: il fornitore conferma la propria riga -----------------------------
create or replace function public.supplier_confirm_quote_item(p_item_id uuid)
returns public.quote_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quote_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row from public.quote_items where id = p_item_id;
  if v_row.id is null then
    raise exception 'quote_item_not_found';
  end if;

  if v_row.supplier_id is null then
    raise exception 'no_supplier_assigned';
  end if;

  if v_row.supplier_id <> auth.uid() then
    raise exception 'forbidden_not_supplier';
  end if;

  if v_row.supplier_confirmed_at is not null then
    -- idempotente: gia` confermato
    return v_row;
  end if;

  update public.quote_items set
    supplier_confirmed_at = now(),
    supplier_confirmed_by = auth.uid(),
    updated_at = now()
  where id = p_item_id
  returning * into v_row;

  -- Chiudi la notifica pendente al fornitore per questa riga
  begin
    update public.notifiche
       set stato = 'DONE',
           letto_il = coalesce(letto_il, now())
     where destinatario_id = auth.uid()
       and tipo = 'FORNITORE_CONFERMA_VOCE'
       and link_action like '%' || p_item_id::text || '%'
       and stato = 'PENDING';
  exception when others then null;
  end;

  return v_row;
end$$;

grant execute on function public.supplier_confirm_quote_item(uuid) to authenticated;

-- 3) Trigger: crea notifica al fornitore quando viene inserita una riga con
--    supplier_id valorizzato (e ancora non confermata).
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
  if new.supplier_id is null then
    return new;
  end if;
  if new.supplier_confirmed_at is not null then
    return new;
  end if;

  -- Recupera quote + (eventuale) calendar_entry collegato
  select * into v_quote from public.quotes where id = new.quote_id;
  select * into v_entry from public.calendar_entries
    where quote_id = new.quote_id
    limit 1;

  v_evento := v_entry.id;
  v_titolo := 'Conferma la tua voce in preventivo';
  v_descr  := coalesce(new.name_snapshot, 'Voce') ||
              case when v_entry.date_from is not null
                then ' · evento del ' || to_char(v_entry.date_from, 'DD/MM/YYYY')
                else '' end;

  -- La tabella notifiche e` stata creata in FASE 2 con unique
  -- (destinatario_id, evento_id, tipo). Per supportare piu` righe distinte
  -- dello stesso fornitore, qui usiamo tipo = 'FORNITORE_CONFERMA_VOCE' e
  -- mettiamo l'id della voce nel link_action. Se per lo stesso (fornitore,
  -- evento) esiste gia` una notifica dello stesso tipo, la aggiorniamo per
  -- non duplicare e per puntare all'ultima riga inserita.
  begin
    insert into public.notifiche (
      destinatario_id, evento_id, tipo, titolo, descrizione,
      link_action, owner_della_mossa, stato, priorita
    ) values (
      new.supplier_id,
      v_evento,
      'FORNITORE_CONFERMA_VOCE',
      v_titolo,
      v_descr,
      '/supplier/contracts?confirm=' || new.id::text,
      v_entry.owner_id,
      'PENDING',
      7
    )
    on conflict (destinatario_id, evento_id, tipo) do update set
      titolo      = excluded.titolo,
      descrizione = excluded.descrizione,
      link_action = excluded.link_action,
      stato       = 'PENDING',
      letto_il    = null,
      creato_il   = now();
  exception when others then
    -- Se la tabella notifiche non c'e` (test isolati), ignora.
    null;
  end;

  return new;
end$$;

drop trigger if exists trg_notify_supplier_quote_item on public.quote_items;
create trigger trg_notify_supplier_quote_item
  after insert on public.quote_items
  for each row execute function public.trg_notify_supplier_quote_item();
