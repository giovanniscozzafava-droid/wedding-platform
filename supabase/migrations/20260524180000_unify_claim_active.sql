-- Unifica il flusso di accettazione invito fornitore:
-- prima c'era CONFLITTO tra:
--   1) trigger process_supplier_invite_on_confirm (su auth.users update)
--      che creava collab PENDING + marcava invite ACCEPTED
--   2) RPC claim_supplier_invite (chiamata dal frontend)
--      che dovrebbe creare collab ACTIVE
-- Risultato: il trigger girava per primo -> collab restava PENDING ->
--           la RPC trovava l'invito gia` ACCEPTED -> ritornava false ->
--           il WP non vedeva il fornitore (RLS profiles richiede ACTIVE).

-- 1. Trigger: ora crea/aggiorna collab a ACTIVE invece di PENDING
create or replace function process_supplier_invite_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_token_text text;
begin
  if old.email_confirmed_at is not null then return new; end if;
  if new.email_confirmed_at is null then return new; end if;

  v_token_text := new.raw_user_meta_data->>'invite_token';
  if v_token_text is null then return new; end if;

  select * into v_invite from supplier_invites
    where token = v_token_text::uuid and expires_at > now()
    limit 1;
  if not found then return new; end if;
  if lower(v_invite.email) <> lower(new.email) then return new; end if;

  insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
  values (v_invite.capostipite_id, new.id, 'ACTIVE', now())
  on conflict (capostipite_id, fornitore_id)
  do update set status = 'ACTIVE', accepted_at = coalesce(collaborations.accepted_at, now());

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id and status <> 'ACCEPTED';

  return new;
end$$;

-- 2. RPC: ora idempotente. Se l'invito e' gia' ACCEPTED (trigger l'ha fatto)
--    forza comunque collab ACTIVE e ritorna true (success).
create or replace function claim_supplier_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
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

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id and status <> 'ACCEPTED';

  return true;
end$$;

-- 3. Fix dati esistenti: tutte le collab PENDING dove il fornitore ha
--    accettato il suo invito (supplier_invites ACCEPTED matching email)
--    -> portale a ACTIVE.
update collaborations c
   set status = 'ACTIVE',
       accepted_at = coalesce(c.accepted_at, now())
  from auth.users u, supplier_invites si
 where c.status = 'PENDING'
   and c.fornitore_id = u.id
   and lower(si.email) = lower(u.email)
   and si.capostipite_id = c.capostipite_id
   and si.status = 'ACCEPTED';
