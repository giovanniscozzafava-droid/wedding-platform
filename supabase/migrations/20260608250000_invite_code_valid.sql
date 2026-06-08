-- ============================================================================
-- Beta a inviti: la registrazione è consentita SOLO con un codice invito valido.
-- Il codice è il referral_code di un capostipite (WP/LOCATION) o admin.
-- RPC pubblica (anon) chiamata dal form di registrazione PRIMA del signup.
-- Non espone dati: ritorna solo {valid} e il nome di chi invita.
-- ============================================================================
create or replace function public.invite_code_valid(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_inviter text;
begin
  if p_code is null or length(trim(p_code)) < 4 then
    return jsonb_build_object('valid', false);
  end if;
  select coalesce(business_name, full_name) into v_inviter
    from public.profiles
   where referral_code = upper(trim(p_code))
     and role in ('WEDDING_PLANNER','LOCATION','ADMIN')
   limit 1;
  if v_inviter is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'inviter', v_inviter);
end$$;

grant execute on function public.invite_code_valid(text) to anon, authenticated;
