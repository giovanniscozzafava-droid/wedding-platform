-- Tab Preventivo della coppia: le voci arrivavano piatte e senza immagini. Aggiungiamo alla
-- proiezione di couple_get_quote_for_entry la CATEGORIA (dal servizio d'origine) e una FOTO
-- rappresentativa (prima service_photo), così il frontend può raggrupparle per tipo
-- (Servizio fotografico / Album …) con le immagini, e il cliente capisce che sono opzioni tra
-- cui scegliere. Resto della funzione IDENTICO a 20260713140000 (genera token idempotente, ecc.).
create or replace function public.couple_get_quote_for_entry(p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_quote quotes%rowtype; v_entry calendar_entries%rowtype; v_items jsonb; v_owner record;
  v_business_model text := 'GLOBAL';
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry_id and m.user_id = v_uid) then
    return jsonb_build_object('error','not_couple_member');
  end if;
  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null or v_entry.quote_id is null then return jsonb_build_object('error','no_quote'); end if;
  select * into v_quote from public.quotes where id = v_entry.quote_id;
  if v_quote.id is null then return jsonb_build_object('error','quote_not_found'); end if;

  -- Garantisci il token pubblico per la firma (idempotente): senza, il cliente non può firmare.
  if v_quote.access_token is null then
    update public.quotes set access_token = gen_random_uuid()
      where id = v_quote.id returning access_token into v_quote.access_token;
  end if;

  v_business_model := coalesce(v_entry.business_model, 'GLOBAL');

  select jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name_snapshot', qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot', qi.unit_snapshot,
           'quantity', qi.quantity,
           'line_client', qi.line_client,
           'sort_order', qi.sort_order,
           'client_decision', qi.client_decision,
           'client_decline_reason', qi.client_decline_reason,
           'contracted_at', qi.contracted_at,
           'created_at', qi.created_at,
           'supplier_id', case when v_business_model = 'GLOBAL' then null else qi.supplier_id end,
           'category', sc.name,
           'photo', (select ph.thumbnail_url from public.service_photos ph
                     where ph.service_id = qi.service_id order by ph.sort_order limit 1)
         ) order by qi.sort_order, qi.created_at)
    into v_items
    from public.quote_items qi
    left join public.services svc on svc.id = qi.service_id
    left join public.service_categories sc on sc.id = svc.category_id
    where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, role, subrole, city
    into v_owner from public.profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id', v_quote.id, 'access_token', v_quote.access_token, 'title', v_quote.title,
    'client_name', v_quote.client_name, 'client_email', v_quote.client_email,
    'event_date', v_quote.event_date, 'event_kind', v_quote.event_kind, 'event_location', v_quote.event_location,
    'guest_count', v_quote.guest_count, 'status', v_quote.status, 'revision', v_quote.revision,
    'total_client', v_quote.total_client, 'pdf_url', v_quote.pdf_url, 'accepted_at', v_quote.accepted_at,
    'closed_at', v_quote.closed_at, 'business_model', v_business_model,
    'owner', to_jsonb(v_owner), 'items', coalesce(v_items, '[]'::jsonb)
  );
end$$;
grant execute on function public.couple_get_quote_for_entry(uuid) to authenticated;
