-- Condivisione documenti evento con la coppia. Di default i documenti restano PRIVATI del WP
-- (FATTURA/PERMESSO ecc.): il WP sceglie quali condividere (shared_with_couple). La coppia vede e
-- scarica SOLO quelli condivisi.
alter table public.event_documents
  add column if not exists shared_with_couple boolean not null default false;

-- La coppia legge i metadati dei soli documenti condivisi del suo evento.
drop policy if exists docs_select_couple_shared on public.event_documents;
create policy docs_select_couple_shared on public.event_documents for select using (
  shared_with_couple and public.is_wedding_couple(entry_id)
);

-- Storage: la coppia può leggere il file solo se il documento è condiviso (join su storage_path).
drop policy if exists "event-docs read couple shared" on storage.objects;
create policy "event-docs read couple shared" on storage.objects for select using (
  bucket_id = 'event-documents' and exists (
    select 1 from public.event_documents ed
    where ed.storage_path = name and ed.shared_with_couple
      and public.is_wedding_couple(ed.entry_id)
  )
);
