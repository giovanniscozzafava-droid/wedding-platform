-- La pagina pubblica dell'invito alla prova menu (/prova-menu-invito/:token)
-- era rotta per TUTTE le coppie: `fb_tasting_invite_public` leggeva
-- `profiles.display_name`, colonna che non esiste → "column p.display_name does
-- not exist" e la coppia non poteva né vedere le date né confermare.
-- Trovato l'08/09/2026 preparando le riprese del video Baronella.
create or replace function public.fb_tasting_invite_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.id, i.client_name, i.rsvp, i.chosen_date_id, i.session_id, s.name as sname, s.season, s.notes as snotes,
         coalesce(nullif(p.business_name, ''), nullif(p.full_name, ''), 'La location') as loc
    into v
    from public.fb_tasting_invites i
    join public.fb_tasting_sessions s on s.id = i.session_id
    join public.profiles p on p.id = s.location_id
   where i.token = p_token;
  if v.id is null then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true, 'invite_id', v.id, 'cliente', v.client_name, 'rsvp', v.rsvp,
    'chosen_date_id', v.chosen_date_id, 'sessione', v.sname, 'stagione', v.season, 'note', v.snotes, 'location', v.loc,
    'date', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'quando', d.scheduled_at, 'sala', d.sala)
                        order by d.sort_order, d.scheduled_at)
                      from public.fb_tasting_session_dates d where d.session_id = v.session_id), '[]'::jsonb));
end$$;
grant execute on function public.fb_tasting_invite_public(text) to anon, authenticated;
