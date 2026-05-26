-- ============================================================================
-- FIX CRITICO: quando un fornitore si iscrive con codice referral, deve
-- entrare AUTOMATICAMENTE nella "pancia" (collaborations ACTIVE) della WP
-- referrer. Altrimenti il referral funziona per il credit ma non per la
-- rete di lavoro effettiva.
--
-- Anche backfill: i 32 fornitori test esistenti vanno aggiunti a Sara.
-- ============================================================================

-- 1) Trigger automatico: referral → collaboration
create or replace function referral_to_collaboration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo per fornitori: WP→WP non genera collaboration (sono peer)
  if NEW.referee_role = 'FORNITORE' then
    insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
    values (NEW.referrer_id, NEW.referee_id, 'ACTIVE', now())
    on conflict (capostipite_id, fornitore_id) do update
      set status = 'ACTIVE',
          accepted_at = coalesce(collaborations.accepted_at, now());
  end if;
  return NEW;
end$$;

drop trigger if exists trg_referral_creates_collab on referrals;
create trigger trg_referral_creates_collab
  after insert on referrals
  for each row execute function referral_to_collaboration();

-- 2) Backfill: tutti i referrals fornitore esistenti → collaborations
insert into collaborations (capostipite_id, fornitore_id, status, accepted_at)
select r.referrer_id, r.referee_id, 'ACTIVE', r.created_at
  from referrals r
 where r.referee_role = 'FORNITORE'
   and r.status = 'ACTIVE'
   and not exists (
     select 1 from collaborations c
      where c.capostipite_id = r.referrer_id
        and c.fornitore_id   = r.referee_id
   )
on conflict (capostipite_id, fornitore_id) do nothing;

-- Report
do $$
declare
  v_sara uuid;
  v_collabs int;
  v_referrals int;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';
  select count(*) into v_collabs from collaborations
   where capostipite_id = v_sara and status = 'ACTIVE';
  select count(*) into v_referrals from referrals
   where referrer_id = v_sara and referee_role = 'FORNITORE' and status = 'ACTIVE';

  raise notice '════ POST-BACKFILL SARA DE LUCA ════';
  raise notice '  Fornitori in pancia (collaborations ACTIVE): %', v_collabs;
  raise notice '  Referrals FORNITORE attivi: %', v_referrals;
  raise notice '════════════════════════════════════';
end $$;
