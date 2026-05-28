-- ============================================================================
-- Auto-generazione slug profile + backfill
-- ----------------------------------------------------------------------------
-- Bug: i fornitori beta hanno slug=null → link /p/fornitore/null che porta in
-- nulla. La pagina pubblica del fornitore richiede uno slug stabile.
--
-- Fix:
--  1) Helper slugify(text) -> kebab-case ascii.
--  2) Trigger BEFORE INSERT / UPDATE OF business_name/full_name su profiles
--     che genera lo slug se manca, garantendone l'unicità con suffisso -2, -3.
--  3) Backfill: assegna slug a tutti i profili che ne sono ancora privi.
-- ============================================================================

create or replace function slugify(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_text is null or trim(p_text) = '' then return null; end if;
  v := trim(p_text);
  -- traslitterazioni base it/eur
  v := translate(lower(v),
    'àáâãäåèéêëìíîïòóôõöùúûüñç''’`',
    'aaaaaaeeeeiiiiooooouuuunc---');
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  v := regexp_replace(v, '-{2,}', '-', 'g');
  return nullif(v, '');
end$$;

create or replace function trg_profiles_slug() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_n int := 1;
begin
  if new.slug is not null and trim(new.slug) <> '' then return new; end if;

  v_base := slugify(coalesce(nullif(new.business_name, ''), new.full_name, 'utente'));
  if v_base is null then v_base := 'utente'; end if;
  v_candidate := v_base;

  -- Trova primo candidato libero (escludendo questo stesso id su update)
  while exists (select 1 from profiles p where p.slug = v_candidate and p.id <> new.id) loop
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n;
    exit when v_n > 100; -- safety
  end loop;

  new.slug := v_candidate;
  return new;
end$$;

drop trigger if exists trg_profiles_set_slug on profiles;
create trigger trg_profiles_set_slug
  before insert or update of business_name, full_name, slug on profiles
  for each row execute function trg_profiles_slug();

-- Backfill: forza UPDATE delle righe con slug nullo per attivare il trigger
update profiles
   set business_name = business_name
 where slug is null;
