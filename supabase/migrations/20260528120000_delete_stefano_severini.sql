-- ============================================================================
-- One-off cleanup: rimuove account Stefano Severini per re-iscrizione beta.
-- ----------------------------------------------------------------------------
-- Tentativo su entrambe le possibili email (richiesta utente + seed iniziale).
-- ON DELETE CASCADE su profiles.id → auth.users.id porta via:
--   - profiles
--   - services, service_modifiers, service_photos
--   - collaborations (capostipite_id/fornitore_id)
--   - supplier_invites (accepted_at)
--   - posts/likes/comments/follows
--   - quote_items.supplier_id (set null grazie a on delete set null)
-- Idempotente: se l'email non esiste, no-op.
-- ============================================================================

do $$
declare
  v_uid uuid;
  v_email text;
begin
  for v_email in
    select unnest(array['stefanofilms700@gmail.com', 'stefanoseverini700@gmail.com'])
  loop
    select id into v_uid from auth.users where lower(email) = lower(v_email) limit 1;
    if v_uid is not null then
      raise notice 'Eliminazione utente % (id %).', v_email, v_uid;
      -- Cleanup esplicito su supplier_invites che usano la stessa email come
      -- "destinatario" (non è FK, è un campo text dell'invito pending).
      delete from supplier_invites where lower(email) = lower(v_email);
      -- Delete cascade automatico per il resto.
      delete from auth.users where id = v_uid;
    else
      raise notice 'Email % non trovata, skip.', v_email;
    end if;
  end loop;
end$$;
