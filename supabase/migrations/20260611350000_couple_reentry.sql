-- Rende il link invito-coppia un LINK PERMANENTE di accesso: se l'invito è già stato
-- accettato, non dà errore ma ritorna i dati con already=true, così la coppia può
-- RIENTRARE facendo login (la pagina mostra il form di accesso).
create or replace function public.resolve_couple_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare
  v_member public.wedding_couple_members%rowtype;
  v_entry  public.calendar_entries%rowtype;
  v_owner  public.profiles%rowtype;
  v_kind   text; v_already boolean := false;
begin
  select * into v_member from public.wedding_couple_members where invite_token = p_token and user_id is null limit 1;
  if not found then
    -- forse già accettato → consenti il rientro (login)
    select * into v_member from public.wedding_couple_members where invite_token = p_token limit 1;
    if not found then return jsonb_build_object('error', 'invito non valido'); end if;
    v_already := true;
  end if;
  select * into v_entry from public.calendar_entries where id = v_member.entry_id;
  if not found then return jsonb_build_object('error', 'evento non trovato'); end if;
  select * into v_owner from public.profiles where id = v_entry.owner_id;
  v_kind := v_entry.event_kind;
  if v_kind is null and v_entry.quote_id is not null then select event_kind into v_kind from public.quotes where id = v_entry.quote_id; end if;
  v_kind := coalesce(v_kind, 'matrimonio');
  return jsonb_build_object(
    'email', v_member.email, 'full_name', v_member.full_name, 'role', v_member.role,
    'wedding_title', v_entry.title, 'wedding_date', v_entry.date_from,
    'planner_name', coalesce(v_owner.business_name, v_owner.full_name), 'event_kind', v_kind, 'already', v_already
  );
end$function$;
grant execute on function public.resolve_couple_invite(uuid) to anon, authenticated;

-- Link di accesso/rientro della coppia per un evento (per il pulsante "Link coppia").
create or replace function public.couple_access_link(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_tok uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_owner <> auth.uid() and not coalesce(public.is_admin(), false) then return jsonb_build_object('error', 'forbidden'); end if;
  select invite_token into v_tok from public.wedding_couple_members where entry_id = p_entry order by created_at limit 1;
  if v_tok is null then return jsonb_build_object('error', 'no_couple'); end if;
  return jsonb_build_object('ok', true, 'token', v_tok::text);
end$$;
grant execute on function public.couple_access_link(uuid) to authenticated;
