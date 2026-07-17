-- Fix maestranze_waitlist_list: le colonne da coalesce()/join escono come `text`, non
-- `varchar` come dichiarato in RETURNS TABLE → "structure of query does not match function
-- result type" (42804). Dichiaro i campi stringa come text e casto esplicitamente.
-- CREATE OR REPLACE non può cambiare il tipo di ritorno → serve DROP prima.
drop function if exists public.maestranze_waitlist_list();

create function public.maestranze_waitlist_list()
returns table (
  id                 uuid,
  nome               text,
  email              text,
  telefono           text,
  mestiere           text,
  famiglia           text,
  provincia_nome     text,
  regione            text,
  disponibilita      text[],
  instagram          text,
  portfolio          text,
  source             text,
  privacy_version    text,
  privacy_accepted_at timestamptz,
  confermato         boolean,
  email_confirmed_at timestamptz,
  created_at         timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select w.id, w.nome::text, w.email::text, w.telefono::text,
           coalesce(s.name, w.professione_altro, '—')::text as mestiere,
           s.famiglia::text,
           p.nome::text, p.regione::text,
           w.disponibilita, w.instagram::text, w.portfolio::text, w.source::text,
           w.privacy_version::text, w.privacy_accepted_at,
           (w.email_confirmed_at is not null) as confermato,
           w.email_confirmed_at, w.created_at
    from maestranze_waitlist w
    left join maestranze_skills s on s.id = w.skill_id
    left join province_regioni p on p.provincia = w.provincia
    order by w.created_at desc;
end$$;
revoke all on function public.maestranze_waitlist_list() from anon, public;
grant execute on function public.maestranze_waitlist_list() to authenticated;
