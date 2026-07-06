-- Bug "value too long for type character varying(60)" in onboarding fornitore: i campi social
-- (instagram/facebook/tiktok) erano varchar(60), troppo corti se l'utente incolla un URL completo
-- (es. https://www.facebook.com/nome.cognome.fotografo). Allargo a 200 come website/tagline.
-- Il form ora ha anche maxLength=200 su quei campi (guardia lato client).
alter table public.profiles alter column instagram type varchar(200);
alter table public.profiles alter column facebook  type varchar(200);
alter table public.profiles alter column tiktok    type varchar(200);
