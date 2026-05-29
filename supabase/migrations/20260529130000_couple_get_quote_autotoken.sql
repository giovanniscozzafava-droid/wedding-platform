-- ============================================================================
-- couple_get_quote_for_entry v2: auto-genera access_token se manca
-- ============================================================================
-- Fix: la coppia loggata che apre il tab Preventivo, se il WP non ha ancora
-- "inviato" il quote (sent_at + access_token), riceveva NULL come token e il
-- link /p/accept/null falliva con "invalid input syntax for type uuid".
--
-- Soluzione: la RPC, dopo aver verificato la membership couple, se trova
-- access_token NULL ne genera uno al volo (gen_random_uuid) e setta sent_at.
-- La coppia legittima ha diritto a firmare → token = OK.
-- ============================================================================

create or replace function public.couple_get_quote_for_entry(p_entry_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote quotes%rowtype;
  v_entry calendar_entries%rowtype;
  v_items jsonb;
  v_owner record;
  v_business_model text := 'GLOBAL';
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;

  if not exists (
    select 1 from public.wedding_couple_members m
     where m.entry_id = p_entry_id and m.user_id = v_uid
  ) then
    return jsonb_build_object('error', 'not_couple_member');
  end if;

  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null or v_entry.quote_id is null then
    return jsonb_build_object('error', 'no_quote');
  end if;

  select * into v_quote from public.quotes where id = v_entry.quote_id;
  if v_quote.id is null then
    return jsonb_build_object('error', 'quote_not_found');
  end if;

  -- Auto-token: la coppia ha diritto di firmare → se manca access_token lo genero.
  if v_quote.access_token is null then
    update public.quotes
       set access_token = gen_random_uuid(),
           sent_at = coalesce(sent_at, now())
     where id = v_quote.id
     returning * into v_quote;
  end if;

  v_business_model := coalesce(v_entry.business_model, 'GLOBAL');

  if v_business_model = 'GLOBAL' then
    select jsonb_agg((to_jsonb(qi) - 'supplier_id') order by qi.sort_order)
      into v_items from public.quote_items qi where qi.quote_id = v_quote.id;
  else
    select jsonb_agg(to_jsonb(qi) order by qi.sort_order)
      into v_items from public.quote_items qi where qi.quote_id = v_quote.id;
  end if;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color, role, subrole, city
    into v_owner
    from public.profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',                v_quote.id,
    'access_token',      v_quote.access_token,
    'title',             v_quote.title,
    'client_name',       v_quote.client_name,
    'client_email',      v_quote.client_email,
    'event_date',        v_quote.event_date,
    'event_kind',        v_quote.event_kind,
    'event_location',    v_quote.event_location,
    'guest_count',       v_quote.guest_count,
    'status',            v_quote.status,
    'revision',          v_quote.revision,
    'total_client',      v_quote.total_client,
    'pdf_url',           v_quote.pdf_url,
    'accepted_at',       v_quote.accepted_at,
    'business_model',    v_business_model,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end$$;

grant execute on function public.couple_get_quote_for_entry(uuid) to authenticated;

comment on function public.couple_get_quote_for_entry(uuid) is
  'Coppia logged-in legge il proprio preventivo dalla dashboard. v2 (29-05-2026): se quote non ha access_token lo genera al volo (volatile + UPDATE).';
