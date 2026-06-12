-- FIX sicurezza: _photo_circle_member include anche la COPPIA (via is_evento_member →
-- wedding_couple_members). Quindi video_can_edit permetteva alla coppia di consegnare/
-- modificare il video. La coppia deve solo guardare e commentare. Escludiamola.
create or replace function public.video_can_edit(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_wedding_couple(p_entry) and (
       public._photo_circle_member(p_entry) or public.is_admin()
    or exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())
    or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
    or exists (select 1 from public.video_projects vp where vp.entry_id = p_entry and vp.owner_id = auth.uid())
  );
$$;
