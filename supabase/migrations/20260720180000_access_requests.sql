-- ============================================================================
-- RICHIESTE D'ACCESSO dalla landing. La CTA "Richiedi accesso" non è più un mailto:
-- diventa un form → riga qui → notifica all'admin (campanello) + elenco in area admin.
-- Tabella CHIUSA come la waitlist: scrive solo l'edge con service_role, legge solo admin.
-- ============================================================================
create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  nome         varchar(120) not null,
  attivita     varchar(160) not null,     -- nome dell'attività / azienda
  ruolo        text not null check (ruolo in ('LOCATION','WEDDING_PLANNER','FORNITORE','ALTRO')),
  ruolo_altro  varchar(80),
  email        varchar(255) not null,
  telefono     varchar(30),
  provincia    varchar(4) references public.province_regioni(provincia),
  messaggio    text check (char_length(messaggio) <= 1000),
  source       varchar(40),
  stato        text not null default 'NUOVA' check (stato in ('NUOVA','CONTATTATA','ACCETTATA','RIFIUTATA')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_access_requests_stato on public.access_requests(stato, created_at desc);

alter table public.access_requests enable row level security;
-- Nessuna policy INSERT: solo service_role (edge). Solo admin legge; admin aggiorna lo stato.
drop policy if exists "access_req_admin_select" on public.access_requests;
create policy "access_req_admin_select" on public.access_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "access_req_admin_update" on public.access_requests;
create policy "access_req_admin_update" on public.access_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifica gli admin nel CAMPANELLO (user_notifications) a ogni nuova richiesta.
create or replace function public.trg_access_request_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_ruolo text; v_prov text;
begin
  v_ruolo := case new.ruolo
    when 'LOCATION' then 'Location' when 'WEDDING_PLANNER' then 'Wedding planner'
    when 'FORNITORE' then 'Fornitore' else coalesce(new.ruolo_altro, 'Altro') end;
  v_prov := coalesce((select nome from province_regioni where provincia = new.provincia), '');
  for a in select id from public.profiles where role = 'ADMIN' loop
    perform public.push_user_notification(
      a.id, 'ACCESS_REQUEST', 'Nuova richiesta di accesso',
      new.attivita || ' · ' || v_ruolo || case when v_prov <> '' then ' · ' || v_prov else '' end,
      '/admin/richieste-accesso', new.id);
  end loop;
  return new;
end$$;
drop trigger if exists trg_access_request_notify on public.access_requests;
create trigger trg_access_request_notify
  after insert on public.access_requests
  for each row execute function public.trg_access_request_notify();

-- Elenco per l'area admin (guard esplicito, come le altre RPC amministrative).
create or replace function public.access_requests_list()
returns table (
  id uuid, nome text, attivita text, ruolo text, ruolo_altro text,
  email text, telefono text, provincia_nome text, messaggio text,
  source text, stato text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.nome::text, r.attivita::text, r.ruolo, r.ruolo_altro::text,
           r.email::text, r.telefono::text, p.nome::text, r.messaggio,
           r.source::text, r.stato, r.created_at
    from access_requests r
    left join province_regioni p on p.provincia = r.provincia
    order by r.created_at desc;
end$$;
revoke all on function public.access_requests_list() from anon, public;
grant execute on function public.access_requests_list() to authenticated;

-- L'admin cambia lo stato della richiesta.
create or replace function public.access_request_set_stato(p_id uuid, p_stato text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_stato not in ('NUOVA','CONTATTATA','ACCETTATA','RIFIUTATA') then raise exception 'stato non valido'; end if;
  update access_requests set stato = p_stato where id = p_id;
end$$;
revoke all on function public.access_request_set_stato(uuid, text) from anon, public;
grant execute on function public.access_request_set_stato(uuid, text) to authenticated;
