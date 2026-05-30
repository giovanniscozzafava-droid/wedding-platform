-- ============================================================================
-- REVISIONE C — Ambito dell'incarico + workflow dinamico
--
-- Aggiungiamo un campo `ambito_capostipite` su calendar_entries che modifica
-- dinamicamente il workflow "prossima mossa":
--
--   COMPLETO              -> comportamento attuale (post Task A): preventivi,
--                            preventivo firmato, contratto, pianificazione…
--   SOLO_COORDINAMENTO    -> salta gli step PREVENTIVI / PREVENTIVO_FIRMATO /
--                            CONTRATTO; in PIANIFICAZIONE mostra mosse per
--                            giorno (tavoli, invitati, timeline, checklist).
--   SOLO_PROPRI_SERVIZI   -> in stato PREVENTIVI mostra "Componi il tuo menu"
--                            + "Gestisci i tuoi servizi" invece di "Raccogli
--                            preventivi dai fornitori".
--
-- Il valore NULL significa "non ancora deciso": il front-end mostrera` un
-- modale di scelta all'ingresso evento in stato INCARICO_FIRMATO. Se l'utente
-- non sceglie, il default operativo dentro refresh_notifiche_per_evento e`
-- 'COMPLETO' (coalesce nel branch CASE).
--
-- Idempotente: create type if not exists, add column if not exists, create or
-- replace function.
-- ============================================================================

-- 1. Enum ambito_capostipite ------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ambito_capostipite') then
    create type public.ambito_capostipite as enum (
      'COMPLETO',
      'SOLO_COORDINAMENTO',
      'SOLO_PROPRI_SERVIZI'
    );
  end if;
end$$;

comment on type public.ambito_capostipite is
  'Ambito dell''incarico capostipite. COMPLETO: gestione end-to-end (preventivi, contratto, pianificazione). SOLO_COORDINAMENTO: skip preventivi/contratto, direttamente pianificazione. SOLO_PROPRI_SERVIZI: compone solo i propri servizi (menu/servizi), non raccoglie preventivi esterni.';

-- 2. Colonna su calendar_entries -------------------------------------------

alter table public.calendar_entries
  add column if not exists ambito_capostipite public.ambito_capostipite;

comment on column public.calendar_entries.ambito_capostipite is
  'Ambito dell''incarico capostipite. NULL = non ancora deciso (il front-end propone la scelta a INCARICO_FIRMATO; il default operativo nel workflow e` COMPLETO). Valori: COMPLETO, SOLO_COORDINAMENTO, SOLO_PROPRI_SERVIZI.';

-- 3. refresh_notifiche_per_evento adattata all'ambito -----------------------

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
  v_ambito         text;
  v_current_tipo   text;
  v_current_titolo text;
  v_current_desc   text;
  v_current_link   text;
  v_current_prio   int;
  v_extra_tipo     text;
  v_extra_titolo   text;
  v_extra_desc     text;
  v_extra_link     text;
  v_extra_prio     int;
