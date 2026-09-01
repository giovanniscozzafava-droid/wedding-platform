-- Chi torna sul link dell'ultimatum dopo aver già risposto deve ritrovare il pulsante
-- per il preventivo (scontato), non una pagina cieca. Il token si espone SOLO a chi è
-- rimasto in gioco: interessato, oppure sconto applicato.
create or replace function public.ultimatum_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_u record; v_q record; v_o record;
begin
  select * into v_u from quote_ultimatums where token = p_token;
  if v_u.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_u.expires_at < now() then return jsonb_build_object('error','expired'); end if;
  select * into v_q from quotes where id = v_u.quote_id;
  select business_name, full_name, brand_primary_color, brand_logo_url into v_o
    from profiles where id = v_u.owner_id;
  return jsonb_build_object(
    'ok', true,
    'client_name', v_q.client_name,
    'title', v_q.title,
    'event_date', v_q.event_date,
    'status', v_q.status::text,
    'responded_at', v_u.responded_at,
    'still_interested', v_u.still_interested,
    'reason', v_u.reason,
    'discount_percent', v_u.discount_percent,
    'discount_applied', v_u.discount_applied,
    'quote_token', case when coalesce(v_u.still_interested, false) or v_u.discount_applied
                        then v_q.access_token end,
    'owner', jsonb_build_object('business_name', v_o.business_name, 'full_name', v_o.full_name,
                                'brand_primary_color', v_o.brand_primary_color, 'brand_logo_url', v_o.brand_logo_url)
  );
end$$;

revoke all on function public.ultimatum_get_by_token(uuid) from public;
grant execute on function public.ultimatum_get_by_token(uuid) to anon, authenticated;
