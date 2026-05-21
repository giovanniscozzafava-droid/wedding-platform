-- ============================================================================
-- Wedding Platform — Row Level Security
-- Ogni policy commentata in italiano (riferimento PRP-1/2/3 v2).
-- ============================================================================

-- 0. Helper functions ---------------------------------------------------------
-- Restituisce true se l'utente loggato e' ADMIN. SECURITY DEFINER per evitare
-- ricorsione RLS sulla tabella profiles.
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- True se esiste collaborazione ACTIVE fra capostipite (caller) e fornitore X.
create or replace function has_active_collab_with_supplier(p_supplier uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.collaborations
    where capostipite_id = auth.uid()
      and fornitore_id   = p_supplier
      and status = 'ACTIVE'
  );
$$;

-- True se il caller e' participant del calendar entry indicato.
create or replace function is_entry_participant(p_entry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.calendar_entry_participants
    where entry_id = p_entry and user_id = auth.uid()
  );
$$;

-- True se il caller e' owner del quote.
create or replace function is_quote_owner(p_quote uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.quotes
    where id = p_quote and owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- 1. profiles
-- ============================================================================
alter table profiles enable row level security;

-- SELECT: si vede sempre il proprio profilo.
create policy "profiles_select_self"
  on profiles for select
  using (id = auth.uid());

-- SELECT: si vedono profili PUBLIC.
create policy "profiles_select_public"
  on profiles for select
  using (profile_visibility = 'PUBLIC');

-- SELECT: capostipite vede profili dei propri fornitori collaboratori attivi.
create policy "profiles_select_collab_supplier"
  on profiles for select
  using (
    role = 'FORNITORE' and has_active_collab_with_supplier(id)
  );

-- SELECT: fornitore vede profili dei capostipiti che lo hanno aggiunto (ACTIVE).
create policy "profiles_select_collab_capo"
  on profiles for select
  using (
    exists (
      select 1 from collaborations
      where fornitore_id = auth.uid()
        and capostipite_id = profiles.id
        and status = 'ACTIVE'
    )
  );

-- SELECT: admin tutto.
create policy "profiles_select_admin"
  on profiles for select using (is_admin());

-- UPDATE: solo se stesso.
create policy "profiles_update_self"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- UPDATE: admin tutto.
create policy "profiles_update_admin"
  on profiles for update using (is_admin()) with check (true);

-- INSERT: solo se inserisce il proprio id (in pratica gestito dal trigger
-- handle_new_auth_user, ma teniamo la policy esplicita).
create policy "profiles_insert_self"
  on profiles for insert with check (id = auth.uid());

-- ============================================================================
-- 2. collaborations
-- ============================================================================
alter table collaborations enable row level security;

-- SELECT: capostipite vede le sue.
create policy "collab_select_capo"
  on collaborations for select
  using (capostipite_id = auth.uid());

-- SELECT: fornitore vede le sue (per accettare/rifiutare).
create policy "collab_select_forn"
  on collaborations for select
  using (fornitore_id = auth.uid());

-- SELECT: admin tutto.
create policy "collab_select_admin"
  on collaborations for select using (is_admin());

-- INSERT: solo wedding planner / location possono creare invito; capostipite_id = caller.
create policy "collab_insert_capo"
  on collaborations for insert
  with check (
    capostipite_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('WEDDING_PLANNER','LOCATION','ADMIN')
    )
  );

-- UPDATE: capostipite puo` revocare; fornitore puo` accettare (cambiare status).
create policy "collab_update_capo"
  on collaborations for update
  using (capostipite_id = auth.uid())
  with check (capostipite_id = auth.uid());

create policy "collab_update_forn"
  on collaborations for update
  using (fornitore_id = auth.uid())
  with check (fornitore_id = auth.uid());

-- DELETE: solo capostipite (revoca duro).
create policy "collab_delete_capo"
  on collaborations for delete using (capostipite_id = auth.uid());

-- ============================================================================
-- 3. service_categories
-- ============================================================================
alter table service_categories enable row level security;

-- SELECT: categorie standard libere a tutti loggati.
create policy "cat_select_standard"
  on service_categories for select using (is_standard);

-- SELECT: categorie create da me.
create policy "cat_select_own"
  on service_categories for select using (created_by = auth.uid());

-- SELECT: admin tutto.
create policy "cat_select_admin"
  on service_categories for select using (is_admin());

-- INSERT: utente loggato, created_by = caller, non standard.
create policy "cat_insert_user"
  on service_categories for insert
  with check (
    created_by = auth.uid()
    and is_standard = false
  );

-- UPDATE/DELETE: solo creator.
create policy "cat_update_own"
  on service_categories for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "cat_delete_own"
  on service_categories for delete using (created_by = auth.uid());

-- Admin gestisce tutto (incluse standard).
create policy "cat_all_admin"
  on service_categories for all
  using (is_admin()) with check (is_admin());

-- ============================================================================
-- 4. services
-- ============================================================================
alter table services enable row level security;

-- SELECT: fornitore vede i propri.
create policy "services_select_owner"
  on services for select using (fornitore_id = auth.uid());

-- SELECT: capostipite vede servizi di fornitori collaboratori attivi.
create policy "services_select_collab"
  on services for select
  using (has_active_collab_with_supplier(fornitore_id));

-- SELECT: admin tutto.
create policy "services_select_admin"
  on services for select using (is_admin());

-- INSERT/UPDATE/DELETE: solo proprietario (fornitore_id = caller).
create policy "services_modify_owner"
  on services for all
  using (fornitore_id = auth.uid())
  with check (fornitore_id = auth.uid());

