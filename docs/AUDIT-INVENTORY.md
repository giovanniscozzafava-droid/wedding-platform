# AUDIT-INVENTORY — copertura audit adversariale (NOTTE 1, diagnosi)

> Branch `chore/adversarial-audit`. DB locale (269 migrazioni applicate, seed rigenerato). Solo SQL/RPC/Edge/stati/contabilità. Ogni voce passa per le 5 famiglie A–E (vedi `BREAK-REGISTER.md`).

## 1. Edge Functions (33)
addendum-send · admin-delete-user · admin-impersonate · blog-generate · bug-notify · calendar-export-ics · calendar-notify · contract-generate-pdf · contract-send · funnel-cron · import-pin-url · inbound-email · inbox-reply · instagram-avatar · instagram-import · instagram-oauth-callback · instagram-oauth-start · invite-supplier · lead-notify · link-preview · moodboard-pdf · pexels-search · quote-accept-sign · quote-generate-pdf · quote-send · send-digest · send-questionnaire · sitemap-xml · suggest-alternatives · suggested-suppliers-notify · support-notify · support-ticket · upload-photo

## 2. Tabelle con stato/ciclo di vita (45)
`quotes.status` · `quote_items.payment_status` · `calendar_entries.{status,evento_stato,ceremony_status}` · `contracts.status` · `contract_addendums.status` · `collaborations.status` · `couple_change_requests.status` · `supplier_availability.status` · `supplier_date_options.status` · `supplier_event_collaborators.status` · `supplier_invites.status` · `supplier_subscriptions.status` · `supplier_trial_status.{state,subscription_status}` · `referrals.status` · `referral_credits.status` · `supplier_credits.status` · `supplier_referrals.status` · `recruiting_rewards.status` · `network_prospects.status` · `lead_requests.status` · `supplier_leads.status` · `follows.status` · `eventi_cambiamento.stato` · `profiles.subscription_status` · `blog_posts.status` · `posts.moderation_status` · `event_subevents.status` · `event_gadgets.status` · `wedding_tasks.phase` · `couple_preferences.planning_stage` · `insurance_policies.status` · `finance_applications.status` · `support_tickets.status` · `bug_reports.status` · `inbound_emails.status` · `notifiche.stato` (+ viste).

## 3. RPC/funzioni SQL che mutano stato — per flusso
- **Preventivo:** `quote_promote_to_inviato` · `quote_accept_by_token` · `quote_reject_by_token` · `quote_conclude_by_client` · `quote_close` · `quote_reopen` · `quote_pick_alternative` · `quote_toggle_option` · `client_decide_quote_item` · `supplier_confirm_quote_item` · `supplier_propose_discount` · `quotes_recalc_totals` · `quote_items_recalc_lines_v2` · `quote_discount_after_change` · `quote_supplier_markup_after_change` · `record_quote_revision` · `enforce_free_quote_limit` · `quotes_flag_forced_without_questionnaire`.
- **Firma/accettazione:** `quote-accept-sign` (Edge, claim atomica) · `quote_accept_by_token` · `sig_audit_from_quote_acceptance` · `read_signature_audit`.
- **Contratto/addendum:** `contract_sign_by_token` · `contract_sign_full` · `sign_contract_offline` · `countersign_contract` · `contracts_enforce_quote_accettato` · `create_contract_from_clauses` · `create_supplier_contract` · `addendum_create_if_changed` · `addendum_sign_by_token` · `addendum_sign_full` · `stamp_contracted_on_contract_sign` · `stamp_contracted_on_addendum_sign` · `advance_funnel_on_contract_signed`.
- **Calendario/collaborazioni:** `opziona_data` · `auto_block_availability_from_quote` · `auto_block_availability_from_contract` · `release_availability_on_quote_regression` · `check_owner_date_busy` · `check_suppliers_busy_in_range` · `recompute_day_availability` · `set_daily_capacity` · `invite_event_collaborator` · `respond_event_invite` · `accept_supplier_invite` · `dropout_fornitore` · `has_active_collab_with_supplier`.
- **Suggerimento alternative:** `suggest-alternatives` (Edge) · `public_suggest_alternatives` · `suggest_alternatives_full` · `record_auto_suggestions` · `quote_pick_alternative`.
- **Referral/contabilità (zona senza incasso):** `recruiting_attribute` · `recruiting_activate_reward` · `recruiting_settle_due` · `admin_recruiting_mark_paid` · `my_recruiting_earnings` · `autocredit_on_referred_contract` · `accept_supplier_credit` · `settle_supplier_credit` · `cancel_supplier_credit` · `supplier_credit_balances` · `referral_commission_for` · `referral_redeem_code` · `referral_to_collaboration` · `get_referral_tier` · `owner_finance_stats` · `professional_funnel_metrics` · `admin_finance_*` · `on_lead_closed_won`.
- **Lead:** `submit_lead_request` · `submit_public_lead` · `create_event_from_lead` · `create_quote_from_supplier_lead` · `lead_transition` · `on_lead_closed_won`.

## 4. Flussi end-to-logica passati al setaccio
preventivo · firma/accettazione · contratto+addendum · calendario+collaborazioni · suggest-alternatives · referral/contabilità · lead.

## 5. Matrice copertura famiglie × flusso
(✓ = attaccato con test; vedi BREAK-REGISTER per esiti)

| Flusso | A stati | B concorrenza | C cascate | D confini | E ruoli |
|---|---|---|---|---|---|
| Preventivo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Firma/accettazione | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contratto/addendum | ✓ | ✓ | ✓ | — | ✓ |
| Calendario/collab | ✓ | ✓ | ✓ | ✓ | ✓ |
| Suggest-alternatives | ✓ | ✓ | — | ✓ | ✓ |
| Referral/contabilità | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lead | ✓ | — | ✓ | ✓ | — |