begin
  select id, owner_id, title, evento_stato, quote_id, ambito_capostipite
    into v_entry
    from public.calendar_entries
   where id = p_entry_id;

  if not found then
    return;
  end if;

  v_owner_id := v_entry.owner_id;
  -- coalesce sul default operativo COMPLETO se non ancora scelto.
  v_ambito := coalesce(v_entry.ambito_capostipite::text, 'COMPLETO');

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

  -- Membri "couple" associati al calendar entry.
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

  -- 1) "Prossima mossa" del capostipite owner, in base a stato + ambito.
  v_extra_tipo := null;
  case v_entry.evento_stato
    when 'LEAD' then
      v_current_tipo   := 'PROPONI_INCARICO';
      v_current_titolo := 'Proponi il tuo incarico alla coppia';
      v_current_desc   := 'Componi e invia la tua proposta di incarico per "' || v_entry.title || '". La coppia firmera` dalla sua area.';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 9;
    when 'INCARICO_FIRMATO' then
      if v_ambito = 'SOLO_COORDINAMENTO' then
        -- Skip preventivi/contratto: passa direttamente alla pianificazione.
        v_current_tipo   := 'AVVIA_PIANIFICAZIONE';
        v_current_titolo := 'Avvia la pianificazione';
        v_current_desc   := 'Incarico di coordinamento attivo: inizia subito a pianificare timeline, tavoli e checklist per "' || v_entry.title || '".';
        v_current_link   := '/calendar?entry=' || v_entry.id::text;
        v_current_prio   := 8;
      else
        v_current_tipo   := 'RACCOGLI_PREVENTIVI';
        v_current_titolo := 'Raccogli preventivi dai fornitori';
        v_current_desc   := 'Invita i fornitori a inviare preventivi per "' || v_entry.title || '".';
        v_current_link   := '/quotes?entry=' || v_entry.id::text;
        v_current_prio   := 8;
      end if;
    when 'PREVENTIVI' then
      if v_ambito = 'SOLO_PROPRI_SERVIZI' then
        -- Niente raccolta esterna: compone i propri servizi/menu.
        v_current_tipo   := 'COMPONI_MENU';
        v_current_titolo := 'Componi il tuo menu';
        v_current_desc   := 'Per "' || v_entry.title || '" stai erogando solo servizi tuoi: definisci il menu da proporre alla coppia.';
        v_current_link   := '/quotes?entry=' || v_entry.id::text || '&tab=menu';
        v_current_prio   := 8;
        -- Mossa complementare: gestione servizi propri.
        v_extra_tipo     := 'GESTISCI_SERVIZI';
        v_extra_titolo   := 'Gestisci i tuoi servizi';
        v_extra_desc     := 'Aggiorna catalogo, prezzi e disponibilita dei tuoi servizi da proporre alla coppia.';
        v_extra_link     := '/services';
        v_extra_prio     := 7;
      else
        v_current_tipo   := 'INVIA_PREVENTIVO_COPPIA';
        v_current_titolo := 'Invia preventivo alla coppia';
        v_current_desc   := 'Componi il preventivo totale e inviane copia firmabile alla coppia.';
        v_current_link   := '/quotes?entry=' || v_entry.id::text;
        v_current_prio   := 8;
      end if;
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
      if v_ambito = 'SOLO_COORDINAMENTO' then
        -- Mosse "per giorno": tavoli + timeline + checklist (mostriamo la
        -- principale + 2 extra in modo da popolare il pannello).
        v_current_tipo   := 'PIANIFICA_TAVOLI';
        v_current_titolo := 'Disponi i tavoli';
        v_current_desc   := 'Coordina la sala: assegna invitati e definisci il layout dei tavoli per "' || v_entry.title || '".';
        v_current_link   := '/calendar?entry=' || v_entry.id::text || '&tab=tables';
        v_current_prio   := 7;
        v_extra_tipo     := 'PIANIFICA_TIMELINE';
        v_extra_titolo   := 'Definisci la scaletta del giorno';
        v_extra_desc     := 'Costruisci la timeline operativa del matrimonio (cerimonia, ricevimento, momenti chiave).';
        v_extra_link     := '/calendar?entry=' || v_entry.id::text || '&tab=timeline';
        v_extra_prio     := 7;
      else
        v_current_tipo   := 'COMPLETA_CHECKLIST';
        v_current_titolo := 'Completa la checklist evento';
        v_current_desc   := 'Spunta la checklist operativa: la settimana evento e` vicina.';
        v_current_link   := '/calendar?entry=' || v_entry.id::text;
        v_current_prio   := 7;
      end if;
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
       and (v_extra_tipo is null or tipo <> v_extra_tipo)
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

  -- 3) Upsert della notifica principale per il capostipite (owner).
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

    -- 3b) Mossa "complementare" (es. SOLO_PROPRI_SERVIZI mostra GESTISCI_SERVIZI;
    --     SOLO_COORDINAMENTO in PIANIFICAZIONE mostra PIANIFICA_TIMELINE).
    if v_extra_tipo is not null then
      insert into public.notifiche(
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
        owner_della_mossa, stato, priorita
      ) values (
        v_owner_id, p_entry_id, v_extra_tipo, v_extra_titolo, v_extra_desc, v_extra_link,
        v_owner_id, 'PENDING', v_extra_prio
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
          v_couple_tipo   := 'COPPIA_FIRMA_INCARICO';
          v_couple_titolo := 'Firma l''incarico con ' || v_owner_name;
          v_couple_desc   := 'Il/la capostipite ha proposto l''incarico per il vostro matrimonio. Aprilo, leggilo e firma per attivarlo.';
          v_couple_link   := '/couple?firmaIncarico=' || v_entry.id::text;
        elsif v_entry.evento_stato = 'PREVENTIVI' then
          -- In SOLO_PROPRI_SERVIZI la coppia non aspetta preventivi esterni:
          -- aspetta il menu/proposta del capostipite stesso.
          if v_ambito = 'SOLO_PROPRI_SERVIZI' then
            v_couple_tipo   := 'COPPIA_ATTENDE_PROPOSTA';
            v_couple_titolo := 'In arrivo la proposta da ' || v_owner_name;
            v_couple_desc   := 'Il/la capostipite sta componendo menu e servizi propri. Ti avviseremo appena pronto.';
          else
            v_couple_tipo   := 'COPPIA_ATTENDE_PREVENTIVO';
            v_couple_titolo := 'Il preventivo arriva a breve';
            v_couple_desc   := 'Il/la wedding planner sta raccogliendo i preventivi. Ti avviseremo appena pronto.';
          end if;
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
  'Rigenera le notifiche "prossima mossa" per il calendar_entry indicato, in base a evento_stato + ambito_capostipite. SOLO_COORDINAMENTO salta preventivi/contratto e mostra mosse "per giorno" in pianificazione. SOLO_PROPRI_SERVIZI in PREVENTIVI propone componi-menu + gestisci-servizi. COMPLETO (default) usa il flusso classico. Idempotente.';

-- 4. Rigenera le notifiche per gli eventi attivi: la nuova logica deve essere
--    immediatamente visibile per gli eventi gia` esistenti.
do $$
declare
  r record;
begin
  for r in
    select id from public.calendar_entries
     where evento_stato not in ('SVOLTO', 'ANNULLATO')
  loop
    perform public.refresh_notifiche_per_evento(r.id);
  end loop;
end$$;
