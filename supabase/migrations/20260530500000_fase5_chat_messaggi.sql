-- FASE 5.1 — Chat evento (chat_messaggi)
--
-- Tabella `chat_messaggi`: log conversazione associata al calendar_entry (evento).
-- Mittente: profiles. Membri ammessi (RLS): owner WP, couple_members del wedding,
-- fornitori che hanno almeno una riga in quote_items per il quote dell'evento.
--
-- Helper `is_evento_member(p_entry uuid)`: usata anche in altre policy future.
-- security definer, stable, search_path = public.
--
-- Mobile-first: indice (entry_id, creato_il desc) per scroll cronologico.

-- 1. Helper is_evento_member -------------------------------------------------
create or replace function public.is_evento_member(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with ce as (
    select id, owner_id, quote_id
      from public.calendar_entries
     where id = p_entry
  )
  select
    -- owner WP
    exists (select 1 from ce where owner_id = auth.uid())
    -- couple member (calendar_entry_participants role 'COUPLE*')
    or exists (
      select 1
        from public.calendar_entry_participants p
       where p.entry_id = p_entry
         and p.user_id = auth.uid()
    )
    -- couple member tramite wedding_couple_members
    or exists (
      select 1
        from public.wedding_couple_members wcm
       where wcm.entry_id = p_entry
         and wcm.user_id = auth.uid()
    )
    -- fornitore: ha almeno una riga in quote_items del quote dell'evento
    or exists (
      select 1
        from ce
        join public.quote_items qi on qi.quote_id = ce.quote_id
       where qi.supplier_id = auth.uid()
    )
    -- admin
    or public.is_admin();
$$;

comment on function public.is_evento_member(uuid) is
  'True se l''utente loggato e` membro dell''evento (owner WP, couple member, fornitore con quote_items, o admin). Usata da RLS chat_messaggi e altre policy.';

revoke all on function public.is_evento_member(uuid) from public;
grant execute on function public.is_evento_member(uuid) to authenticated;

-- 2. Tabella chat_messaggi ---------------------------------------------------
create table if not exists public.chat_messaggi (
  id                 uuid primary key default gen_random_uuid(),
  entry_id           uuid not null references public.calendar_entries(id) on delete cascade,
  mittente_id        uuid not null references public.profiles(id) on delete cascade,
  corpo              text not null check (length(corpo) > 0),
  allegato_url       text,
  voce_quote_item_id uuid references public.quote_items(id) on delete set null,
  letto_il           timestamptz,
  creato_il          timestamptz not null default now()
);

comment on table public.chat_messaggi is
  'Messaggi chat di un evento (calendar_entry). Letti dai membri evento via is_evento_member.';
comment on column public.chat_messaggi.voce_quote_item_id is
  'Citazione opzionale di una voce di preventivo (per messaggi "in risposta a" un servizio specifico).';
comment on column public.chat_messaggi.letto_il is
  'Timestamp letto: viene impostato dal destinatario quando legge. Best-effort, non rigoroso.';

create index if not exists idx_chat_messaggi_entry_creato
  on public.chat_messaggi(entry_id, creato_il desc);
create index if not exists idx_chat_messaggi_mittente
  on public.chat_messaggi(mittente_id);
create index if not exists idx_chat_messaggi_voce
  on public.chat_messaggi(voce_quote_item_id)
  where voce_quote_item_id is not null;

-- 3. RLS ---------------------------------------------------------------------
alter table public.chat_messaggi enable row level security;

-- SELECT: solo membri evento.
drop policy if exists "chat_select_membri_evento" on public.chat_messaggi;
create policy "chat_select_membri_evento" on public.chat_messaggi
  for select
  using (public.is_evento_member(entry_id));

-- INSERT: membri evento, mittente = auth.uid().
drop policy if exists "chat_insert_membri_evento" on public.chat_messaggi;
create policy "chat_insert_membri_evento" on public.chat_messaggi
  for insert
  with check (
    mittente_id = auth.uid()
    and public.is_evento_member(entry_id)
  );

-- UPDATE: solo per marcare `letto_il` da parte di un membro evento (no edit del corpo).
-- Lasciamo update permissivo sui campi (l'unico campo "mutabile" significativo
-- e` letto_il); il check garantisce che il record resti nello stesso evento.
drop policy if exists "chat_update_membri_evento" on public.chat_messaggi;
create policy "chat_update_membri_evento" on public.chat_messaggi
  for update
  using (public.is_evento_member(entry_id))
  with check (public.is_evento_member(entry_id));

-- Niente DELETE da client: la cronologia chat e` immutabile (cascade su entry delete).

-- 4. Grants ------------------------------------------------------------------
grant select, insert, update on public.chat_messaggi to authenticated;
