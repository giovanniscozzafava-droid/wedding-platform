-- Atterraggio cliente (regola insindacabile): finche' la coppia NON ha firmato almeno un preventivo,
-- la dashboard atterra SEMPRE su "Preventivo". Dopo la prima firma → atterra sulla pagina principale.
-- couple_has_signed(): true se la coppia (utente loggato) ha almeno un contratto firmato o un
-- preventivo accettato su uno dei suoi eventi.
create or replace function public.couple_has_signed()
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.contracts c
      join public.wedding_couple_members m on m.entry_id = c.entry_id
      where m.user_id = auth.uid() and c.signed_at is not null
    )
    or exists (
      select 1 from public.calendar_entries ce
      join public.wedding_couple_members m on m.entry_id = ce.id
      join public.quotes q on q.id = ce.quote_id
      where m.user_id = auth.uid()
        and (q.accepted_at is not null or q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
    );
$$;
revoke all on function public.couple_has_signed() from anon, public;
grant execute on function public.couple_has_signed() to authenticated;
