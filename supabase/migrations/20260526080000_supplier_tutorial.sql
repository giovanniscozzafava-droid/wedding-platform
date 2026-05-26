-- ============================================================================
-- SUPPLIER ONBOARDING TUTORIAL — flag jsonb su profiles per tracciare lo stato
-- del tutorial guidato per fornitori al primo login. Le card sono mostrate
-- finche tutorial_state.dismissed = false. Bottone "Riavvia tutorial" sul
-- ProfilePage le riattiva.
-- ============================================================================

alter table profiles
  add column if not exists tutorial_state jsonb not null default jsonb_build_object(
    'dismissed', false,
    'completed_steps', '[]'::jsonb,
    'first_offer_created', false,
    'started_at', null,
    'completed_at', null
  );

comment on column profiles.tutorial_state is
  'Stato tutorial onboarding fornitore. Schema: { dismissed:bool, completed_steps:string[], first_offer_created:bool, started_at, completed_at }. Le card guida sono visibili finche dismissed=false. Default = nuovo utente non ha ancora visto il tutorial.';
