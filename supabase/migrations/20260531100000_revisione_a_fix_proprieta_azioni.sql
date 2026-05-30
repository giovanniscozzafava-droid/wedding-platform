-- ============================================================================
-- REVISIONE A.1 — Fix "proprieta` azioni" nello stato LEAD.
--
-- Spec rivista (capostipite-erogatore):
--   In LEAD non e` la coppia che firma "subito" l'incarico, perche` non c'e`
--   ancora un incarico: e` il capostipite owner del calendar_entry che deve
--   *proporre* il proprio incarico alla coppia. Solo dopo la proposta, la
--   coppia firma.
--
-- Cambiamenti rispetto a 20260530200000_fase2_notifiche.sql:
--   - Stato LEAD per OWNER (capostipite): tipo PROPONI_INCARICO, titolo
--     "Proponi il tuo incarico alla coppia", link /quotes?entry=<id>, prio 9.
--   - Stato LEAD per membri COUPLE: tipo COPPIA_FIRMA_INCARICO (gia` esistente),
--     titolo "Firma l'incarico con <nome capostipite>", link
--     /couple?firmaIncarico=<id>, prio 9.
--
-- Tutto il resto della funzione e` lasciato invariato. La migrazione e`
-- idempotente: CREATE OR REPLACE sostituisce il body senza toccare la tabella
-- notifiche o il trigger trg_notifiche_evento_stato.
-- ============================================================================

