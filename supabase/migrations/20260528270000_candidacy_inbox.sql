-- ============================================================================
-- Inbox candidature + approve_candidacy (approva + entra nel team)
-- ----------------------------------------------------------------------------
-- - pending_candidacies(): ritorna le richieste PENDING ricevute dall'utente
--   loggato (i fornitori che si sono candidati al WP).
-- - approve_candidacy(p_follower): set follows ACTIVE + crea collaboration
--   ACTIVE (entra nel "team" del capostipite).
-- - reject_candidacy(p_follower): set follows REJECTED.
-- ============================================================================

create or replace function pending_candidacies()
returns table (
  follower_id   uuid,
  follower_role text,
  full_name     text,
  business_name text,
  subrole       text,
  city          text,
  brand_logo_url text,
  slug          text,
  requested_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.follower_id,
    p.role::text,
    p.full_name,
    p.business_name,
    p.subrole,
    p.city,
    p.brand_logo_url,
    p.slug,
    f.created_at
  from follows f
  join profiles p on p.id = f.follower_id
  where f.followed_id = auth.uid()
    and f.status = 'PENDING'
  order by f.created_at desc;
$$;

grant execute on function pending_candidacies() to authenticated;

-- approve + entra nel team (collaboration ACTIVE)
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

  -- 2. Se è un fornitore che si candidava a WP/LOCATION → crea collaboration ACTIVE
  if v_me_role in ('WEDDING_PLANNER', 'LOCATION') and v_other_role = 'FORNITORE' then
    insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
    values (auth.uid(), p_follower, 'ACTIVE', now())
    on conflict (capostipite_id, fornitore_id) do update
      set status = 'ACTIVE',
          accepted_at = coalesce(collaborations.accepted_at, now());
  end if;

  return true;
end$$;

grant execute on function approve_candidacy(uuid) to authenticated;

create or replace function reject_candidacy(p_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  update follows
     set status = 'REJECTED', decided_at = now()
   where follower_id = p_follower
     and followed_id = auth.uid()
     and status = 'PENDING';
  return found;
end$$;

grant execute on function reject_candidacy(uuid) to authenticated;
