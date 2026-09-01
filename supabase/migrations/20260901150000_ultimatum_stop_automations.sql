-- ULTIMATUM, seconda passata (Giovanni, 01/09/2026):
--   «se non sei più interessato alla data, comunicacelo, basta che clicchi qua.
--    Se non interessato si apre un perché. Se dice prezzo, in automatico soluzione
--    con sconto del 10%. Se dice altre soluzioni, ringrazialo e addio. Da quel
--    momento si blocca ogni automazione nei confronti del cliente. Rimane attivo
--    solo per la newsletter.»
--
-- Tre cose: (1) il default dello sconto è 10%, non 0; (2) un "no" che NON è il prezzo
-- ferma ogni automazione verso quel cliente; (3) la newsletter non si tocca — non vive
-- nemmeno in questo database (sta su Brevo), quindi basta non disiscrivere nessuno.

alter table public.profiles alter column ultimatum_discount_percent set default 10;
-- La colonna è nata un'ora fa con default 0 e nessuno l'ha ancora impostata:
-- allinearla al 10% chiesto non sovrascrive nessuna scelta di nessuno.
update public.profiles set ultimatum_discount_percent = 10 where ultimatum_discount_percent = 0;

-- Quando si spegne: da qui in poi niente follow-up, niente solleciti, niente promemoria.
alter table public.supplier_clients
  add column if not exists automations_blocked_at timestamptz;
comment on column public.supplier_clients.automations_blocked_at is
  'Il cliente ha detto che non è più interessato: stop a ogni automazione. La newsletter è un altro sistema e resta.';

create or replace function public.ultimatum_respond_by_token(
  p_token uuid, p_interested boolean, p_reason text default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_u record; v_q record;
  v_applied boolean := false; v_blocked boolean := false;
  v_new_pct numeric; v_email text;
begin
  select * into v_u from quote_ultimatums where token = p_token;
  if v_u.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_u.expires_at < now() then return jsonb_build_object('error','expired'); end if;
  if v_u.responded_at is not null then
    return jsonb_build_object('error','already', 'discount_applied', v_u.discount_applied,
                              'discount_percent', v_u.discount_percent,
                              'still_interested', v_u.still_interested);
  end if;

  select * into v_q from quotes where id = v_u.quote_id;
  v_email := lower(nullif(trim(coalesce(v_q.client_email,'')),''));

  -- Preventivo già firmato o rifiutato: registro la risposta e basta, non tocco nulla.
  if v_q.status::text not in ('INVIATO','BOZZA') then
    update quote_ultimatums set responded_at = now(), still_interested = p_interested,
           reason = nullif(p_reason,'')::ultimatum_reason, note = nullif(trim(coalesce(p_note,'')),'')
     where id = v_u.id;
    return jsonb_build_object('ok', true, 'discount_applied', false, 'stale', true);
  end if;

  if p_interested is false then
    if p_reason = 'PREZZO' and coalesce(v_u.discount_percent,0) > 0 then
      -- L'unico "no" recuperabile senza trattativa: si risponde subito con la cifra.
      -- greatest: se il pro aveva già scontato di più, l'ultimatum non deve PEGGIORARE
      -- l'offerta che il cliente ha già in mano.
      v_new_pct := greatest(coalesce(v_q.total_discount_percent,0), v_u.discount_percent);
      if v_new_pct > coalesce(v_q.total_discount_percent,0) then
        update quotes set total_discount_percent = v_new_pct, updated_at = now() where id = v_q.id;
        v_applied := true;
      end if;
    else
      -- Ogni altro motivo: si ringrazia e si smette. Da qui in poi nessuna automazione
      -- verso questo cliente — né su questo preventivo né sugli altri dello stesso pro.
      -- funnel_paused è l'interruttore che funnel-cron già rispetta.
      update quotes set funnel_paused = true, updated_at = now()
       where owner_id = v_q.owner_id
         and status::text in ('INVIATO','BOZZA')
         and (id = v_q.id or (v_email is not null and lower(client_email) = v_email));
      if v_email is not null then
        update supplier_clients set automations_blocked_at = now(), updated_at = now()
         where supplier_id = v_q.owner_id and lower(email) = v_email
           and automations_blocked_at is null;
      end if;
      v_blocked := true;
    end if;
  end if;

  update quote_ultimatums
     set responded_at = now(), still_interested = p_interested,
         reason = nullif(p_reason,'')::ultimatum_reason,
         note = nullif(trim(coalesce(p_note,'')),''),
         discount_applied = v_applied
   where id = v_u.id;

  perform public.push_user_notification(
    v_u.owner_id,
    'quote_ultimatum',
    case when p_interested then 'Il cliente è ancora interessato' else 'Il cliente si è tirato indietro' end,
    coalesce(v_q.client_name, v_q.title) ||
      case when p_interested then ' ha confermato l''interesse sul preventivo.'
           else ' ha risposto: ' || coalesce(p_reason, 'nessun motivo') ||
                case when v_applied then '. Sconto del ' || trim(to_char(v_u.discount_percent,'FM990D99')) || '% applicato in automatico.'
                     when v_blocked then '. Automazioni sospese per questo contatto.'
                     else '.' end
      end,
    '/preventivi/' || v_q.id::text,
    v_q.id);

  return jsonb_build_object('ok', true, 'discount_applied', v_applied,
                            'discount_percent', v_u.discount_percent,
                            'automations_blocked', v_blocked);
end$$;

revoke all on function public.ultimatum_respond_by_token(uuid, boolean, text, text) from public;
grant execute on function public.ultimatum_respond_by_token(uuid, boolean, text, text) to anon, authenticated;
