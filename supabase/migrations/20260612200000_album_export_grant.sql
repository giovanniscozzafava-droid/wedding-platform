-- Export tavole in ALTA RISOLUZIONE: nell'app si lavora in bassa qualità (thumbnail),
-- ma in fase di export un proxy edge scarica l'ORIGINALE da Google Drive. Per autorizzare
-- il proxy (che riceve richieste <img>, senza header Authorization) usiamo un "grant"
-- a tempo: chi può modificare l'album ottiene un token valido pochi minuti.
create table if not exists public.album_export_grants (
  token       text primary key,
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '20 minutes'
);
create index if not exists idx_aeg_entry on public.album_export_grants(entry_id);
alter table public.album_export_grants enable row level security;
-- nessuna policy: accesso solo via RPC SECURITY DEFINER e via service-role nell'edge.

-- Rilascia un grant per l'evento (solo a chi può lavorare all'album).
create or replace function public.album_export_grant(p_entry uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_tok text;
begin
  if not public.album_can_edit(p_entry) then return null; end if;
  delete from public.album_export_grants where expires_at < now();   -- pulizia
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.album_export_grants(token, entry_id, user_id) values (v_tok, p_entry, auth.uid());
  return v_tok;
end$$;
grant execute on function public.album_export_grant(uuid) to authenticated;
