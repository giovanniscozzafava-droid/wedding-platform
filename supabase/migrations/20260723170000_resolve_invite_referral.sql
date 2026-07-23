-- resolve_supplier_invite: espone `is_referral` (invito legato a un preventivo, cioè
-- source_quote_id valorizzato) così la pagina di accettazione può instradare il fornitore
-- verso l'opportunità (/suggerimenti-ricevuti) invece del catalogo generico.
-- Resto della funzione IDENTICO alla versione precedente (20260625160000).
create or replace function resolve_supplier_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite supplier_invites%rowtype;
  v_capo profiles%rowtype;
begin
  select * into v_invite from supplier_invites where token = p_token limit 1;
  if not found then
    return jsonb_build_object('error', 'invito non valido');
  end if;

  select * into v_capo from profiles where id = v_invite.capostipite_id;

  -- già accettato/usato → NON è un errore: l'utente ha già un account, offriamo l'accesso
  if v_invite.status <> 'PENDING' then
    return jsonb_build_object(
      'already', true,
      'email', v_invite.email,
      'is_referral', v_invite.source_quote_id is not null,
      'capo_name', coalesce(v_capo.business_name, v_capo.full_name)
    );
  end if;

  if v_invite.expires_at <= now() then
    return jsonb_build_object(
      'error', 'invito scaduto', 'expired', true,
      'email', v_invite.email,
      'capo_name', coalesce(v_capo.business_name, v_capo.full_name)
    );
  end if;

  return jsonb_build_object(
    'email', v_invite.email,
    'subrole_hint', v_invite.subrole_hint,
    'message', v_invite.message,
    'expires_at', v_invite.expires_at,
    'is_referral', v_invite.source_quote_id is not null,
    'capo_name', coalesce(v_capo.business_name, v_capo.full_name)
  );
end$$;

grant execute on function resolve_supplier_invite(uuid) to anon, authenticated;
