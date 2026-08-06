-- FASE B — "Fornitore globale" capostipite: modalità di vendita + blind per singolo servizio.
--
-- 1) Modalità di vendita a livello di profilo (Impostazioni), decisa dal capostipite:
--    - BUNDLE   = vende il pacchetto intero → default nomi fornitori NASCOSTI (blind). Nel denaro:
--                 il capostipite incassa dal cliente, paga i fornitori, trattiene il margine.
--    - ITEMIZED = voci separate → default nomi fornitori VISIBILI. Nel denaro: il fornitore incassa
--                 dal cliente e gira il margine al capostipite.
-- 2) Override per singola voce: quote_items.supplier_blind (null = usa il default della modalità).
--    Il capostipite può mostrare o nascondere il fornitore voce per voce (es. fotografo visibile,
--    noleggio auto/fuochi nascosti).

alter table public.profiles
  add column if not exists capostipite_sale_mode text not null default 'BUNDLE'
    check (capostipite_sale_mode in ('BUNDLE','ITEMIZED'));

alter table public.quote_items
  add column if not exists supplier_blind boolean;  -- null = eredita dalla modalità del capostipite

-- Blind effettivo di una voce: override esplicito, altrimenti default dalla modalità dell'owner.
create or replace function public.quote_item_is_blind(p_item public.quote_items, p_mode text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_item.supplier_blind, p_mode = 'BUNDLE');
$$;

-- quote_get_by_token: rispetta il blind. Per le voci NON blind espone nome + slug + settore del
-- fornitore (il cliente può vedere chi è / lo stile). Per le voci blind NON espone supplier_id né
-- alcun dato del fornitore (anti-leak da devtools).
create or replace function quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
  v_mode    text;
begin
  select * into v_quote from quotes
   where access_token = p_token
     and token_revoked_at is null
     and is_token_valid(access_token_expires_at);
  if v_quote.id is null then
    return null;
  end if;

  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from profiles where id = v_quote.owner_id;

  -- WHITELIST client-safe. Il fornitore appare SOLO sulle voci non-blind.
  select jsonb_agg(jsonb_build_object(
           'id',                  qi.id,
           'name_snapshot',       qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot',       qi.unit_snapshot,
           'quantity',            qi.quantity,
           'line_client',         qi.line_client,
           'sort_order',          qi.sort_order,
           'is_optional',         qi.is_optional,
           'alternative_group',   qi.alternative_group,
           'selected_by_client',  qi.selected_by_client,
           'client_decision',     qi.client_decision,
           'supplier', case
             when public.quote_item_is_blind(qi, v_mode) or qi.supplier_id is null then null
             else (select jsonb_build_object('name', coalesce(sp.business_name, sp.full_name),
                                             'slug', sp.slug, 'subrole', sp.subrole, 'city', sp.city)
                     from profiles sp where sp.id = qi.supplier_id)
           end
         ) order by qi.sort_order)
    into v_items
    from quote_items qi
   where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color,
         role, subrole, city
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',                v_quote.id,
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
    'pdf_variant',       v_quote.pdf_variant,
    'direct_client_id',  v_quote.direct_client_id,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end$$;
