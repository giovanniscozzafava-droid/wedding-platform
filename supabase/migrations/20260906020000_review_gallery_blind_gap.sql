-- ============================================================================
-- Correzione al fix precedente (20260906010000): review_is_pro_of_entry aveva
-- un SECONDO varco mai chiuso, trovato in verifica dal vivo subito dopo il
-- primo deploy — la proprietà della galleria foto (event_galleries.owner_id)
-- dava accesso a "chiedi una recensione" SENZA alcun controllo blind, un
-- percorso del tutto indipendente da calendar_entry_participants (quello
-- corretto la prima volta). Lo stesso identico problema esiste lato coppia in
-- couple_review_targets (stesso UNION su event_galleries.owner_id, mai
-- filtrato). Un helper unico, riusato in entrambi i punti, chiude i due varchi
-- insieme invece di rincorrerli uno alla volta.
-- ============================================================================

create or replace function public._entry_supplier_is_blind(p_entry uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from calendar_entries ce
      join quote_items qi on qi.quote_id = ce.quote_id
      join quotes q on q.id = qi.quote_id
      join profiles pr on pr.id = q.owner_id
     where ce.id = p_entry
       and qi.supplier_id = p_uid
       and public.quote_item_is_blind(qi, coalesce(pr.capostipite_sale_mode,'BUNDLE'))
  );
$$;
revoke all on function public._entry_supplier_is_blind(uuid, uuid) from public, anon, authenticated;

create or replace function public.review_is_pro_of_entry(p_entry uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from calendar_entries ce where ce.id = p_entry and ce.owner_id = p_uid)
      or (
        exists (select 1 from event_galleries g where g.entry_id = p_entry and g.owner_id = p_uid)
        and not public._entry_supplier_is_blind(p_entry, p_uid)
      )
      or (
        exists (select 1 from calendar_entry_participants cp where cp.entry_id = p_entry and cp.user_id = p_uid)
        and not public._entry_supplier_is_blind(p_entry, p_uid)
      );
$$;
revoke all on function public.review_is_pro_of_entry(uuid, uuid) from public;

-- ── Lato coppia: stesso identico buco, stesso rimedio.
create or replace function public.couple_review_targets(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_e record; v_end date; v_emails text[]; v_out jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from wedding_couple_members m where m.entry_id = p_entry and m.user_id = v_uid) then
    return jsonb_build_object('error','forbidden');
  end if;
  select ce.id, ce.title, ce.date_from, ce.date_to, ce.owner_id, ce.quote_id, ce.event_kind into v_e
    from calendar_entries ce where ce.id = p_entry;
  v_end := coalesce(v_e.date_to, v_e.date_from)::date;
  if v_end is null or v_end >= current_date then
    return jsonb_build_object('ok', true, 'past', false, 'professionals', '[]'::jsonb);
  end if;
  v_emails := public.review_entry_emails(p_entry);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', coalesce(nullif(p.business_name,''), p.full_name),
           'logo', p.brand_logo_url, 'color', p.brand_primary_color,
           'subrole', p.subrole,
           'google', p.review_url_google, 'matrimonio', p.review_url_matrimonio,
           'asked_at', (select max(sent_at) from review_requests rr where rr.entry_id = p_entry and rr.professional_id = p.id),
           'clicked_google', (select max(clicked_at) from review_clicks rc where rc.entry_id = p_entry and rc.professional_id = p.id and rc.user_id = v_uid and rc.platform = 'google'),
           'clicked_matrimonio', (select max(clicked_at) from review_clicks rc where rc.entry_id = p_entry and rc.professional_id = p.id and rc.user_id = v_uid and rc.platform = 'matrimonio')
         ) order by (p.id = v_e.owner_id) desc, p.business_name), '[]'::jsonb)
    into v_out
    from profiles p
   where p.id in (
           select v_e.owner_id
           union
           select g.owner_id from event_galleries g
            where g.entry_id = p_entry and not public._entry_supplier_is_blind(p_entry, g.owner_id)
           union select q.owner_id from quotes q where lower(q.client_email) = any(v_emails) and q.archived_at is null
           union select c.owner_id from contracts c where lower(c.client_email) = any(v_emails)
         )
     and (nullif(trim(coalesce(p.review_url_google,'')),'') is not null
          or nullif(trim(coalesce(p.review_url_matrimonio,'')),'') is not null);

  return jsonb_build_object('ok', true, 'past', true, 'end_date', v_end, 'title', v_e.title,
                            'event_kind', v_e.event_kind, 'professionals', v_out);
end$$;
