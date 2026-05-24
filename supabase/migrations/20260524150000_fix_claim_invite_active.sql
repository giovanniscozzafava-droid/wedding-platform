-- Fix: claim_supplier_invite creava collaboration in PENDING.
-- Logica corretta: il fornitore ha CONFERMATO cliccando l'invito + signup,
-- quindi la collaboration deve essere ACTIVE subito. PENDING ha senso solo
-- quando il WP invita un fornitore esistente che non ha ancora confermato.
--
-- Bug effetto: con collab PENDING la RLS profiles_select_collab_supplier
-- non si attiva (richiede ACTIVE) → il WP non vede il profilo del fornitore
-- nella sua lista /suppliers.

create or replace function claim_supplier_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_user   auth.users%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into v_user from auth.users where id = auth.uid();
  if not found then return false; end if;

  select * into v_invite from supplier_invites
    where token = p_token and status = 'PENDING' and expires_at > now()
    limit 1;
  if not found then return false; end if;

  if lower(v_invite.email) <> lower(v_user.email) then return false; end if;

  update profiles set role = 'FORNITORE',
                      subrole = coalesce(subrole, v_invite.subrole_hint)
    where id = auth.uid();

  -- Crea collaboration ACTIVE (fornitore ha confermato cliccando invito)
  insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
  values (v_invite.capostipite_id, auth.uid(), 'ACTIVE', now())
  on conflict (capostipite_id, fornitore_id)
  do update set status = 'ACTIVE', accepted_at = coalesce(collaborations.accepted_at, now());

  update supplier_invites
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invite.id;

  return true;
end$$;

-- Fix dati esistenti: collaborations PENDING con invite_token e supplier_invites in ACCEPTED
-- → portale ACTIVE. Sono fornitori che hanno gia accettato ma sono rimasti bloccati in PENDING.
update collaborations c
   set status = 'ACTIVE', accepted_at = coalesce(c.accepted_at, now())
 where c.status = 'PENDING'
   and c.invite_token is not null
   and exists (
     select 1 from supplier_invites si
      where si.token = c.invite_token
        and si.status = 'ACCEPTED'
   );
