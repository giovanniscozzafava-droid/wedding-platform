-- Porta ospiti/invitati: link dedicato + accesso SOLO previa registrazione, e SOLO
-- alle foto INVITATI dell'evento (niente dashboard, niente altre cartelle).
--
-- FIX SICUREZZA: la policy gg_self permetteva a QUALSIASI utente loggato di
-- auto-inserirsi come ospite di QUALSIASI evento (l'entry_id è negli URL) e quindi
-- leggere le foto degli invitati altrui. Ora l'ingresso ospite passa SOLO da un token
-- (RPC security-definer) o dall'owner; l'utente non può più auto-aggiungersi a eventi
-- arbitrari.

alter table public.event_galleries add column if not exists guest_token text;

-- L'owner (fotografo) genera/recupera il token del link ospiti.
create or replace function public.gallery_enable_guest_link(p_gallery_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok text; v_found boolean;
begin
  select guest_token, true into v_tok, v_found from public.event_galleries
   where id = p_gallery_id and (owner_id = auth.uid() or public.is_admin());
  if not v_found then return jsonb_build_object('error', 'forbidden'); end if;
  if v_tok is null then
    v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.event_galleries set guest_token = v_tok where id = p_gallery_id;
  end if;
  return jsonb_build_object('ok', true, 'token', v_tok);
end$$;
grant execute on function public.gallery_enable_guest_link(uuid) to authenticated;

-- L'ospite (loggato) entra col token → diventa guest dell'evento. Idempotente.
create or replace function public.join_event_as_guest(p_gallery_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_tok text;
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
  return jsonb_build_object('ok', true, 'entry_id', v_entry, 'gallery_id', p_gallery_id);
end$$;
grant execute on function public.join_event_as_guest(uuid, text) to authenticated;

-- FIX: niente più self-insert. Lettura: la propria riga oppure l'owner/admin.
-- Scrittura: solo owner/admin (l'ingresso ospite passa dalla RPC security-definer).
drop policy if exists gg_self on public.gallery_guests;

create policy gg_select on public.gallery_guests for select using (
  guest_user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.event_galleries g where g.entry_id = gallery_guests.entry_id and g.owner_id = auth.uid())
);

create policy gg_write_owner on public.gallery_guests for all
  using (
    public.is_admin()
    or exists (select 1 from public.event_galleries g where g.entry_id = gallery_guests.entry_id and g.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.event_galleries g where g.entry_id = gallery_guests.entry_id and g.owner_id = auth.uid())
  );
