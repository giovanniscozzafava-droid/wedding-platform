-- join_event_as_guest ritorna anche il NOME degli sposi/evento, per personalizzare la
-- schermata ospite ("Le foto di Zoe & Marco").
create or replace function public.join_event_as_guest(p_gallery_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_tok text; v_name text;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth_required'); end if;
  select entry_id, guest_token into v_entry, v_tok from public.event_galleries where id = p_gallery_id;
  if v_entry is null then return jsonb_build_object('error', 'gallery_not_found'); end if;
  if v_tok is null or p_token is null or p_token <> v_tok then
    return jsonb_build_object('error', 'bad_token');
  end if;
  insert into public.gallery_guests(entry_id, guest_user_id, registered_at)
  values (v_entry, auth.uid(), now())
  on conflict (entry_id, guest_user_id) do nothing;

  select coalesce(
           nullif(cp.couple_name, ''),
           nullif(btrim(concat_ws(' & ', nullif(cp.bride_name, ''), nullif(cp.groom_name, ''))), ''),
           nullif(ce.title, ''),
           'il matrimonio'
         )
    into v_name
    from public.calendar_entries ce
    left join public.couple_preferences cp on cp.entry_id = ce.id
   where ce.id = v_entry;

  return jsonb_build_object('ok', true, 'entry_id', v_entry, 'gallery_id', p_gallery_id, 'event_name', v_name);
end$$;
grant execute on function public.join_event_as_guest(uuid, text) to authenticated;
