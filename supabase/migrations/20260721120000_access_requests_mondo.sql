-- ============================================================================
-- Provenienza del lead d'accesso: da QUALE mondo (pagina di categoria) arriva.
-- La CTA "Richiedi accesso" su planfully.it/<slug> porta ?mondo=<slug> al form,
-- che lo passa all'edge. Qui lo storiamo e lo mostriamo all'admin.
-- ============================================================================
alter table public.access_requests add column if not exists mondo varchar(40);

-- Notifica campanello: se il lead arriva da un mondo, dillo nel dettaglio.
create or replace function public.trg_access_request_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_ruolo text; v_prov text; v_mondo text;
begin
  v_ruolo := case new.ruolo
    when 'LOCATION' then 'Location' when 'WEDDING_PLANNER' then 'Wedding planner'
    when 'FORNITORE' then 'Fornitore' else coalesce(new.ruolo_altro, 'Altro') end;
  v_prov := coalesce((select nome from province_regioni where provincia = new.provincia), '');
  v_mondo := case when coalesce(new.mondo, '') <> '' then ' · da /' || new.mondo else '' end;
  for a in select id from public.profiles where role = 'ADMIN' loop
    perform public.push_user_notification(
      a.id, 'ACCESS_REQUEST', 'Nuova richiesta di accesso',
      new.attivita || ' · ' || v_ruolo
        || case when v_prov <> '' then ' · ' || v_prov else '' end || v_mondo,
      '/admin/richieste-accesso', new.id);
  end loop;
  return new;
end$$;

-- Elenco admin: aggiunge `mondo`. Il tipo di ritorno cambia → DROP + CREATE.
drop function if exists public.access_requests_list();
create function public.access_requests_list()
returns table (
  id uuid, nome text, attivita text, ruolo text, ruolo_altro text,
  email text, telefono text, provincia_nome text, messaggio text,
  source text, mondo text, stato text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.nome::text, r.attivita::text, r.ruolo, r.ruolo_altro::text,
           r.email::text, r.telefono::text, p.nome::text, r.messaggio,
           r.source::text, r.mondo::text, r.stato, r.created_at
    from access_requests r
    left join province_regioni p on p.provincia = r.provincia
    order by r.created_at desc;
end$$;
revoke all on function public.access_requests_list() from anon, public;
grant execute on function public.access_requests_list() to authenticated;
