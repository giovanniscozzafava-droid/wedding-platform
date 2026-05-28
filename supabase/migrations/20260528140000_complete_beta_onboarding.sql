-- ============================================================================
-- Marca come "onboarding completato" gli account beta-test creati via seed.
-- ----------------------------------------------------------------------------
-- User explicit ack: "Elisa è già iscritta, ma mi sta chiedendo di nuovo i
-- dati di iscrizione". Il seed automatico aveva creato gli utenti via signUp
-- ma non aveva impostato profiles.onboarding_complete = true. RequireAuth
-- li rispedisce al wizard ad ogni login.
-- Idempotente: ignora utenti non presenti.
-- ============================================================================

update profiles
   set onboarding_complete = true
 where id in (
   select id from auth.users
    where lower(email) in (
      'elisabettacitraro1998@gmail.com',
      'elisabettacitraro1998+blackmamba@gmail.com',
      'elisabettacitraro1998+giuseppearas@gmail.com',
      'elisabettacitraro1998+tenutaklope@gmail.com',
      'elisabettacitraro1998+makeup@gmail.com',
      'elisabettacitraro1998+muraca@gmail.com'
    )
 )
   and (onboarding_complete is null or onboarding_complete = false);
