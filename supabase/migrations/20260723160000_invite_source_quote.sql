-- ════════════════════════════════════════════════════════════════════════════
-- Invito fornitore legato a un PREVENTIVO — referral verso un professionista che
-- NON è ancora su Planfully. Dal proprio preventivo un fornitore invita un collega
-- a preventivare per lo STESSO cliente. All'accettazione dell'invito materializziamo
-- il "suggerimento cieco" (supplier_suggestions + _private) riusando tutta la
-- pipeline esistente, così il nuovo iscritto atterra già sul contesto di quel
-- cliente e può comporre + inviare il preventivo cieco.
--
-- PII del cliente (nome/email) va SOLO in supplier_suggestions_private, mai
-- nell'invito né in tabelle di proprietà del fornitore. I contatti si sbloccano
-- (via RLS sugg_priv_select) solo se il cliente accetta il preventivo.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) L'invito può portare il preventivo di partenza.
alter table public.supplier_invites
  add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;

comment on column public.supplier_invites.source_quote_id is
  'Se valorizzato: invito a preventivare per il cliente di questo preventivo. All''accettazione, claim_supplier_invite materializza il supplier_suggestion cieco.';

-- 2) Estende claim_supplier_invite (base: 20260619190000) aggiungendo — quando
--    l'invito porta un source_quote_id — la creazione del suggerimento cieco.
--    Resto della funzione IDENTICO alla versione precedente.
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
  v_was_accepted boolean;
  v_q      public.quotes%rowtype;
  v_sugg_id uuid;
  v_colors text[] := array['C49A5C','1A2E4F','7E6633','D4A5A5','9CAF88','8B4513','B19CD9','1F3A5F'];
begin
  if auth.uid() is null then return false; end if;
  select * into v_user from auth.users where id = auth.uid();
  if not found then return false; end if;

  select * into v_invite from supplier_invites where token = p_token and expires_at > now() limit 1;
  if not found then return false; end if;
  if lower(v_invite.email) <> lower(v_user.email) then return false; end if;
  v_was_accepted := (v_invite.status = 'ACCEPTED');

  update profiles set role = 'FORNITORE', subrole = coalesce(subrole, v_invite.subrole_hint) where id = auth.uid();

  select * into v_prof from profiles where id = auth.uid();
  if v_prof.brand_logo_url is null or v_prof.brand_logo_url = '' then
    v_seed := substring(coalesce(v_prof.business_name, v_prof.full_name, v_user.email, 'Fornitore'), 1, 30);
    v_color := v_colors[1 + (abs(hashtext(v_seed)) % array_length(v_colors, 1))];
    v_logo := 'https://api.dicebear.com/9.x/initials/svg?seed=' ||
              replace(replace(replace(v_seed, ' ', '%20'), '&', '%26'), '''', '%27') ||
              '&backgroundColor=' || v_color || '&fontWeight=700&fontSize=42&textColor=ffffff';
    update profiles set brand_logo_url = v_logo, brand_primary_color = coalesce(brand_primary_color, '#' || v_color) where id = auth.uid();
  end if;

  insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
  values (v_invite.capostipite_id, auth.uid(), 'ACTIVE', now())
  on conflict (capostipite_id, fornitore_id)
  do update set status = 'ACTIVE', accepted_at = coalesce(collaborations.accepted_at, now());

  if v_invite.entry_id is not null then
    if (select coalesce(date_to, date_from) < current_date from calendar_entries where id = v_invite.entry_id) then
      insert into calendar_entry_participants (entry_id, user_id, role_in_entry, confirmed)
      values (v_invite.entry_id, auth.uid(), coalesce(nullif(v_invite.role_key, ''), v_prof.subrole, 'fornitore'), true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    end if;
  end if;

  -- NOVITÀ: invito legato a un preventivo → materializza il suggerimento cieco.
  -- referrer = owner del preventivo di partenza; PII cliente SOLO in _private.
  if v_invite.source_quote_id is not null then
    select * into v_q from public.quotes where id = v_invite.source_quote_id;
    if found and v_q.owner_id is not null and v_q.owner_id <> auth.uid() then
      insert into public.supplier_suggestions
        (referrer_id, supplier_id, source_quote_id, event_kind, event_date, event_location, guest_count, status)
      values
        (v_q.owner_id, auth.uid(), v_q.id, coalesce(v_q.event_kind, 'matrimonio'),
         v_q.event_date, v_q.event_location, v_q.guest_count, 'SENT')
      on conflict (referrer_id, supplier_id, source_quote_id) do nothing
      returning id into v_sugg_id;

      if v_sugg_id is not null then
        insert into public.supplier_suggestions_private
          (suggestion_id, client_name, client_email, client_phone, message)
        values (v_sugg_id, v_q.client_name, v_q.client_email, null, v_invite.message)
        on conflict (suggestion_id) do nothing;
      end if;
    end if;
  end if;

  update supplier_invites set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id and status <> 'ACCEPTED';

  -- Avvisa il capostipite alla PRIMA accettazione (non a se stesso, non sui re-claim).
  if not v_was_accepted and v_invite.capostipite_id is not null and v_invite.capostipite_id <> auth.uid() then
    perform public.push_user_notification(v_invite.capostipite_id, 'supplier_invite_accepted',
      'Un fornitore ha accettato il tuo invito',
      coalesce(nullif(v_prof.business_name, ''), v_prof.full_name, 'Un fornitore') || ' è ora nella tua rete.',
      '/suppliers', v_invite.entry_id);
  end if;

  return true;
end$function$;
