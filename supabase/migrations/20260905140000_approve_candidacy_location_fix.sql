-- ============================================================================
-- GER-05: approve_candidacy creava la collaboration ACTIVE solo se il
-- candidato era FORNITORE. Una LOCATION che si candida (segue) un WP e
-- viene approvata risultava "seguita" ma non entrava mai nel team — nessun
-- errore visibile, solo un'approvazione senza effetto reale.
-- Fix: stessa regola di capostipite_add_supplier/wp_add_location_to_team —
-- un WP può reclutare anche una LOCATION candidata. Una LOCATION non può
-- reclutare nessuno (regola gerarchia invariata: resta esclusa).
-- ============================================================================

create or replace function approve_candidacy(p_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me_role text;
  v_other_role text;
begin
  if auth.uid() is null then return false; end if;

  select role::text into v_me_role from profiles where id = auth.uid();
  select role::text into v_other_role from profiles where id = p_follower;

  -- 1. Approva il follow
  update follows
     set status = 'APPROVED', decided_at = now()
   where follower_id = p_follower
     and followed_id = auth.uid()
     and status = 'PENDING';

  if not found then return false; end if;

  -- 2. Se chi si candidava è un FORNITORE (a un WP/LOCATION), o una LOCATION
  --    candidata a un WP (mai il contrario), crea/riattiva la collaboration.
  if (v_me_role in ('WEDDING_PLANNER', 'LOCATION') and v_other_role = 'FORNITORE')
     or (v_me_role = 'WEDDING_PLANNER' and v_other_role = 'LOCATION')
  then
    insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
    values (auth.uid(), p_follower, 'ACTIVE', now())
    on conflict (capostipite_id, fornitore_id) do update
      set status = 'ACTIVE',
          accepted_at = coalesce(collaborations.accepted_at, now());
  end if;

  return true;
end$$;

grant execute on function approve_candidacy(uuid) to authenticated;
