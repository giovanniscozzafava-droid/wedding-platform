-- INTERESSE DEL CLIENTE VOCE PER VOCE: quali voci del preventivo il cliente ha CLICCATO (guardato)
-- e quali ha OPZIONATO (selected_by_client, per le voci opzionali). Il click sta in una tabella a
-- parte per NON far scattare i trigger prezzo di quote_items.
create table if not exists public.quote_item_clicks (
  item_id          uuid primary key references public.quote_items(id) on delete cascade,
  quote_id         uuid not null references public.quotes(id) on delete cascade,
  clicks           int not null default 0,
  first_clicked_at timestamptz not null default now(),
  last_clicked_at  timestamptz not null default now()
);
create index if not exists idx_quote_item_clicks_quote on public.quote_item_clicks(quote_id);
alter table public.quote_item_clicks enable row level security;
-- lettura: solo l'owner del preventivo (o admin). La scrittura passa dalla RPC SECURITY DEFINER.
drop policy if exists qic_read_owner on public.quote_item_clicks;
create policy qic_read_owner on public.quote_item_clicks for select using (
  exists (select 1 from public.quotes q where q.id = quote_id and (q.owner_id = auth.uid() or public.is_admin()))
);

-- Il CLIENTE (via token del preventivo) segna di aver guardato una voce. Anon: valida che la voce
-- appartenga davvero al preventivo di quel token. Idempotente per riga (incrementa il contatore).
create or replace function public.track_quote_item_click(p_token uuid, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_quote uuid;
begin
  select q.id into v_quote from public.quotes q where q.access_token = p_token limit 1;
  if v_quote is null then return; end if;
  if not exists (select 1 from public.quote_items where id = p_item_id and quote_id = v_quote) then return; end if;
  insert into public.quote_item_clicks (item_id, quote_id, clicks, first_clicked_at, last_clicked_at)
    values (p_item_id, v_quote, 1, now(), now())
  on conflict (item_id) do update set clicks = quote_item_clicks.clicks + 1, last_clicked_at = now();
end$$;
revoke all on function public.track_quote_item_click(uuid, uuid) from public;
grant execute on function public.track_quote_item_click(uuid, uuid) to anon, authenticated;

-- Per il PRO: interesse del cliente su ogni voce del suo preventivo (click + opzionata + decisione).
create or replace function public.quote_item_engagement(p_quote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_res jsonb;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', qi.id,
    'name', qi.name_snapshot,
    'is_optional', qi.is_optional,
    'selected_by_client', coalesce(qi.selected_by_client, false),
    'client_decision', qi.client_decision,
    'clicks', coalesce(c.clicks, 0),
    'last_clicked_at', c.last_clicked_at
  ) order by qi.sort_order), '[]'::jsonb) into v_res
  from public.quote_items qi
  left join public.quote_item_clicks c on c.item_id = qi.id
  where qi.quote_id = p_quote_id;
  return jsonb_build_object('ok', true, 'items', v_res);
end$$;
revoke all on function public.quote_item_engagement(uuid) from public, anon;
grant execute on function public.quote_item_engagement(uuid) to authenticated;
