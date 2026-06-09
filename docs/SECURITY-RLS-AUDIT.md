# Mappa di copertura RLS / PII — Wedding Platform

> **Fonte:** parsing statico delle migrazioni in `supabase/migrations/` (stato "ultima definizione vince").
> Docker non disponibile durante l'audit → **niente introspezione live** (`pg_policies`). I verdetti marcati `DA-VERIFICARE` vanno confermati con `pg_policies` quando il DB locale è avviabile.

**Tabelle totali:** 119 · **BUCO:** 0 · generato dall'audit notturno.

## Verdetti `BUCO` (priorità — NON corretti, solo segnalati)

- _Nessun BUCO rilevato dal parsing statico._

## Mappa completa

| Tabella | RLS | #Policy | PII | Grants anon/auth | Verdetto | Note |
|---|:--:|:--:|---|---|:--:|---|
| `access_audit_log` | sì | 0 | actor_email, ip_address | — | 🟡DA-VERIFICARE | RLS on ma nessuna policy trovata (verifica) |
| `admin_audit` | sì | 0 | actor_email | — | 🟡DA-VERIFICARE | RLS on ma nessuna policy trovata (verifica) |
| `app_settings` | sì | 0 | — | — | 🟢OK |  |
| `audit_log` | sì | 1 | — | — | 🟢OK |  |
| `beta_status` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `blog_categories` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `blog_posts` | sì | 2 | — | — | 🟢OK |  |
| `budget_categories` | sì | 3 | — | — | 🟢OK |  |
| `budget_entries` | sì | 3 | — | — | 🟢OK |  |
| `bug_reports` | sì | 2 | — | — | 🟢OK |  |
| `calendar_entries` | sì | 5 | — | — | 🟢OK | PII spostata in `calendar_entries_private` (split P5, mig. 20260610010000) |
| `calendar_entries_private` | sì | 6 | client_email, client_name, value_amount, notes | — | 🟢OK | RLS owner/couple/admin; fornitore NON legge (P5 verde) |
| `calendar_entry_participants` | sì | 3 | — | — | 🟢OK |  |
| `calendar_export_tokens` | sì | 2 | — | — | 🟢OK |  |
| `chat_messaggi` | sì | 3 | — | authenticated:SELECT, INSERT, UPDATE | 🟢OK |  |
| `checklist_template` | sì | 2 | — | — | 🟢OK |  |
| `clausola_template` | sì | 2 | — | — | 🟢OK |  |
| `client_errors` | sì | 0 | — | — | 🟢OK |  |
| `collaboration_ratings` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `collaborations` | sì | 7 | — | — | 🟢OK |  |
| `consenso_segnalazione` | sì | 4 | — | — | 🟢OK |  |
| `consiglio` | sì | 2 | — | — | 🟢OK |  |
| `contract_addendums` | sì | 2 | document_hash | — | 🟢OK | PII protetta da RLS+policy |
| `contracts` | sì | 7 | client_email, client_fiscal_code, client_name, client_vat_number, signature_data | — | 🟢OK | PII protetta da RLS+policy |
| `contracts_legacy_audit` | sì | 0 | original_signature_data, patched_signature_data | — | 🟡DA-VERIFICARE | RLS on ma nessuna policy trovata (verifica) |
| `couple_change_requests` | sì | 4 | — | — | 🟢OK |  |
| `couple_preferences` | sì | 2 | — | — | 🟢OK |  |
| `event_accommodations` | sì | 4 | address, contact_email, contact_phone | — | 🟢OK | PII protetta da RLS+policy |
| `event_documents` | sì | 2 | — | — | 🟢OK |  |
| `event_gadgets` | sì | 4 | — | — | 🟢OK |  |
| `event_guest_accommodation` | sì | 2 | — | — | 🟢OK |  |
| `event_guest_transport` | sì | 2 | — | — | 🟢OK |  |
| `event_guests` | sì | 10 | email, full_name, phone | — | 🟢OK | PII protetta da RLS+policy |
| `event_menu` | sì | 4 | — | — | 🟢OK |  |
| `event_playlist` | sì | 6 | — | — | 🟢OK |  |
| `event_subevents` | sì | 4 | contact_phone | — | 🟢OK | PII protetta da RLS+policy |
| `event_tables` | sì | 10 | — | — | 🟢OK |  |
| `event_timeline` | sì | 4 | — | — | 🟢OK |  |
| `event_transport` | sì | 4 | contact_email, contact_phone | — | 🟢OK | PII protetta da RLS+policy |
| `event_transport_assignments` | sì | 2 | — | — | 🟢OK |  |
| `eventi_cambiamento` | sì | 1 | — | authenticated:SELECT | 🟢OK |  |
| `feature_flag_overrides` | sì | 2 | — | — | 🟢OK |  |
| `feature_flags` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `finance_applications` | sì | 2 | — | — | 🟢OK |  |
| `finance_offers` | sì | 3 | — | — | 🟢OK |  |
| `follows` | sì | 4 | — | — | 🟢OK |  |
| `inbound_emails` | sì | 0 | — | — | 🟢OK |  |
| `instagram_connections` | sì | 1 | — | — | 🟢OK |  |
| `instagram_oauth_states` | sì | 0 | — | — | 🟢OK |  |
| `insurance_offers` | sì | 3 | — | — | 🟢OK |  |
| `insurance_policies` | sì | 2 | — | — | 🟢OK |  |
| `lead_requests` | sì | 2 | client_email, client_phone | — | 🟢OK | PII protetta da RLS+policy |
| `lead_submit_attempts` | sì | 0 | ip_address | — | 🟡DA-VERIFICARE | RLS on ma nessuna policy trovata (verifica) |
| `market_prices` | sì | 1 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `menu_presets` | sì | 2 | — | — | 🟢OK |  |
| `mood_images` | sì | 6 | — | — | 🟢OK |  |
| `mood_inspirations` | sì | 4 | — | — | 🟢OK |  |
| `network_prospect_logs` | sì | 1 | prospect_id | — | 🟢OK | PII protetta da RLS+policy |
| `network_prospects` | sì | 1 | business_name, email | — | 🟢OK | PII protetta da RLS+policy |
| `notification_queue` | sì | 1 | — | — | 🟢OK |  |
| `notifiche` | sì | 2 | — | — | 🟢OK |  |
| `objects` | **NO** | 25 | — | — | 🟢OK |  |
| `platform_config` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `platform_finance_entries` | sì | 1 | — | — | 🟢OK |  |
| `post_comments` | sì | 3 | — | — | 🟢OK |  |
| `post_likes` | sì | 3 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `posts` | sì | 2 | — | — | 🟢OK |  |
| `price_versions` | sì | 1 | — | — | 🟢OK |  |
| `product_interest_requests` | sì | 1 | — | — | 🟢OK |  |
| `professioni` | sì | 2 | — | — | 🟢OK |  |
| `profiles` | sì | 8 | business_name, full_name, phone, vat_number | — | 🟢OK | PII protetta da RLS+policy |
| `quote_acceptances` | sì | 2 | client_fiscal_code, doc_number, signature_url, signer_email, signer_phone | — | 🟢OK | PII protetta da RLS+policy |
| `quote_acceptances_audit` | sì | 0 | — | — | 🟢OK |  |
| `quote_items` | sì | 4 | — | — | 🟢OK |  |
| `quote_questionnaire_answers` | sì | 2 | — | — | 🟢OK |  |
| `quote_revisions` | sì | 2 | — | — | 🟢OK |  |
| `quote_supplier_markups` | sì | 2 | — | — | 🟢OK |  |
| `quote_view_consents` | sì | 1 | client_email, client_name, ip_address | — | 🟢OK | PII protetta da RLS+policy |
| `quote_views` | sì | 2 | — | — | 🟢OK |  |
| `quotes` | sì | 7 | client_email, client_name, sent_email_log | — | 🟢OK | PII protetta da RLS+policy |
| `recruiting_rewards` | sì | 2 | — | — | 🟢OK |  |
| `referral_credits` | sì | 2 | — | — | 🟢OK |  |
| `referral_redeem_attempts` | sì | 1 | — | — | 🟢OK |  |
| `referrals` | sì | 2 | — | — | 🟢OK |  |
| `scadenzario_voci` | sì | 4 | — | — | 🟢OK |  |
| `service_categories` | sì | 7 | — | — | 🟢OK |  |
| `service_components` | sì | 2 | — | — | 🟢OK |  |
| `service_modifiers` | sì | 2 | — | — | 🟢OK |  |
| `service_photos` | sì | 2 | — | — | 🟢OK |  |
| `service_presets` | sì | 2 | — | — | 🟢OK |  |
| `services` | sì | 4 | — | — | 🟢OK |  |
| `servizio_template` | sì | 2 | — | — | 🟢OK |  |
| `signature_audit_trail` | sì | 0 | doc_number_masked, document_hash, document_id, document_type, ip_address, signer_email, signer_name | — | 🟡DA-VERIFICARE | RLS on ma nessuna policy trovata (verifica) |
| `standard_contract_clauses` | sì | 2 | — | — | 🟢OK |  |
| `suggested_contract_templates` | sì | 2 | — | — | 🟡DA-VERIFICARE | policy USING(true) (no PII rilevata) |
| `supplier_appointments` | sì | 2 | — | — | 🟢OK |  |
| `supplier_availability` | sì | 2 | — | — | 🟢OK |  |
| `supplier_capostipite_pricing` | sì | 3 | — | — | 🟢OK |  |
| `supplier_client_briefs` | sì | 2 | — | — | 🟢OK |  |
| `supplier_clients` | sì | 5 | email, fiscal_code, full_name, phone, vat_number | — | 🟢OK | PII protetta da RLS+policy |
| `supplier_contract_templates` | sì | 2 | — | — | 🟢OK |  |
| `supplier_cost_ingredients` | sì | 1 | — | — | 🟢OK |  |
| `supplier_credits` | sì | 1 | — | — | 🟢OK |  |
| `supplier_date_options` | sì | 2 | — | — | 🟢OK |  |
| `supplier_event_collaborators` | sì | 3 | — | — | 🟢OK |  |
| `supplier_inventory_items` | sì | 1 | — | — | 🟢OK |  |
| `supplier_invites` | sì | 4 | email | — | 🟢OK | PII protetta da RLS+policy |
| `supplier_leads` | sì | 2 | — | — | 🟢OK |  |
| `supplier_referrals` | sì | 1 | client_name | — | 🟢OK | PII protetta da RLS+policy |
| `supplier_subscriptions` | sì | 2 | — | — | 🟢OK |  |
| `supplier_team_assignments` | sì | 1 | — | — | 🟢OK |  |
| `supplier_team_event_items` | sì | 2 | — | — | 🟢OK |  |
| `supplier_team_event_packing` | sì | 1 | — | — | 🟢OK |  |
| `supplier_team_events` | sì | 2 | — | — | 🟢OK |  |
| `supplier_team_members` | sì | 1 | email, full_name | — | 🟢OK | PII protetta da RLS+policy |
| `support_ticket_messages` | sì | 2 | — | — | 🟢OK |  |
| `support_tickets` | sì | 3 | — | — | 🟢OK |  |
| `user_notifications` | sì | 2 | — | — | 🟢OK |  |
| `wedding_couple_members` | sì | 3 | email, full_name | — | 🟢OK | PII protetta da RLS+policy |
| `wedding_tasks` | sì | 6 | — | — | 🟢OK |  |