create or replace function public.refresh_notifiche_per_evento(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry          record;
  v_couple_ids     uuid[];
  v_owner_id       uuid;
  v_owner_name     text;
  v_current_tipo   text;
  v_current_titolo text;
  v_current_desc   text;
  v_current_link   text;
  v_current_prio   int;
begin
  select id, owner_id, title, evento_stato, quote_id
    into v_entry
    from public.calendar_entries
   where id = p_entry_id;

  if not found then
    return;
  end if;

  v_owner_id := v_entry.owner_id;

  -- Nome capostipite (best-effort: full_name | business_name | 'il tuo capostipite').
  begin
    select coalesce(
             nullif(trim(p.full_name), ''),
             nullif(trim(p.business_name), ''),
             'il tuo capostipite'
           )
      into v_owner_name
      from public.profiles p
     where p.id = v_owner_id;
  exception when others then
    v_owner_name := 'il tuo capostipite';
  end;
  if v_owner_name is null then v_owner_name := 'il tuo capostipite'; end if;

  -- Membri "couple" associati al calendar entry (se la tabella esiste e ha la colonna).
  begin
    select coalesce(array_agg(distinct user_id), array[]::uuid[])
      into v_couple_ids
      from public.calendar_entry_participants
     where entry_id = p_entry_id
       and user_id is not null
       and coalesce(role_in_entry, '') ilike 'COUPLE%';
  exception when others then
    v_couple_ids := array[]::uuid[];
  end;

  -- 1) Determina la "prossima mossa" del capostipite owner in base allo stato.
  case v_entry.evento_stato
    when 'LEAD' then
      -- REVISIONE A: l'owner *propone* l'incarico alla coppia (non firma).
      v_current_tipo   := 'PROPONI_INCARICO';
      v_current_titolo := 'Proponi il tuo incarico alla coppia';
      v_current_desc   := 'Componi e invia la tua proposta di incarico per "' || v_entry.title || '". La coppia firmera` dalla sua area.';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 9;
    when 'INCARICO_FIRMATO' then
      v_current_tipo   := 'RACCOGLI_PREVENTIVI';
      v_current_titolo := 'Raccogli preventivi dai fornitori';
      v_current_desc   := 'Invita i fornitori a inviare preventivi per "' || v_entry.title || '".';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'PREVENTIVI' then
      v_current_tipo   := 'INVIA_PREVENTIVO_COPPIA';
      v_current_titolo := 'Invia preventivo alla coppia';
      v_current_desc   := 'Componi il preventivo totale e inviane copia firmabile alla coppia.';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'PREVENTIVO_FIRMATO' then
      v_current_tipo   := 'PREPARA_CONTRATTO';
      v_current_titolo := 'Prepara il contratto';
      v_current_desc   := 'Il preventivo e` firmato. Genera il contratto dalle clausole standard.';
      v_current_link   := '/contracts?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'CONTRATTO' then
      v_current_tipo   := 'AVVIA_PIANIFICAZIONE';
      v_current_titolo := 'Avvia la pianificazione';
      v_current_desc   := 'Contratto firmato: passa alla pianificazione (timeline, scaletta, fornitori).';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 7;
    when 'PIANIFICAZIONE' then
      v_current_tipo   := 'COMPLETA_CHECKLIST';
      v_current_titolo := 'Completa la checklist evento';
      v_current_desc   := 'Spunta la checklist operativa: la settimana evento e` vicina.';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 7;
    when 'CHECKLIST' then
      v_current_tipo   := 'EVENTO_IMMINENTE';
      v_current_titolo := 'Evento imminente';
      v_current_desc   := 'Ultimi controlli pre-evento. Conferma fornitori, orari, logistica.';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 9;
    when 'SVOLTO' then
      v_current_tipo   := null;
    when 'ANNULLATO' then
      v_current_tipo   := null;
    else
      v_current_tipo   := null;
  end case;

  -- 2) Chiudi le notifiche "vive" di stati precedenti.
  if v_current_tipo is not null then
    update public.notifiche
       set stato = 'DONE',
           letto_il = coalesce(letto_il, now())
     where evento_id = p_entry_id
       and stato = 'PENDING'
       and tipo <> v_current_tipo
       -- non chiudere i promemoria a tempo (FASE 4) ne` le notifiche couple
       -- specifiche dello stesso stato.
       and tipo not like 'PROMEMORIA_%'
       and tipo not like 'COPPIA_%';
  else
    update public.notifiche
       set stato = 'DONE',
           letto_il = coalesce(letto_il, now())
     where evento_id = p_entry_id
       and stato = 'PENDING'
       and tipo not like 'PROMEMORIA_%';
    return;
  end if;

  -- 3) Upsert della notifica per il capostipite (owner).
  if v_owner_id is not null then
    insert into public.notifiche(
      destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
      owner_della_mossa, stato, priorita
    ) values (
      v_owner_id, p_entry_id, v_current_tipo, v_current_titolo, v_current_desc, v_current_link,
      v_owner_id, 'PENDING', v_current_prio
    )
    on conflict (destinatario_id, evento_id, tipo) do update
      set titolo = excluded.titolo,
          descrizione = excluded.descrizione,
          link_action = excluded.link_action,
          owner_della_mossa = excluded.owner_della_mossa,
          stato = 'PENDING',
          priorita = excluded.priorita,
          letto_il = null;
  end if;

  -- 4) Notifiche per la coppia.
  if array_length(v_couple_ids, 1) is not null then
    if v_entry.evento_stato in ('LEAD','PREVENTIVI','CONTRATTO') then
      declare
        v_couple_titolo text;
        v_couple_desc   text;
        v_couple_link   text;
        v_couple_tipo   text;
        v_couple_prio   int := 9;
        v_uid uuid;
      begin
        if v_entry.evento_stato = 'LEAD' then
          -- REVISIONE A: link verso la dashboard coppia con deep-link
          -- firmaIncarico=<entry_id>. Titolo personalizzato col nome del WP.
          v_couple_tipo   := 'COPPIA_FIRMA_INCARICO';
          v_couple_titolo := 'Firma l''incarico con ' || v_owner_name;
          v_couple_desc   := 'Il/la capostipite ha proposto l''incarico per il vostro matrimonio. Aprilo, leggilo e firma per attivarlo.';
          v_couple_link   := '/couple?firmaIncarico=' || v_entry.id::text;
        elsif v_entry.evento_stato = 'PREVENTIVI' then
          v_couple_tipo   := 'COPPIA_ATTENDE_PREVENTIVO';
          v_couple_titolo := 'Il preventivo arriva a breve';
          v_couple_desc   := 'Il/la wedding planner sta raccogliendo i preventivi. Ti avviseremo appena pronto.';
          v_couple_link   := '/couple';
          v_couple_prio   := 5;
        else -- CONTRATTO
          v_couple_tipo   := 'COPPIA_FIRMA_CONTRATTO';
          v_couple_titolo := 'Firma il contratto del matrimonio';
          v_couple_desc   := 'Trovi il contratto pronto alla firma nella sezione Documenti.';
          v_couple_link   := '/couple';
        end if;

        foreach v_uid in array v_couple_ids loop
          insert into public.notifiche(
            destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
            owner_della_mossa, stato, priorita
          ) values (
            v_uid, p_entry_id, v_couple_tipo, v_couple_titolo, v_couple_desc, v_couple_link,
            v_uid, 'PENDING', v_couple_prio
          )
          on conflict (destinatario_id, evento_id, tipo) do update
            set titolo = excluded.titolo,
                descrizione = excluded.descrizione,
                link_action = excluded.link_action,
                owner_della_mossa = excluded.owner_della_mossa,
                stato = 'PENDING',
                priorita = excluded.priorita,
                letto_il = null;
        end loop;
      end;
    end if;
  end if;
end;
$$;

comment on function public.refresh_notifiche_per_evento(uuid) is
  'Rigenera le notifiche "prossima mossa" per il calendar_entry indicato, in base a evento_stato. LEAD: owner->PROPONI_INCARICO, coppia->COPPIA_FIRMA_INCARICO. Idempotente.';

-- 5. Backfill: chiudi eventuali notifiche FIRMA_INCARICO PENDING legacy assegnate
--    al capostipite (semanticamente sbagliate: e` un PROPONI_INCARICO).
update public.notifiche n
   set stato = 'DONE',
       letto_il = coalesce(n.letto_il, now())
 where n.tipo = 'FIRMA_INCARICO'
   and n.stato = 'PENDING'
   and exists (
     select 1 from public.calendar_entries e
      where e.id = n.evento_id
        and e.owner_id = n.destinatario_id
   );

-- Rigenera le notifiche per gli eventi LEAD esistenti, cosi` il capostipite vede
-- subito PROPONI_INCARICO e la coppia vede il titolo personalizzato.
do $$
declare
  r record;
begin
  for r in select id from public.calendar_entries where evento_stato = 'LEAD' loop
    perform public.refresh_notifiche_per_evento(r.id);
  end loop;
end$$;
