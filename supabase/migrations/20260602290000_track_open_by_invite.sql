-- ============================================================================
-- Traccia l'apertura del preventivo anche quando il cliente NUOVO arriva dal
-- link di invito coppia (/invito-coppia/:token) invece che da /p/preview.
-- Senza questo, un cliente che apre davvero il preventivo non risultava
-- "aperto" in dashboard. Risolve via invite_token → entry → quote.
-- ============================================================================

create or replace function public.track_quote_open_by_invite(p_invite_token uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  select ce.quote_id
    into v_quote_id
    from public.wedding_couple_members m
    join public.calendar_entries ce on ce.id = m.entry_id
   where m.invite_token = p_invite_token
   limit 1;

  if v_quote_id is null then
    return;
  end if;

  update public.quotes
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where id = v_quote_id
     and token_revoked_at is null;

  begin
    perform public.log_access('quotes', v_quote_id::text, 'READ', jsonb_build_object('op','quote_open_via_invite'));
  exception when others then null;
  end;
end$$;

grant execute on function public.track_quote_open_by_invite(uuid) to anon, authenticated;
