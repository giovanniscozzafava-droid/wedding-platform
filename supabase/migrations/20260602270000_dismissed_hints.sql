-- ============================================================================
-- Strumento "Non mostrarlo più": qualsiasi tutorial/suggerimento può essere
-- chiuso definitivamente per-utente e NON riappare più.
-- ============================================================================

alter table public.profiles
  add column if not exists dismissed_hints jsonb not null default '[]'::jsonb;

comment on column public.profiles.dismissed_hints is
  'Elenco delle chiavi di tutorial/suggerimenti che l''utente ha scelto di non rivedere più.';

-- Segna un suggerimento come "non mostrarlo più" (persistente)
create or replace function public.dismiss_hint(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_key is null or trim(p_key) = '' then return jsonb_build_object('error','invalid_key'); end if;
  update public.profiles
     set dismissed_hints = (
       select jsonb_agg(distinct k) from (
         select jsonb_array_elements_text(dismissed_hints) k
         union select p_key
       ) s)
   where id = v_uid;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.dismiss_hint(text) to authenticated;

-- Ripristina un suggerimento (per "riattiva tutorial")
create or replace function public.restore_hint(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  update public.profiles
     set dismissed_hints = coalesce((
       select jsonb_agg(k) from (select jsonb_array_elements_text(dismissed_hints) k) s where k <> p_key
     ), '[]'::jsonb)
   where id = v_uid;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.restore_hint(text) to authenticated;