## Dettaglio policy per tabella

### `audit_log`
- **audit_log_select_admin** · SELECT · ruolo `(default)` · USING `public.is_admin()`

### `beta_status`
- **beta_status_read_all** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `is_admin()`
- **beta_status_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `blog_categories`
- **blog_categories_read_all** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `is_admin()`
- **blog_categories_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `blog_posts`
- **blog_posts_read_public** · SELECT · ruolo `(default)` · USING `status = 'published' or author_id = auth.uid() or is_admin()` · WITH CHECK `(author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','admin') )) or is_admin()`
- **blog_posts_write_authors** · ALL · ruolo `(default)` · USING `(author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','fornitore','admin') )) or is_admin()` · WITH CHECK `(author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','fornitore','admin') )) or is_`

### `budget_categories`
- **budgetc_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **budgetc_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **budgetc_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`

### `budget_entries`
- **budgete_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **budgete_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **budgete_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`

### `bug_reports`
- **bug_reports_insert_any** · INSERT · ruolo `(default)` · USING `user_id = auth.uid() or is_support_staff()` · WITH CHECK `user_id is null or user_id = auth.uid()`
- **bug_reports_select_own_or_staff** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or is_support_staff()`

### `calendar_entries`
- **calentry_select_owner** · SELECT · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **calentry_select_participant** · SELECT · ruolo `(default)` · USING `is_entry_participant(id)` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **calentry_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **calentry_insert_capostipite** · INSERT · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **calentry_update_owner** · UPDATE · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **calentry_delete_owner** · DELETE · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `exists ( select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **calendar_entries_all_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **calentry_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(id)`
- **ce_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(id)`

### `calendar_entry_participants`
- **partic_select_owner_or_self** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or exists ( select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `exists ( select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **partic_modify_owner** · ALL · ruolo `(default)` · USING `exists ( select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `exists ( select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **partic_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`

### `calendar_export_tokens`
- **exptok_select_self** · SELECT · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `user_id = auth.uid()`
- **exptok_modify_self** · ALL · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `user_id = auth.uid()`

### `chat_messaggi`
- **chat_select_membri_evento** · SELECT · ruolo `(default)` · USING `public.is_evento_member(entry_id)` · WITH CHECK `mittente_id = auth.uid() and public.is_evento_member(entry_id)`
- **chat_insert_membri_evento** · INSERT · ruolo `(default)` · USING `public.is_evento_member(entry_id)` · WITH CHECK `mittente_id = auth.uid() and public.is_evento_member(entry_id)`
- **chat_update_membri_evento** · UPDATE · ruolo `(default)` · USING `public.is_evento_member(entry_id)` · WITH CHECK `public.is_evento_member(entry_id)`

### `checklist_template`
- **checklist_template_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **checklist_template_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `clausola_template`
- **clausola_template_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **clausola_template_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `collaboration_ratings`
- **rate_select_all** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `rater_id = auth.uid()`
- **rate_modify_own** · ALL · ruolo `(default)` · USING `rater_id = auth.uid()` · WITH CHECK `rater_id = auth.uid()`

### `collaborations`
- **collab_select_capo** · SELECT · ruolo `(default)` · USING `capostipite_id = auth.uid()` · WITH CHECK `capostipite_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **collab_select_forn** · SELECT · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `capostipite_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **collab_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `capostipite_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **collab_insert_capo** · INSERT · ruolo `(default)` · USING `capostipite_id = auth.uid()` · WITH CHECK `capostipite_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **collab_update_capo** · UPDATE · ruolo `(default)` · USING `capostipite_id = auth.uid()` · WITH CHECK `capostipite_id = auth.uid()`
- **collab_update_forn** · UPDATE · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`
- **collab_delete_capo** · DELETE · ruolo `(default)` · USING `capostipite_id = auth.uid()` · WITH CHECK `created_by = auth.uid() and is_standard = false`

### `consenso_segnalazione`
- **consenso_select** · SELECT · ruolo `(default)` · USING `is_admin() or couple_user_id = auth.uid() or supplier_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or couple_user_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **consenso_insert** · INSERT · ruolo `(default)` · USING `is_admin() or couple_user_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or couple_user_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **consenso_update** · UPDATE · ruolo `(default)` · USING `is_admin() or couple_user_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or couple_user_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **consenso_delete** · DELETE · ruolo `(default)` · USING `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`

### `consiglio`
- **consiglio_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **consiglio_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `contract_addendums`
- **addendums_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from public.contracts c where c.id = contract_id and c.owner_id = auth.uid())`
- **addendums_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `contracts`
- **contracts_select_owner** · SELECT · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `is_admin()`
- **contracts_all_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **contracts_modify_owner** · ALL · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **contracts_select_couple** · SELECT · ruolo `(default)` · USING `exists ( select 1 from quotes q where q.id = contracts.quote_id and exists ( select 1 from calendar_entries ce where ce.quote_id = q.id and is_wedding_couple(ce.id) ) )`
- **contracts_select_supplier** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `owner_id = auth.uid() or supplier_id = auth.uid()`
- **contracts_insert_supplier_own** · INSERT · ruolo `(default)` · USING `owner_id = auth.uid() or supplier_id = auth.uid() or is_admin()` · WITH CHECK `owner_id = auth.uid() or supplier_id = auth.uid()`
- **contracts_update_supplier_or_owner** · UPDATE · ruolo `(default)` · USING `owner_id = auth.uid() or supplier_id = auth.uid() or is_admin()` · WITH CHECK `fornitor`

### `couple_change_requests`
- **ccr_owner_update** · UPDATE · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid()) or is_admin()`
- **ccr_owner_delete** · DELETE · ruolo `(default)` · USING `requested_by = auth.uid() or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid()) or is_admin()`
- **ccr_couple_read** · SELECT · ruolo `(default)` · USING `is_entry_participant(wedding_id) or is_wedding_couple(wedding_id) or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `requested_by = auth.uid() and ( is_entry_participant(wedding_id) or is_wedding_couple(wedding_id) or exists (select 1 from calendar_entries ce where ce.id = wed`
- **ccr_couple_insert** · INSERT · ruolo `(default)` · USING `—` · WITH CHECK `requested_by = auth.uid() and ( is_entry_participant(wedding_id) or is_wedding_couple(wedding_id) or exists (select 1 from calendar_entries ce where ce.id = wed`

### `couple_preferences`
- **cpref_select_owner_or_couple** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))`
- **cpref_modify_owner_or_couple** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))`

### `event_accommodations`
- **acc_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **acc_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **acc_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`
- **acc_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`

### `event_documents`
- **docs_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **docs_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`

### `event_gadgets`
- **gadgets_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **gadgets_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **gadgets_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`
- **gadg_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`

### `event_guest_accommodation`
- **ega_select** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_wedding_couple(entry_id) or is_entry_participant(entry_id) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()`
- **ega_modify** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()`

### `event_guest_transport`
- **egt_select** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_wedding_couple(entry_id) or is_entry_participant(entry_id) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()`
- **egt_modify** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()`

### `event_guests`
- **guests_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **guests_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **guests_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guest_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guest_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guest_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guest_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`
- **guests_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guests_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **guests_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`

### `event_menu`
- **menu_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **menu_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_admin()`
- **menu_select_supplier** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `is_admin()`
- **menu_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `event_playlist`
- **playlist_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **playlist_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **playlist_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **playlist_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)`
- **playlist_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **playlist_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists ( select 1 from calendar_entries ce where ce.id = event_playlist.entry_id and ce.owner_id = auth.uid() ) or is_wedding_couple(entry_id) or is_collab_supplier_of_entry(entry_id) or is_admin()`

### `event_subevents`
- **sub_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **sub_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **sub_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`
- **subev_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`

### `event_tables`
- **tables_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **tables_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **tables_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tab_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tab_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tab_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tab_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`
- **tables_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tables_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tables_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)`

### `event_timeline`
- **timeline_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **timeline_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **timeline_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **timeline_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`

### `event_transport`
- **transport_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **transport_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **transport_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)`
- **transp_select_collab_supplier** · SELECT · ruolo `(default)` · USING `is_collab_supplier_of_entry(entry_id)`

### `event_transport_assignments`
- **ta_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id where t.id = transport_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id where t.id = transport_id and ce.owner_id = auth.uid())`
- **ta_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id where t.id = transport_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id where t.id = transport_id and ce.owner_id = auth.uid())`

### `eventi_cambiamento`
- **eventi_cambiamento_select_membri** · SELECT · ruolo `(default)` · USING `public.is_evento_member(entry_id)`

### `feature_flag_overrides`
- **flag_ovr_self** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or is_admin()` · WITH CHECK `is_admin()`
- **flag_ovr_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `feature_flags`
- **flags_read_all** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `is_admin()`
- **flags_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `finance_applications`
- **finapp_select_own** · SELECT · ruolo `(default)` · USING `applicant_id = auth.uid() or is_admin() or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())` · WITH CHECK `applicant_id = auth.uid() or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())`
- **finapp_modify_own** · ALL · ruolo `authenticated` · USING `applicant_id = auth.uid() or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())` · WITH CHECK `applicant_id = auth.uid() or exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())`

### `finance_offers`
- **fin_modify_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **fin_select_public_active** · SELECT · ruolo `(default)` · USING `is_active = true` · WITH CHECK `is_admin()`
- **fin_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `follows`
- **follows_delete_own** · DELETE · ruolo `(default)` · USING `follower_id = auth.uid()` · WITH CHECK `bucket_id = 'post-media' and auth.uid() is not null`
- **follows_write_own** · INSERT · ruolo `(default)` · USING `followed_id = auth.uid() or is_admin()` · WITH CHECK `follower_id = auth.uid()`
- **follows_update_target** · UPDATE · ruolo `(default)` · USING `followed_id = auth.uid() or is_admin()`
- **follows_read_smart** · SELECT · ruolo `(default)` · USING `status = 'approved' or follower_id = auth.uid() or followed_id = auth.uid() or is_admin()`

### `instagram_connections`
- **ig_conn_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `insurance_offers`
- **ins_modify_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **ins_select_public_active** · SELECT · ruolo `(default)` · USING `is_active = true` · WITH CHECK `is_admin()`
- **ins_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `insurance_policies`
- **ins_pol_select** · SELECT · ruolo `(default)` · USING `is_admin() or exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))` · WITH CHECK `is_admin() or exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **ins_pol_modify** · ALL · ruolo `(default)` · USING `is_admin() or exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `is_admin() or exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`

### `lead_requests`
- **lead_wp_owner_all** · ALL · ruolo `(default)` · USING `wp_id = auth.uid()` · WITH CHECK `wp_id = auth.uid()`
- **lead_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `market_prices`
- **mp_select_all** · SELECT · ruolo `(default)` · USING `true`

### `menu_presets`
- **menu_presets_read_all** · SELECT · ruolo `authenticated` · USING `is_active = true` · WITH CHECK `is_admin()`
- **menu_presets_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `mood_images`
- **mood_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **mood_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **mood_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **mood_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **mood_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **mood_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`

### `mood_inspirations`
- **mood_insp_owner_all** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **mood_insp_couple_select** · SELECT · ruolo `(default)` · USING `exists ( select 1 from wedding_couple_members wcm where wcm.entry_id = mood_inspirations.entry_id and wcm.user_id = auth.uid() )` · WITH CHECK `exists ( select 1 from wedding_couple_members wcm where wcm.entry_id = mood_inspirations.entry_id and wcm.user_id = auth.uid() )`
- **mood_insp_couple_modify** · ALL · ruolo `(default)` · USING `exists ( select 1 from wedding_couple_members wcm where wcm.entry_id = mood_inspirations.entry_id and wcm.user_id = auth.uid() )` · WITH CHECK `exists ( select 1 from wedding_couple_members wcm where wcm.entry_id = mood_inspirations.entry_id and wcm.user_id = auth.uid() )`
- **mood_insp_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `network_prospect_logs`
- **npl_owner_all** · ALL · ruolo `(default)` · USING `owner_id = auth.uid() or is_admin()` · WITH CHECK `owner_id = auth.uid() or is_admin()`

### `network_prospects`
- **np_owner_all** · ALL · ruolo `(default)` · USING `owner_id = auth.uid() or is_admin()` · WITH CHECK `owner_id = auth.uid() or is_admin()`

### `notification_queue`
- **notif_select_self** · SELECT · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `user_id = auth.uid()`

### `notifiche`
- **notifiche_select_owner_or_admin** · SELECT · ruolo `(default)` · USING `destinatario_id = auth.uid() or public.is_admin()` · WITH CHECK `destinatario_id = auth.uid()`
- **notifiche_update_owner** · UPDATE · ruolo `(default)` · USING `destinatario_id = auth.uid()` · WITH CHECK `destinatario_id = auth.uid()`

### `objects`
- **service-photos read public** · SELECT · ruolo `(default)` · USING `bucket_id = 'service-photos'` · WITH CHECK `bucket_id = 'service-photos' and auth.uid() is not null and exists ( select 1 from services s where s.id::text = split_part(name, '/', 1) and s.fornitore_id = a`
- **brand-assets read public** · SELECT · ruolo `(default)` · USING `bucket_id = 'brand-assets'` · WITH CHECK `bucket_id = 'brand-assets' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text`
- **brand-assets write self** · INSERT · ruolo `(default)` · USING `bucket_id = 'brand-assets' and split_part(name, '/', 1) = auth.uid()::text` · WITH CHECK `bucket_id = 'brand-assets' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text`
- **brand-assets delete self** · DELETE · ruolo `(default)` · USING `bucket_id = 'brand-assets' and split_part(name, '/', 1) = auth.uid()::text`
- **event-docs read owner** · SELECT · ruolo `(default)` · USING `bucket_id = 'event-documents' and exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() )` · WITH CHECK `bucket_id = 'event-documents' and exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() )`
- **event-docs write owner** · INSERT · ruolo `(default)` · USING `bucket_id = 'event-documents' and exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() )` · WITH CHECK `bucket_id = 'event-documents' and exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() )`
- **event-docs delete owner** · DELETE · ruolo `(default)` · USING `bucket_id = 'event-documents' and exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() )`
- **service-photos write owner** · INSERT · ruolo `(default)` · USING `bucket_id = 'service-photos' and is_service_owner(split_part(name, '/', 1))` · WITH CHECK `bucket_id = 'service-photos' and auth.uid() is not null and is_service_owner(split_part(name, '/', 1))`
- **service-photos delete owner** · DELETE · ruolo `(default)` · USING `bucket_id = 'service-photos' and is_service_owner(split_part(name, '/', 1))`
- **service-photos update owner** · UPDATE · ruolo `(default)` · USING `bucket_id = 'service-photos' and is_service_owner(split_part(name, '/', 1))`
- **qa_sig_read_owner** · SELECT · ruolo `(default)` · USING `bucket_id = 'quote-signatures' and ( is_admin() or exists ( select 1 from quote_acceptances qa join quotes q on q.id = qa.quote_id where (qa.signature_url like '%' || name || '%' or qa.acceptance_pdf_url like '%' || name || '%') and q.owner`
- **blog_media_read_all** · SELECT · ruolo `(default)` · USING `bucket_id = 'blog-media'`
- **blog_media_update_authors** · UPDATE · ruolo `(default)` · USING `bucket_id = 'blog-media' and owner = auth.uid()`
- **blog_media_delete_authors** · DELETE · ruolo `(default)` · USING `bucket_id = 'blog-media' and (owner = auth.uid() or is_admin())`
- **post_media_read_all** · SELECT · ruolo `(default)` · USING `bucket_id = 'post-media'` · WITH CHECK `bucket_id = 'post-media' and auth.uid() is not null`
- **post_media_upload_authors** · INSERT · ruolo `(default)` · USING `bucket_id = 'post-media' and owner = auth.uid()` · WITH CHECK `bucket_id = 'post-media' and auth.uid() is not null`
- **post_media_modify_owner** · UPDATE · ruolo `(default)` · USING `bucket_id = 'post-media' and owner = auth.uid()`
- **post_media_delete_owner** · DELETE · ruolo `(default)` · USING `bucket_id = 'post-media' and (owner = auth.uid() or is_admin())`
- **brand_assets_upload_own** · INSERT · ruolo `(default)` · USING `bucket_id = 'brand-assets' and name like (auth.uid()::text || '/%')` · WITH CHECK `bucket_id = 'brand-assets' and auth.uid() is not null and name like (auth.uid()::text || '/%')`
- **brand_assets_update_own** · UPDATE · ruolo `(default)` · USING `bucket_id = 'brand-assets' and name like (auth.uid()::text || '/%')`
- **brand_assets_delete_own** · DELETE · ruolo `(default)` · USING `bucket_id = 'brand-assets' and (name like (auth.uid()::text || '/%') or is_admin())`
- **wedding_photos_read_all** · SELECT · ruolo `(default)` · USING `bucket_id = 'wedding-photos'` · WITH CHECK `bucket_id = 'wedding-photos' and auth.uid() is not null and ( exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.own`
- **wedding_photos_insert_member** · INSERT · ruolo `(default)` · USING `bucket_id = 'wedding-photos' and auth.uid() is not null and ( owner = auth.uid() or exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() ) or is_admin() )` · WITH CHECK `bucket_id = 'wedding-photos' and auth.uid() is not null and ( exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.own`
- **wedding_photos_delete_member** · DELETE · ruolo `(default)` · USING `bucket_id = 'wedding-photos' and auth.uid() is not null and ( owner = auth.uid() or exists ( select 1 from calendar_entries ce where ce.id::text = split_part(name, '/', 1) and ce.owner_id = auth.uid() ) or is_admin() )`
- **blog_media_upload_authors** · INSERT · ruolo `(default)` · USING `—` · WITH CHECK `bucket_id = 'blog-media' and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','fornitore','admin') )`

### `platform_config`
- **platform_config_read** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `is_admin()`
- **platform_config_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `platform_finance_entries`
- **finance_entries_admin** · ALL · ruolo `(default)` · USING `public.is_support_staff()` · WITH CHECK `public.is_support_staff()`

### `post_comments`
- **comments_delete_own** · DELETE · ruolo `(default)` · USING `author_id = auth.uid() or is_admin()` · WITH CHECK `follower_id = auth.uid()`
- **comments_read_visible** · SELECT · ruolo `(default)` · USING `can_see_post(post_id)` · WITH CHECK `author_id = auth.uid() and can_see_post(post_id)`
- **comments_write_own** · INSERT · ruolo `(default)` · USING `—` · WITH CHECK `author_id = auth.uid() and can_see_post(post_id)`

### `post_likes`
- **likes_read_all** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `user_id = auth.uid()`
- **likes_insert_own** · INSERT · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `user_id = auth.uid()`
- **likes_delete_own** · DELETE · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `author_id = auth.uid()`

### `posts`
- **posts_read_visible** · SELECT · ruolo `(default)` · USING `visibility = 'public' or author_id = auth.uid() or is_admin() or (visibility = 'network' and can_see_network_of(auth.uid(), author_id)) or (visibility = 'followers' and exists ( select 1 from follows f where f.followed_id = posts.author_id ` · WITH CHECK `author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','admin','fornitore','couple') )`
- **posts_write_all_roles** · ALL · ruolo `(default)` · USING `author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','admin','fornitore','couple') )` · WITH CHECK `author_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner','location','admin','fornitore','couple') )`

### `price_versions`
- **price_select_via_service** · SELECT · ruolo `(default)` · USING `exists ( select 1 from services s where s.id = price_versions.service_id and ( s.fornitore_id = auth.uid() or has_active_collab_with_supplier(s.fornitore_id) or is_admin() ) )` · WITH CHECK `exists ( select 1 from services s where s.id = service_photos.service_id and s.fornitore_id = aut`

### `product_interest_requests`
- **prod_interest_self** · ALL · ruolo `(default)` · USING `user_id = auth.uid() or is_admin()` · WITH CHECK `user_id = auth.uid() or is_admin()`

### `professioni`
- **professioni_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null and attiva` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **professioni_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `profiles`
- **profiles_select_self** · SELECT · ruolo `(default)` · USING `id = auth.uid()` · WITH CHECK `id = auth.uid()`
- **profiles_select_public** · SELECT · ruolo `(default)` · USING `profile_visibility = 'public'` · WITH CHECK `id = auth.uid()`
- **profiles_select_collab_supplier** · SELECT · ruolo `(default)` · USING `role = 'fornitore' and has_active_collab_with_supplier(id)` · WITH CHECK `id = auth.uid()`
- **profiles_select_collab_capo** · SELECT · ruolo `(default)` · USING `exists ( select 1 from collaborations where fornitore_id = auth.uid() and capostipite_id = profiles.id and status = 'active' )` · WITH CHECK `id = auth.uid()`
- **profiles_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `id = auth.uid()`
- **profiles_update_self** · UPDATE · ruolo `(default)` · USING `id = auth.uid()` · WITH CHECK `id = auth.uid()`
- **profiles_update_admin** · UPDATE · ruolo `(default)` · USING `is_admin()` · WITH CHECK `true`
- **profiles_insert_self** · INSERT · ruolo `(default)` · USING `capostipite_id = auth.uid()` · WITH CHECK `id = auth.uid()`

### `quote_acceptances`
- **qa_select_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid()) or is_admin()` · WITH CHECK `is_admin()`
- **qa_admin_modify** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `quote_items`
- **qitems_select_via_quote** · SELECT · ruolo `(default)` · USING `is_quote_owner(quote_id) or is_admin()` · WITH CHECK `is_quote_owner(quote_id)`
- **qitems_modify_owner** · ALL · ruolo `(default)` · USING `is_quote_owner(quote_id)` · WITH CHECK `is_quote_owner(quote_id)`
- **qitems_select_couple** · SELECT · ruolo `(default)` · USING `exists ( select 1 from quotes q join calendar_entries ce on ce.quote_id = q.id where q.id = quote_items.quote_id and is_wedding_couple(ce.id) )`
- **qitems_select_supplier** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid()`

### `quote_questionnaire_answers`
- **qqa_owner_all** · ALL · ruolo `(default)` · USING `exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from quotes q where q.id = quote_id and q.owner_id = auth.uid())`
- **qqa_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `quote_revisions`
- **quote_revisions_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid())`
- **quote_revisions_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `quote_supplier_markups`
- **qsm_select_via_quote** · SELECT · ruolo `(default)` · USING `is_quote_owner(quote_id) or is_admin()` · WITH CHECK `is_quote_owner(quote_id)`
- **qsm_modify_owner** · ALL · ruolo `(default)` · USING `is_quote_owner(quote_id)` · WITH CHECK `is_quote_owner(quote_id)`

### `quote_view_consents`
- **qview_consents_owner** · SELECT · ruolo `(default)` · USING `exists (select 1 from public.quotes q where q.id = quote_id and q.owner_id = auth.uid()) or is_admin()`

### `quote_views`
- **qviews_owner_select** · SELECT · ruolo `(default)` · USING `exists (select 1 from quotes q where q.id = quote_views.quote_id and q.owner_id = auth.uid())` · WITH CHECK `is_admin()`
- **qviews_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `quotes`
- **quotes_select_owner** · SELECT · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **quotes_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles where id = auth.uid() and role in ('wedding_planner','location','admin') )`
- **quotes_update_owner** · UPDATE · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **quotes_delete_owner** · DELETE · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `is_admin()`
- **quotes_all_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **quotes_select_couple** · SELECT · ruolo `(default)` · USING `exists ( select 1 from calendar_entries ce where ce.quote_id = quotes.id and is_wedding_couple(ce.id) )`
- **quotes_insert_owner** · INSERT · ruolo `(default)` · USING `—` · WITH CHECK `owner_id = auth.uid() and exists ( select 1 from profiles p where p.id = auth.uid() and p.role in ('wedding_planner', 'location', 'admin', 'fornitore') )`

### `recruiting_rewards`
- **recr_rewards_select** · SELECT · ruolo `(default)` · USING `recruiter_id = auth.uid() or is_admin()` · WITH CHECK `is_admin()`
- **recr_rewards_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `referral_credits`
- **credits_select_owner** · SELECT · ruolo `(default)` · USING `wp_id = auth.uid() or is_admin()` · WITH CHECK `is_admin()`
- **credits_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `referral_redeem_attempts`
- **rra_select_own** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or is_admin()`

### `referrals`
- **referrals_select_owner** · SELECT · ruolo `(default)` · USING `referrer_id = auth.uid() or referee_id = auth.uid() or is_admin()` · WITH CHECK `is_admin()`
- **referrals_admin_write** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `scadenzario_voci`
- **scad_select** · SELECT · ruolo `(default)` · USING `is_admin() or debitore_id = auth.uid() or creditore_id = auth.uid() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **scad_insert_owner** · INSERT · ruolo `(default)` · USING `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **scad_update_owner** · UPDATE · ruolo `(default)` · USING `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )` · WITH CHECK `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`
- **scad_delete_owner** · DELETE · ruolo `(default)` · USING `is_admin() or exists ( select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid() )`

### `service_categories`
- **cat_select_standard** · SELECT · ruolo `(default)` · USING `is_standard` · WITH CHECK `created_by = auth.uid() and is_standard = false`
- **cat_select_own** · SELECT · ruolo `(default)` · USING `created_by = auth.uid()` · WITH CHECK `created_by = auth.uid() and is_standard = false`
- **cat_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `created_by = auth.uid() and is_standard = false`
- **cat_insert_user** · INSERT · ruolo `(default)` · USING `created_by = auth.uid()` · WITH CHECK `created_by = auth.uid() and is_standard = false`
- **cat_update_own** · UPDATE · ruolo `(default)` · USING `created_by = auth.uid()` · WITH CHECK `created_by = auth.uid()`
- **cat_delete_own** · DELETE · ruolo `(default)` · USING `created_by = auth.uid()` · WITH CHECK `is_admin()`
- **cat_all_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `service_components`
- **comp_select** · SELECT · ruolo `(default)` · USING `exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid()) or exists ( select 1 from services s join collaborations c on c.fornitore_id = s.fornitore_id where s.id = service_components.servi` · WITH CHECK `exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())`
- **comp_modify** · ALL · ruolo `(default)` · USING `exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())` · WITH CHECK `exists (select 1 from services s where s.id = service_components.service_id and s.fornitore_id = auth.uid())`

### `service_modifiers`
- **mods_select_via_service** · SELECT · ruolo `(default)` · USING `exists ( select 1 from services s where s.id = service_modifiers.service_id and ( s.fornitore_id = auth.uid() or has_active_collab_with_supplier(s.fornitore_id) or is_admin() ) )` · WITH CHECK `exists ( select 1 from services s where s.id = service_modifiers.service_id and s.fornitore_id = auth.uid() )`
- **mods_modify_owner_service** · ALL · ruolo `(default)` · USING `exists ( select 1 from services s where s.id = service_modifiers.service_id and s.fornitore_id = auth.uid() )` · WITH CHECK `exists ( select 1 from services s where s.id = service_modifiers.service_id and s.fornitore_id = auth.uid() )`

### `service_photos`
- **photos_select_via_service** · SELECT · ruolo `(default)` · USING `exists ( select 1 from services s where s.id = service_photos.service_id and ( s.fornitore_id = auth.uid() or has_active_collab_with_supplier(s.fornitore_id) or is_admin() ) )` · WITH CHECK `exists ( select 1 from services s where s.id = service_photos.service_id and s.fornitore_id = auth.uid() )`
- **photos_modify_owner_service** · ALL · ruolo `(default)` · USING `exists ( select 1 from services s where s.id = service_photos.service_id and s.fornitore_id = auth.uid() )` · WITH CHECK `exists ( select 1 from services s where s.id = service_photos.service_id and s.fornitore_id = auth.uid() )`

### `service_presets`
- **presets_select** · SELECT · ruolo `(default)` · USING `fornitore_id = auth.uid() or exists (select 1 from collaborations c where c.fornitore_id = service_presets.fornitore_id and c.capostipite_id = auth.uid() and c.status = 'active') or is_admin()` · WITH CHECK `fornitore_id = auth.uid()`
- **presets_modify** · ALL · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`

### `services`
- **services_select_owner** · SELECT · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`
- **services_select_collab** · SELECT · ruolo `(default)` · USING `has_active_collab_with_supplier(fornitore_id)` · WITH CHECK `fornitore_id = auth.uid()`
- **services_select_admin** · SELECT · ruolo `(default)` · USING `is_admin()` · WITH CHECK `fornitore_id = auth.uid()`
- **services_modify_owner** · ALL · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`

### `servizio_template`
- **servizio_template_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **servizio_template_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `standard_contract_clauses`
- **clauses_read_auth** · SELECT · ruolo `(default)` · USING `auth.uid() is not null and is_active` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`
- **clauses_write_admin** · ALL · ruolo `(default)` · USING `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')` · WITH CHECK `exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')`

### `suggested_contract_templates`
- **suggested_tpl_read** · SELECT · ruolo `(default)` · USING `true` · WITH CHECK `is_admin()`
- **suggested_tpl_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_appointments`
- **appointments_own** · ALL · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **appointments_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_availability`
- **avail_select_own** · SELECT · ruolo `(default)` · USING `fornitore_id = auth.uid() or is_admin() or exists ( select 1 from collaborations c where c.fornitore_id = supplier_availability.fornitore_id and c.capostipite_id = auth.uid() and c.status = 'active' )` · WITH CHECK `fornitore_id = auth.uid()`
- **avail_modify_own** · ALL · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`

### `supplier_capostipite_pricing`
- **scp_select_supplier** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid() or capostipite_id = auth.uid() or is_admin()` · WITH CHECK `supplier_id = auth.uid()`
- **scp_modify_supplier** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **scp_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_client_briefs`
- **briefs_owner_all** · ALL · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **briefs_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_clients`
- **sclients_select_own** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **sclients_insert_own** · INSERT · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **sclients_update_own** · UPDATE · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **sclients_delete_own** · DELETE · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `is_admin()`
- **sclients_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_contract_templates`
- **sct_select_own** · SELECT · ruolo `(default)` · USING `fornitore_id = auth.uid() or is_admin()` · WITH CHECK `fornitore_id = auth.uid()`
- **sct_modify_own** · ALL · ruolo `(default)` · USING `fornitore_id = auth.uid()` · WITH CHECK `fornitore_id = auth.uid()`

### `supplier_cost_ingredients`
- **cost_ingredients_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`

### `supplier_credits`
- **credits_parties_select** · SELECT · ruolo `(default)` · USING `creditor_id = auth.uid() or debtor_id = auth.uid() or is_admin()`

### `supplier_date_options`
- **date_options_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **date_options_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_event_collaborators`
- **event_collab_owner** · ALL · ruolo `(default)` · USING `owner_id = auth.uid()` · WITH CHECK `owner_id = auth.uid()`
- **event_collab_self_read** · SELECT · ruolo `(default)` · USING `collaborator_id = auth.uid()` · WITH CHECK `collaborator_id = auth.uid()`
- **event_collab_self_update** · UPDATE · ruolo `(default)` · USING `collaborator_id = auth.uid()` · WITH CHECK `collaborator_id = auth.uid()`

### `supplier_inventory_items`
- **inventory_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`

### `supplier_invites`
- **si_select_owner_or_admin** · SELECT · ruolo `(default)` · USING `capostipite_id = auth.uid() or is_admin()` · WITH CHECK `capostipite_id = auth.uid()`
- **si_insert_owner** · INSERT · ruolo `(default)` · USING `capostipite_id = auth.uid() or is_admin()` · WITH CHECK `capostipite_id = auth.uid()`
- **si_update_owner** · UPDATE · ruolo `(default)` · USING `capostipite_id = auth.uid() or is_admin()`
- **si_delete_owner** · DELETE · ruolo `(default)` · USING `capostipite_id = auth.uid() or is_admin()`

### `supplier_leads`
- **supplier_leads_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **supplier_leads_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_referrals`
- **referrals_parties_select** · SELECT · ruolo `(default)` · USING `referrer_id = auth.uid() or suggested_id = auth.uid() or is_admin()`

### `supplier_subscriptions`
- **sub_own** · SELECT · ruolo `(default)` · USING `supplier_id = auth.uid() or is_admin()` · WITH CHECK `is_admin()`
- **sub_admin** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`

### `supplier_team_assignments`
- **team_assign_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`

### `supplier_team_event_items`
- **team_event_items_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **event_items_shared_read** · SELECT · ruolo `(default)` · USING `public.is_event_collaborator(event_id)`

### `supplier_team_event_packing`
- **packing_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`

### `supplier_team_events`
- **team_events_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`
- **team_events_shared_read** · SELECT · ruolo `(default)` · USING `public.is_event_collaborator(id)`

### `supplier_team_members`
- **team_members_own** · ALL · ruolo `(default)` · USING `supplier_id = auth.uid()` · WITH CHECK `supplier_id = auth.uid()`

### `support_ticket_messages`
- **ticket_msg_select** · SELECT · ruolo `(default)` · USING `exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))` · WITH CHECK `author_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))`
- **ticket_msg_insert** · INSERT · ruolo `(default)` · USING `—` · WITH CHECK `author_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))`

### `support_tickets`
- **support_tickets_insert_own** · INSERT · ruolo `(default)` · USING `user_id = auth.uid() or is_admin()` · WITH CHECK `user_id = auth.uid()`
- **support_tickets_select_own_or_admin** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or is_support_staff()` · WITH CHECK `author_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))`
- **support_tickets_update_staff** · UPDATE · ruolo `(default)` · USING `is_support_staff()` · WITH CHECK `author_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_support_staff()))`

