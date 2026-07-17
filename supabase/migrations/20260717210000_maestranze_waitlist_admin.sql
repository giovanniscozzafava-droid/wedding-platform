-- ============================================================================
-- "Il pannello admin deve sapere tutto, ogni iscritto mi deve essere notificato."
--
-- Due cose:
--  1. NOTIFICA all'admin per ogni iscritto — al momento della CONFERMA email, non
--     dell'iscrizione grezza. Il double opt-in esiste per filtrare typo e bot che
--     passano l'honeypot: notificare prima della conferma sarebbe rumore, non contezza.
--     La riga non confermata resta comunque visibile in dashboard (vedi punto 2).
--  2. LISTA NOMINATIVA completa in dashboard: ogni iscritto con tutti i suoi dati e
--     lo stato (confermato / in attesa). Admin-only.
-- ============================================================================

-- ---------------------------------------------- 1. notifica alla conferma
create or replace function public.trg_waitlist_notify_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_mestiere text; v_prov text;
begin
  -- Scatta SOLO quando email_confirmed_at passa da NULL a valorizzato (la conferma).
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;
  v_mestiere := coalesce((select name from maestranze_skills where id = new.skill_id),
                         new.professione_altro, 'mestiere non indicato');
  v_prov := coalesce((select nome from province_regioni where provincia = new.provincia), new.provincia);
  for a in select id from public.profiles where role = 'ADMIN' loop
    insert into public.notifiche(destinatario_id, evento_id, tipo, titolo, descrizione, link_action, priorita)
    values (a.id, null, 'MAESTRANZA_WAITLIST', 'Nuovo iscritto Maestranze',
            new.nome || ' · ' || v_mestiere || ' · ' || v_prov,
            '/admin/maestranze/waitlist', 3);
  end loop;
  return new;
end$$;

drop trigger if exists trg_waitlist_notify_confirm on public.maestranze_waitlist;
create trigger trg_waitlist_notify_confirm
  after update on public.maestranze_waitlist
  for each row execute function public.trg_waitlist_notify_confirm();

-- --------------------------------------------- 2. lista nominativa (admin)
-- Elenco completo, ogni iscritto con TUTTO. La tabella è chiusa: qui SECURITY DEFINER
-- con guard admin esplicito, come le altre RPC amministrative del modulo.
create or replace function public.maestranze_waitlist_list()
returns table (
  id                 uuid,
  nome               varchar,
  email              varchar,
  telefono           varchar,
  mestiere           text,
  famiglia           varchar,
  provincia_nome     varchar,
  regione            varchar,
  disponibilita      text[],
  instagram          varchar,
  portfolio          text,
  source             varchar,
  privacy_version    varchar,
  privacy_accepted_at timestamptz,
  confermato         boolean,
  email_confirmed_at timestamptz,
  created_at         timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select w.id, w.nome, w.email, w.telefono,
           coalesce(s.name, w.professione_altro, '—') as mestiere,
           s.famiglia,
           p.nome, p.regione,
           w.disponibilita, w.instagram, w.portfolio, w.source,
           w.privacy_version, w.privacy_accepted_at,
           (w.email_confirmed_at is not null) as confermato,
           w.email_confirmed_at, w.created_at
    from maestranze_waitlist w
    left join maestranze_skills s on s.id = w.skill_id
    left join province_regioni p on p.provincia = w.provincia
    order by w.created_at desc;
end$$;
revoke all on function public.maestranze_waitlist_list() from anon, public;
grant execute on function public.maestranze_waitlist_list() to authenticated;
