-- Gli auguri vocali devono essere ascoltabili anche dal fornitore proprietario della
-- galleria (oltre a coppia / cerchio / ospite / admin), così compaiono nella sua dashboard.
drop policy if exists aw_read on public.event_audio_wishes;
create policy aw_read on public.event_audio_wishes for select using (
  public.is_wedding_couple(entry_id) or public._photo_circle_member(entry_id)
  or public._photo_is_guest(entry_id) or public.is_admin()
  or exists (select 1 from public.event_galleries g where g.entry_id = event_audio_wishes.entry_id and g.owner_id = auth.uid())
  or exists (select 1 from public.calendar_entries ce where ce.id = event_audio_wishes.entry_id and ce.owner_id = auth.uid())
);