### `user_notifications`
- **user_notif_own** · SELECT · ruolo `(default)` · USING `user_id = auth.uid() or is_admin()` · WITH CHECK `user_id = auth.uid()`
- **user_notif_update_own** · UPDATE · ruolo `(default)` · USING `user_id = auth.uid()` · WITH CHECK `user_id = auth.uid()`

### `wedding_couple_members`
- **couple_owner_all** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **couple_admin_all** · ALL · ruolo `(default)` · USING `is_admin()` · WITH CHECK `is_admin()`
- **couple_self_select** · SELECT · ruolo `(default)` · USING `user_id = auth.uid()`

### `wedding_tasks`
- **tasks_select_owner_or_part** · SELECT · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id))) or is_admin()` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **tasks_modify_owner** · ALL · ruolo `(default)` · USING `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())` · WITH CHECK `exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())`
- **tasks_select_couple** · SELECT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tasks_insert_couple** · INSERT · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tasks_update_couple** · UPDATE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`
- **tasks_delete_couple** · DELETE · ruolo `(default)` · USING `is_wedding_couple(entry_id)` · WITH CHECK `is_wedding_couple(entry_id)`


---

## Priorità per la revisione umana (richiedono introspezione live `pg_policies`)

> Lo statico non ha trovato **BUCO confermati**: gli audit table sono RLS-on senza grant (deny-all), e le viste esposte ad `anon` non referenziano PII. Restano da **confermare in ambiente live** i punti seguenti (Docker non disponibile stanotte).

