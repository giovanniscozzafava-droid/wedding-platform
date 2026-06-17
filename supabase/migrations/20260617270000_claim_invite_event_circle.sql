-- La pagina di accettazione invito fornitore usa claim_supplier_invite (non
-- accept_supplier_invite). Aggiungo qui l'ingresso automatico nel CERCHIO quando
-- l'invito è legato a un EVENTO PASSATO: il fornitore, appena iscritto, è dentro
-- al cerchio (confirmed=true) e vede le foto condivise — senza vidimazione sposi.
create or replace function public.claim_supplier_invite(p_token uuid)
returns boolean
language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare
  v_invite supplier_invites%rowtype;
  v_user   auth.users%rowtype;
  v_prof   profiles%rowtype;
  v_seed   text;
  v_color  text;
  v_logo   text;
  v_colors text[] := array['C49A5C','1A2E4F','7E6633','D4A5A5','9CAF88','8B4513','B19CD9','1F3A5F'];
begin
  if auth.uid() is null then return false; end if;
  select * into v_user from auth.users where id = auth.uid();
  if not found then return false; end if;

  -- Accetta sia PENDING che ACCEPTED (idempotente)
  select * into v_invite from supplier_invites
    where token = p_token and expires_at > now()
    limit 1;
  if not found then return false; end if;
  if lower(v_invite.email) <> lower(v_user.email) then return false; end if;

  update profiles set role = 'FORNITORE',
                      subrole = coalesce(subrole, v_invite.subrole_hint)
    where id = auth.uid();

  -- Auto-DiceBear logo se mancante
  select * into v_prof from profiles where id = auth.uid();
  if v_prof.brand_logo_url is null or v_prof.brand_logo_url = '' then
    v_seed := substring(coalesce(v_prof.business_name, v_prof.full_name, v_user.email, 'Fornitore'), 1, 30);
    v_color := v_colors[1 + (abs(hashtext(v_seed)) % array_length(v_colors, 1))];
    v_logo := 'https://api.dicebear.com/9.x/initials/svg?seed=' ||
              replace(replace(replace(v_seed, ' ', '%20'), '&', '%26'), '''', '%27') ||
              '&backgroundColor=' || v_color ||
              '&fontWeight=700&fontSize=42&textColor=ffffff';
    update profiles
       set brand_logo_url = v_logo,
           brand_primary_color = coalesce(brand_primary_color, '#' || v_color)
     where id = auth.uid();
  end if;

  -- Forza collab ACTIVE
  insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
  values (v_invite.capostipite_id, auth.uid(), 'ACTIVE', now())
  on conflict (capostipite_id, fornitore_id)
  do update set status = 'ACTIVE', accepted_at = coalesce(collaborations.accepted_at, now());

  -- Invito legato a un EVENTO PASSATO → dentro al cerchio subito (niente vidimazione).
  if v_invite.entry_id is not null then
    if (select coalesce(date_to, date_from) < current_date from calendar_entries where id = v_invite.entry_id) then
      insert into calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
      values (v_invite.entry_id, auth.uid(),
              coalesce(nullif(v_invite.role_key, ''), v_prof.subrole, 'fornitore'), true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    end if;
  end if;

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id and status <> 'ACCEPTED';

  return true;
end$function$;
