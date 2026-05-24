-- Fix: la policy storage "service-photos write owner" falliva su upload anche
-- quando l'utente era il vero proprietario del service. Il join cross-schema
-- (storage.objects -> public.services) non sempre propaga il contesto auth
-- corretto, e la RLS di services applicata dentro EXISTS poteva far ritornare
-- 0 rows risultando in policy denial.
--
-- Soluzione: helper function security definer che bypassa RLS services e
-- verifica ownership direttamente.

create or replace function is_service_owner(p_service_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from services
    where id::text = p_service_id
      and fornitore_id = auth.uid()
  );
$$;

grant execute on function is_service_owner(text) to authenticated;

-- Sostituisci le 3 policy storage con versioni che usano la helper

drop policy if exists "service-photos write owner" on storage.objects;
create policy "service-photos write owner"
  on storage.objects for insert
  with check (
    bucket_id = 'service-photos'
    and auth.uid() is not null
    and is_service_owner(split_part(name, '/', 1))
  );

drop policy if exists "service-photos delete owner" on storage.objects;
create policy "service-photos delete owner"
  on storage.objects for delete
  using (
    bucket_id = 'service-photos'
    and is_service_owner(split_part(name, '/', 1))
  );

drop policy if exists "service-photos update owner" on storage.objects;
create policy "service-photos update owner"
  on storage.objects for update
  using (
    bucket_id = 'service-photos'
    and is_service_owner(split_part(name, '/', 1))
  );