### A. Superfici senza RLS esposte ad `anon` (classe della falla del 1° giugno)
Le **viste non applicano RLS**: la loro sicurezza dipende dalla definizione (e da `security_invoker`). Da confermare che aggreghino soltanto e non espongano identificatori o dati cross-tenant:
- `user_rating_summary` — GRANT `anon, authenticated` SELECT. Body senza PII rilevata. **Verificare** che il rating sia aggregato e non per-cliente.
- `v_salute_evento` — GRANT `anon, authenticated` SELECT. **Verificare**: nome suggerisce dati per-evento; assicurarsi che non esponga `client_name`/valore/note né dati di eventi altrui.
- `v_riconciliazione_evento`, `supplier_trial_status` — GRANT `authenticated` SELECT (no anon). Verificare lo scope (cross-tenant?).

### B. Config leggibile da tutti (`USING (true)`, solo SELECT)
Tabelle di riferimento/config con lettura pubblica — **OK se non contengono segreti**:
`market_prices`, `beta_status`, `blog_categories`, `post_likes`, `collaboration_ratings`, `feature_flags`, `suggested_contract_templates`, `platform_config`.
→ **Verificare in particolare** `platform_config` e `feature_flags`: che NON contengano chiavi/secret o flag che rivelino logica sensibile.

