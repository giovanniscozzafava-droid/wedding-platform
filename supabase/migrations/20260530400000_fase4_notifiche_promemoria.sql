-- FASE 4.1 — Notifiche evolute: promemoria a tempo + digest giornaliero.
--
-- Aggiunge a `notifiche`:
--   - `scadenza_il` timestamptz : istante in cui la notifica diventa "live"
--     (sorgente per filtri "in scadenza" e per il digest giornaliero).
--   - `relativa_a_data_nozze_giorni` int : offset (negativo = giorni prima della
--     data evento) usato dal generatore di promemoria. Permette di rigenerare
--     idempotentemente in caso di cambio data evento.
--
-- Funzione `notifiche_genera_promemoria_per_evento(p_entry_id)`:
--   - Per ogni voce di scadenzario_voci legata all'evento crea/aggiorna fino a
--     4 promemoria (offset -30, -14, -7, -2 giorni dalla scadenza della voce).
--   - Inoltre per l'evento stesso, crea 4 promemoria "data nozze in avvicinamento"
--     (-30, -14, -7, -2 giorni dalla `date_from` del calendar_entry).
--   - Upsert su unique (destinatario_id, evento_id, tipo) gia` esistente. La
--     chiave `tipo` codifica l'offset (es. PROMEMORIA_EVENTO_-30) per non
--     collidere fra loro.
--
-- Vista `v_notifiche_digest_per_utente`:
--   - Raggruppa per `destinatario_id` le notifiche PENDING con
--     `scadenza_il::date = current_date`, espone count + JSON delle prime 10.
--
-- Funzione `invia_digest_giornaliero()` (placeholder):
--   - Cicla la vista e logga (raise notice). Pensata per essere chiamata da
--     pg_cron quotidianamente (vedi REPORT per istruzioni di abilitazione).

-- 1. ALTER notifiche ---------------------------------------------------------

alter table public.notifiche
  add column if not exists scadenza_il timestamptz;

alter table public.notifiche
  add column if not exists relativa_a_data_nozze_giorni int;

comment on column public.notifiche.scadenza_il is
  'Istante in cui la notifica "diventa live". Usata da promemoria a tempo e da invia_digest_giornaliero.';
comment on column public.notifiche.relativa_a_data_nozze_giorni is
  'Offset (in giorni, di solito negativo) rispetto alla data riferimento usata dal generatore di promemoria. Permette regenerazione idempotente.';

-- Indice per il digest e per filtri "in scadenza".
create index if not exists idx_notifiche_scadenza_il
  on public.notifiche(scadenza_il)
  where stato = 'PENDING' and scadenza_il is not null;

-- 2. Funzione generatore -----------------------------------------------------

create or replace function public.notifiche_genera_promemoria_per_evento(p_entry_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry        record;
  v_count        int := 0;
  v_offsets      int[] := array[-30, -14, -7, -2];
  v_offset       int;
  v_dest_id      uuid;
  v_dest_list    uuid[];
  v_tipo         text;
  v_titolo       text;
  v_descr        text;
  v_link         text;
  v_priorita     int;
  v_scadenza_il  timestamptz;
  v_couple_ids   uuid[];
  r              record;
begin
  -- Carico evento.
  select id, owner_id, title, date_from, quote_id
    into v_entry
    from public.calendar_entries
   where id = p_entry_id;
  if not found then return 0; end if;

  -- Membri couple (best-effort).
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

  -- Destinatari "wp + coppia": owner + ogni couple.
  v_dest_list := array_remove(array_cat(array[v_entry.owner_id], v_couple_ids), null);

  -- 2.a Promemoria "data evento" per ogni destinatario, 4 offset.
  if v_entry.date_from is not null and array_length(v_dest_list, 1) is not null then
    foreach v_offset in array v_offsets loop
      v_scadenza_il := (v_entry.date_from + v_offset)::timestamptz;
      v_tipo   := 'PROMEMORIA_EVENTO_' || v_offset::text;
      v_titolo := case v_offset
                    when -30 then 'Mancano 30 giorni alla data evento'
                    when -14 then 'Due settimane all''evento'
                    when -7  then 'Una settimana all''evento'
                    when -2  then 'Evento fra 2 giorni'
                  end;
      v_descr  := 'Promemoria per "' || v_entry.title || '": '
                  || to_char(v_entry.date_from, 'DD/MM/YYYY') || '.';
      v_link   := '/calendar?entry=' || v_entry.id::text;
      v_priorita := case when v_offset >= -7 then 9 else 6 end;

      foreach v_dest_id in array v_dest_list loop
        insert into public.notifiche(
          destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
          owner_della_mossa, stato, priorita, scadenza_il,
          relativa_a_data_nozze_giorni
        ) values (
          v_dest_id, p_entry_id, v_tipo, v_titolo, v_descr, v_link,
          v_dest_id, 'PENDING', v_priorita, v_scadenza_il, v_offset
        )
        on conflict (destinatario_id, evento_id, tipo) do update
          set titolo = excluded.titolo,
              descrizione = excluded.descrizione,
              link_action = excluded.link_action,
              owner_della_mossa = excluded.owner_della_mossa,
              priorita = excluded.priorita,
              scadenza_il = excluded.scadenza_il,
              relativa_a_data_nozze_giorni = excluded.relativa_a_data_nozze_giorni,
              -- non resetto stato se gia` DONE/SKIPPED: rispetto la volonta` utente.
              stato = case when public.notifiche.stato in ('DONE','SKIPPED')
                             then public.notifiche.stato else 'PENDING' end,
              letto_il = case when public.notifiche.stato in ('DONE','SKIPPED')
                                then public.notifiche.letto_il else null end;
        v_count := v_count + 1;
      end loop;
    end loop;
  end if;

  -- 2.b Promemoria per ogni voce dello scadenzario (best-effort: la tabella
  --     potrebbe non esistere in DB legacy).
  begin
    for r in
      select id, titolo, scadenza, debitore_id, creditore_id, pagato
        from public.scadenzario_voci
       where entry_id = p_entry_id
         and scadenza is not null
         and coalesce(pagato, false) = false
    loop
      foreach v_offset in array v_offsets loop
        v_scadenza_il := (r.scadenza + v_offset)::timestamptz;
        v_tipo   := 'PROMEMORIA_SCADENZA_' || r.id::text || '_' || v_offset::text;
        v_titolo := case v_offset
                      when -30 then 'Scadenza fra 30 giorni: ' || r.titolo
                      when -14 then 'Scadenza fra 2 settimane: ' || r.titolo
                      when -7  then 'Scadenza fra 1 settimana: ' || r.titolo
                      when -2  then 'Scadenza fra 2 giorni: ' || r.titolo
                    end;
        v_descr  := 'Voce scadenzario "' || r.titolo || '" in scadenza il '
                    || to_char(r.scadenza, 'DD/MM/YYYY') || '.';
        v_link   := '/wedding/' || p_entry_id::text || '?tab=payments';
        v_priorita := case when v_offset >= -7 then 9 else 6 end;

        -- destinatari: owner wp + debitore + creditore (deduplicati, non null).
        for v_dest_id in
          select unnest(array_remove(array[v_entry.owner_id, r.debitore_id, r.creditore_id], null))
        loop
          insert into public.notifiche(
            destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
            owner_della_mossa, stato, priorita, scadenza_il,
            relativa_a_data_nozze_giorni
          ) values (
            v_dest_id, p_entry_id, v_tipo, v_titolo, v_descr, v_link,
            v_dest_id, 'PENDING', v_priorita, v_scadenza_il, v_offset
          )
          on conflict (destinatario_id, evento_id, tipo) do update
            set titolo = excluded.titolo,
                descrizione = excluded.descrizione,
                link_action = excluded.link_action,
                owner_della_mossa = excluded.owner_della_mossa,
                priorita = excluded.priorita,
                scadenza_il = excluded.scadenza_il,
                relativa_a_data_nozze_giorni = excluded.relativa_a_data_nozze_giorni,
                stato = case when public.notifiche.stato in ('DONE','SKIPPED')
                               then public.notifiche.stato else 'PENDING' end,
                letto_il = case when public.notifiche.stato in ('DONE','SKIPPED')
                                  then public.notifiche.letto_il else null end;
          v_count := v_count + 1;
        end loop;
      end loop;
    end loop;
  exception when undefined_table then
    null;
  end;

  return v_count;
end;
$$;

comment on function public.notifiche_genera_promemoria_per_evento(uuid) is
  'Genera/aggiorna fino a 4 promemoria (-30/-14/-7/-2 giorni) per ogni voce di scadenzario e per la data evento. Idempotente.';

revoke all on function public.notifiche_genera_promemoria_per_evento(uuid) from public;
grant execute on function public.notifiche_genera_promemoria_per_evento(uuid) to authenticated;

-- 3. Vista digest -----------------------------------------------------------

drop view if exists public.v_notifiche_digest_per_utente;
create view public.v_notifiche_digest_per_utente
with (security_invoker = true)
as
select
  n.data_digest,
  n.destinatario_id,
  count(*)                                  as totale,
  coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'evento_id', n.evento_id,
      'tipo', n.tipo,
      'titolo', n.titolo,
      'descrizione', n.descrizione,
      'link_action', n.link_action,
      'priorita', n.priorita,
      'scadenza_il', n.scadenza_il
    )
    order by n.priorita desc, n.scadenza_il asc
  ) filter (where n.rn <= 10), '[]'::jsonb) as primi_10
from (
  select
    nn.id, nn.evento_id, nn.destinatario_id, nn.tipo, nn.titolo, nn.descrizione,
    nn.link_action, nn.priorita, nn.scadenza_il,
    (nn.scadenza_il at time zone 'Europe/Rome')::date as data_digest,
    row_number() over (
      partition by nn.destinatario_id,
                   (nn.scadenza_il at time zone 'Europe/Rome')::date
      order by nn.priorita desc, nn.scadenza_il asc
    ) as rn
  from public.notifiche nn
  where nn.stato = 'PENDING'
    and nn.scadenza_il is not null
) n
group by n.data_digest, n.destinatario_id;

comment on view public.v_notifiche_digest_per_utente is
  'Digest giornaliero: per ogni (data, destinatario) elenca count + JSON delle prime 10 notifiche PENDING in scadenza quel giorno.';

-- 4. Funzione placeholder digest --------------------------------------------

create or replace function public.invia_digest_giornaliero()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_oggi  date := (now() at time zone 'Europe/Rome')::date;
  v_tot   int := 0;
begin
  for r in
    select destinatario_id, totale, primi_10
      from public.v_notifiche_digest_per_utente
     where data_digest = v_oggi
  loop
    raise notice 'digest user=% count=% primi=%',
      r.destinatario_id, r.totale, r.primi_10;
    v_tot := v_tot + 1;
  end loop;
  return v_tot;
end;
$$;

comment on function public.invia_digest_giornaliero() is
  'Placeholder digest: logga via RAISE NOTICE per ogni utente con notifiche del giorno. Da chiamare via pg_cron quotidianamente. Sostituire con call a edge function email in futuro.';

revoke all on function public.invia_digest_giornaliero() from public;
grant execute on function public.invia_digest_giornaliero() to authenticated;

-- 5. pg_cron (documentato, non eseguito) -------------------------------------
-- L'estensione pg_cron va abilitata da Supabase dashboard:
--   Database -> Extensions -> pg_cron -> Enable.
-- Una volta abilitata, schedulare con (esempio, 8:00 ora server):
--   select cron.schedule(
--     'invia-digest-giornaliero',
--     '0 8 * * *',
--     $$select public.invia_digest_giornaliero();$$
--   );
-- E per rigenerare i promemoria di tutti gli eventi futuri ogni notte:
--   select cron.schedule(
--     'rigenera-promemoria',
--     '15 2 * * *',
--     $$do $$
--        declare r record;
--        begin
--          for r in select id from public.calendar_entries
--                    where date_from >= current_date
--          loop
--            perform public.notifiche_genera_promemoria_per_evento(r.id);
--          end loop;
--        end$$;$$
--   );
