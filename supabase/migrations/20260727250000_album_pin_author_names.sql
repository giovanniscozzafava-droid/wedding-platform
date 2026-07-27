-- Sul catalogo PDF il fotografo deve sapere QUALE cliente ha messo il pin (con chi dialoga).
-- album_pins.created_by c'è, ma le policy di `profiles` non lasciano al fotografo leggere il
-- profilo della coppia (non PUBLIC, nessuna collaborazione). Questa RPC — autorizzata a chi
-- possiede l'evento (o è admin, o è l'autore stesso) — risolve i nomi bypassando la RLS profili.
create or replace function public.album_pin_author_names(p_entry_id uuid)
returns table(user_id uuid, name text, role text)
language sql stable security definer set search_path = public as $$
  select distinct ap.created_by,
         coalesce(nullif(pr.business_name, ''), pr.full_name) as name,
         pr.role::text
    from public.album_pins ap
    join public.profiles pr on pr.id = ap.created_by
   where ap.entry_id = p_entry_id
     and ap.created_by is not null
     and (
       exists (select 1 from public.calendar_entries ce where ce.id = p_entry_id and ce.owner_id = auth.uid())
       or public.is_admin()
       or ap.created_by = auth.uid()
     );
$$;

revoke all on function public.album_pin_author_names(uuid) from public, anon;
grant execute on function public.album_pin_author_names(uuid) to authenticated;