### C. Tabelle PII protette da RLS+policy — confermare lo scope owner
Hanno RLS abilitata e policy (vedi *Dettaglio policy*); le predicate sembrano legate a `auth.uid()`/owner, ma vanno provate coi test di isolamento (`tests/sql/pii_isolation_tests.sql`) ed eventualmente `pg_policies` live:
`quote_acceptances`, `quote_view_consents`, `contracts`, `supplier_clients`, `lead_requests`, `network_prospects`, `network_prospect_logs`, `referral_redeem_attempts`.

### D. Confermato OK — lockdown audit
`access_audit_log`, `admin_audit`, `audit_log`, `contracts_legacy_audit`, `quote_acceptances_audit`, `signature_audit_trail`, `lead_submit_attempts`: **RLS abilitata, nessun GRANT ad anon/authenticated, policy assenti o solo service-role** → di fatto **deny-all** alle sessioni client. Coerente con `audit_tables_lockdown` (1 giugno).

> **Metodo:** mappa derivata da parsing statico delle migrazioni (`docs`-only, nessuna connessione al DB di produzione). Per la conferma definitiva: avviare il DB locale (`supabase start` + `db reset`) e interrogare `pg_policies`, `information_schema.role_table_grants`, `pg_views`.

---

## ESITI DINAMICI LIVE (notte 2 — DB locale avviato, `pg_policies` reale)