-- ============================================================================
-- 5. price_versions (gestiti SOLO da trigger; client legge)
-- ============================================================================
alter table price_versions enable row level security;

-- SELECT: visibile a chi vede il servizio.
create policy "price_select_via_service"
  on price_versions for select
  using (
    exists (
      select 1 from services s
      where s.id = price_versions.service_id
        and (
             s.fornitore_id = auth.uid()
          or has_active_collab_with_supplier(s.fornitore_id)
          or is_admin()
        )
    )
  );

-- ============================================================================
-- 6. service_photos
-- ============================================================================
alter table service_photos enable row level security;

create policy "photos_select_via_service"
  on service_photos for select
  using (
    exists (
      select 1 from services s
      where s.id = service_photos.service_id
        and (
             s.fornitore_id = auth.uid()
          or has_active_collab_with_supplier(s.fornitore_id)
          or is_admin()
        )
    )
  );

create policy "photos_modify_owner_service"
  on service_photos for all
  using (
    exists (
      select 1 from services s
      where s.id = service_photos.service_id
        and s.fornitore_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from services s
      where s.id = service_photos.service_id
        and s.fornitore_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. service_modifiers
-- ============================================================================
alter table service_modifiers enable row level security;

create policy "mods_select_via_service"
  on service_modifiers for select
  using (
    exists (
      select 1 from services s
      where s.id = service_modifiers.service_id
        and (
             s.fornitore_id = auth.uid()
          or has_active_collab_with_supplier(s.fornitore_id)
          or is_admin()
        )
    )
  );

create policy "mods_modify_owner_service"
  on service_modifiers for all
  using (
    exists (
      select 1 from services s
      where s.id = service_modifiers.service_id
        and s.fornitore_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from services s
      where s.id = service_modifiers.service_id
        and s.fornitore_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. calendar_entries
-- ============================================================================
alter table calendar_entries enable row level security;

-- SELECT: owner tutto (campi sensibili inclusi).
create policy "calentry_select_owner"
  on calendar_entries for select using (owner_id = auth.uid());

-- SELECT: participant via tabella participants.
-- Nota: il participant frontend dovrebbe usare la view ridotta, ma le policy
-- consentono l'accesso anche alla tabella diretta (visualizzazione minimale).
create policy "calentry_select_participant"
  on calendar_entries for select using (is_entry_participant(id));

-- SELECT: admin tutto.
create policy "calentry_select_admin"
  on calendar_entries for select using (is_admin());

-- INSERT: solo WP/LOCATION/ADMIN come owner = caller.
create policy "calentry_insert_capostipite"
  on calendar_entries for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('WEDDING_PLANNER','LOCATION','ADMIN')
    )
  );

-- UPDATE/DELETE: only owner.
create policy "calentry_update_owner"
  on calendar_entries for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "calentry_delete_owner"
  on calendar_entries for delete using (owner_id = auth.uid());

-- ============================================================================
-- 9. calendar_entry_participants
-- ============================================================================
alter table calendar_entry_participants enable row level security;

-- SELECT: owner del entry; participant stesso.
create policy "partic_select_owner_or_self"
  on calendar_entry_participants for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- CRUD: solo owner del entry.
create policy "partic_modify_owner"
  on calendar_entry_participants for all
  using (
    exists (
      select 1 from calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 10. quotes
-- ============================================================================
alter table quotes enable row level security;

-- SELECT/UPDATE/DELETE: solo owner. Accesso pubblico via access_token gestito
-- nelle Edge Functions con service_role (bypass RLS).
create policy "quotes_select_owner"
  on quotes for select using (owner_id = auth.uid());

create policy "quotes_select_admin"
  on quotes for select using (is_admin());

create policy "quotes_insert_owner"
  on quotes for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('WEDDING_PLANNER','LOCATION','ADMIN')
    )
  );

create policy "quotes_update_owner"
  on quotes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "quotes_delete_owner"
  on quotes for delete using (owner_id = auth.uid());

-- Admin: bypass per tutte le operazioni.
create policy "quotes_all_admin"
  on quotes for all using (is_admin()) with check (is_admin());

create policy "calendar_entries_all_admin"
  on calendar_entries for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- 11. quote_items
-- ============================================================================
alter table quote_items enable row level security;

create policy "qitems_select_via_quote"
  on quote_items for select using (is_quote_owner(quote_id) or is_admin());

create policy "qitems_modify_owner"
  on quote_items for all
  using (is_quote_owner(quote_id))
  with check (is_quote_owner(quote_id));

-- ============================================================================
-- 12. quote_supplier_markups
-- ============================================================================
alter table quote_supplier_markups enable row level security;

create policy "qsm_select_via_quote"
  on quote_supplier_markups for select using (is_quote_owner(quote_id) or is_admin());

create policy "qsm_modify_owner"
  on quote_supplier_markups for all
  using (is_quote_owner(quote_id))
  with check (is_quote_owner(quote_id));

-- ============================================================================
-- 13. notification_queue
-- ============================================================================
alter table notification_queue enable row level security;

-- SELECT: solo destinatario.
create policy "notif_select_self"
  on notification_queue for select using (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: nessuno via client (gestito da Edge Functions con
-- service_role).

-- ============================================================================
-- 14. calendar_export_tokens
-- ============================================================================
alter table calendar_export_tokens enable row level security;

create policy "exptok_select_self"
  on calendar_export_tokens for select using (user_id = auth.uid());

create policy "exptok_modify_self"
  on calendar_export_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
