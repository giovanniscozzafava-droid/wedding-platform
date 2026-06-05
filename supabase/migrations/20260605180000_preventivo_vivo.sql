-- ============================================================================
-- PREVENTIVO VIVO: il preventivo non è più "one-shot". Dopo l'accettazione resta
-- interattivo: il WP aggiunge voci (anche di altri fornitori), il cliente le vede
-- LIVE nella sua area e accetta/rifiuta la SINGOLA voce. Quando ha finito, il WP
-- preme "Chiudi preventivo" (closed_at). Nessuno stato nuovo nell'enum: "vivo" =
-- closed_at IS NULL. Il contratto firmato NON viene toccato in automatico.
-- ----------------------------------------------------------------------------

-- 1) Stato per-voce deciso dal CLIENTE + chiusura preventivo.
alter table public.quote_items
  add column if not exists client_decision      text not null default 'IN_ATTESA'
    check (client_decision in ('IN_ATTESA','ACCETTATO','RIFIUTATO')),
  add column if not exists client_decided_at     timestamptz,
  add column if not exists client_decline_reason text;

alter table public.quotes
  add column if not exists closed_at timestamptz;

comment on column public.quote_items.client_decision is
  'Decisione del cliente sulla singola voce nel preventivo vivo: IN_ATTESA (nuova proposta da valutare), ACCETTATO, RIFIUTATO.';
comment on column public.quotes.closed_at is
  'Preventivo vivo: se NULL il preventivo è interattivo (cliente può accettare/rifiutare voci); se valorizzato il WP lo ha chiuso e diventa read-only.';

-- 2) Backfill: le voci dei preventivi GIÀ accettati/contrattualizzati erano parte
--    di ciò che il cliente ha firmato → contano come ACCETTATO.
update public.quote_items qi
   set client_decision = 'ACCETTATO',
       client_decided_at = coalesce(client_decided_at, now())
  from public.quotes q
 where q.id = qi.quote_id
   and qi.client_decision = 'IN_ATTESA'
   and q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO');

-- 3) Cliente decide su una singola voce (autorizzato per email del JWT) ---------
create or replace function public.client_decide_quote_item(
  p_item_id uuid,
  p_decision text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_quote   uuid;
  v_owner   text;
  v_closed  timestamptz;
  v_accepted numeric;
  v_pending  numeric;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA') then
    return jsonb_build_object('error','bad_decision');
  end if;

  select qi.quote_id, lower(q.client_email), q.closed_at
    into v_quote, v_owner, v_closed
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
   where qi.id = p_item_id;

  if v_quote is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;
  if v_closed is not null then return jsonb_build_object('error','closed'); end if;

  update public.quote_items
     set client_decision = p_decision,
         client_decided_at = now(),
         client_decline_reason = case when p_decision = 'RIFIUTATO' then p_reason else null end
   where id = p_item_id;

  -- Totali aggiornati live (confermato = solo voci accettate).
  select
    coalesce(sum(line_client) filter (where client_decision = 'ACCETTATO'), 0),
    coalesce(sum(line_client) filter (where client_decision = 'IN_ATTESA'), 0)
    into v_accepted, v_pending
    from public.quote_items where quote_id = v_quote;

  return jsonb_build_object('ok', true, 'accepted_total', v_accepted, 'pending_total', v_pending);
end$$;

revoke all on function public.client_decide_quote_item(uuid, text, text) from public;
grant execute on function public.client_decide_quote_item(uuid, text, text) to authenticated;

-- 4) WP chiude / riapre il preventivo vivo -------------------------------------
create or replace function public.quote_close(p_quote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update public.quotes
     set closed_at = now()
   where id = p_quote_id
     and (owner_id = auth.uid() or is_admin())
   returning id into v_id;
  return v_id is not null;
end$$;

create or replace function public.quote_reopen(p_quote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update public.quotes
     set closed_at = null
   where id = p_quote_id
     and (owner_id = auth.uid() or is_admin())
   returning id into v_id;
  return v_id is not null;
end$$;

revoke all on function public.quote_close(uuid)  from public;
revoke all on function public.quote_reopen(uuid) from public;
grant execute on function public.quote_close(uuid)  to authenticated;
grant execute on function public.quote_reopen(uuid) to authenticated;

-- 5) Portale cliente: includi le VOCI con la decisione per-voce + closed_at -----
create or replace function public.client_portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_result jsonb;
begin
  if v_email = '' then
    return jsonb_build_object('error', 'no_email');
  end if;

  select coalesce(jsonb_agg(grp order by grp->>'business_name'), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'owner_id', pr.id,
      'business_name', coalesce(pr.business_name, pr.full_name),
      'role', pr.role,
      'subrole', pr.subrole,
      'brand_logo_url', pr.brand_logo_url,
      'brand_primary_color', pr.brand_primary_color,
      'city', pr.city,
      'quotes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'status', q.status,
          'event_kind', q.event_kind,
          'event_date', q.event_date,
          'event_location', q.event_location,
          'total_client', q.total_client,
          'access_token', q.access_token,
          'revision', q.revision,
          'pdf_url', q.pdf_url,
          'closed_at', q.closed_at,
          'items', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', qi.id,
              'name', qi.name_snapshot,
              'qty', qi.quantity,
              'unit', qi.unit_snapshot,
              'line_client', qi.line_client,
              'supplier', coalesce(sp.business_name, sp.full_name),
              'client_decision', qi.client_decision,
              'decline_reason', qi.client_decline_reason
            ) order by qi.sort_order, qi.created_at), '[]'::jsonb)
            from public.quote_items qi
            left join public.profiles sp on sp.id = qi.supplier_id
            where qi.quote_id = q.id
          ),
          'brief', (
            select jsonb_build_object(
              'delivery_label', b.delivery_label,
              'delivery_date', b.delivery_date,
              'headline', b.headline,
              'items', b.items,
              'note', b.note
            )
            from public.supplier_client_briefs b
            where b.quote_id = q.id and b.shared_at is not null
          )
        ) order by q.event_date nulls last, q.created_at desc), '[]'::jsonb)
        from public.quotes q
        where q.owner_id = pr.id and lower(q.client_email) = v_email
      ),
      'contracts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'status', c.status,
          'access_token', c.access_token,
          'signed_at', c.signed_at,
          'pdf_url', c.pdf_url
        ) order by c.created_at desc), '[]'::jsonb)
        from public.contracts c
        where c.owner_id = pr.id and lower(c.client_email) = v_email
      )
    ) as grp
    from public.profiles pr
    where pr.id in (
      select owner_id from public.quotes where lower(client_email) = v_email
      union
      select owner_id from public.contracts where lower(client_email) = v_email
    )
  ) groups;

  return jsonb_build_object('ok', true, 'email', v_email, 'professionals', v_result);
end$$;

grant execute on function public.client_portal_overview() to authenticated;