> Stavolta il DB locale è partito (`supabase start` + `db reset`). Test eseguiti contro Postgres reale. Sostituiscono i `DA-VERIFICARE` per i punti coperti.

### 🟢 BUCO #1 — `calendar_entries` esponeva PII cliente ai fornitori *(CHIUSO e provato — split strutturale, opzione a)*
- **Era (P5 ROSSO):** un *participant/fornitore* leggeva `client_name`/`client_email`/`notes`/`value_amount` dalla **tabella base** `calendar_entries` via `calentry_select_participant`/`ce_select_collab_supplier` (RLS per-riga → riga intera).
- **Fix (mig. `20260610010000_split_calendar_entries_private.sql`):** le 4 colonne PII sono state **spostate** in **`calendar_entries_private`** (PK `entry_id`→`calendar_entries`, RLS `cep_select_owner_couple_admin` = owner/couple/admin, write owner/admin) e **droppate** dalla base. Trigger `ensure_calendar_entry_private` crea la riga privata vuota all'insert dell'evento.
- **Prova rosso→verde:** `pii_isolation_tests.sql` › **P5** (cols PII assenti dalla base · fornitore **0/denied** su `_private` · ma vede ancora data/stato dell'evento) + **P5b** (owner legge `client_name` da `_private`). Regressione `rls_tests.sql` **8/8 verde**.
- **Accesso legittimo intatto:** owner/coppia leggono tutto via embed PostgREST `calendar_entries_private(...)` (verificato live); i guadagni del fornitore (`useSupplierEarnings`) non usavano `value_amount` (vengono da `quote_items.line_client` propri). Frontend (`useCalendar`/`useWedding`/`useCouple`) ed edge (`quote-send`) adattati; `tsc`/`build` verdi.

### 🟢 BUCO #2 — `v_salute_evento` leggibile da anon cross-tenant *(CHIUSO e provato)*
- **Prova rosso→verde:** `tests/sql/views_isolation_tests.sql` › V1. Prima: anon leggeva **1 riga** per-evento (la vista era `security_invoker` **off** → girava come owner, bypassando la RLS). Dopo: anon **negato**, owner vede i propri (V2), aggregato pubblico intatto (V3).
- **Fix:** `supabase/migrations/20260609020000_fix_view_salute_evento_invoker.sql` → `alter view ... set (security_invoker = on)` + `revoke select ... from anon`.

### 🟢 Viste — verdetto live
- `v_salute_evento` → **corretto** a `security_invoker=on`.
- `v_riconciliazione_evento`, `calendar_entries_for_participants` → già `security_invoker=on`.
- `user_rating_summary` → **aggregato pubblico voluto** (`avg(stars), count(*) group by rated_id`): nessuna colonna identificativa/cross-tenant. **OK.**

### 🟢 Isolamento confermato live
- **anon negato** (0 righe o *permission denied*) su tutte le 13 tabelle PII/audit testate (P1 ✅).
- **cross-tenant** OK: capostipite B non vede preventivi né prospect di A (P2/P3 ✅).
- **participant** via vista ridotta senza PII (P4 ✅); anon non modifica gli audit (P6 ✅).
- **regression**: gli 8 test `rls_tests.sql` esistenti restano verdi.
