-- Ruolo dedicato per gli OSPITI di un evento: non è un professionista né un cliente.
-- Fa solo "le sue quattro cose" sulla galleria (foto/video/audio/guestbook dell'evento).
-- Confinato: niente aree pro, niente onboarding/registrazione, niente area cliente.
alter type user_role add value if not exists 'GUEST';
