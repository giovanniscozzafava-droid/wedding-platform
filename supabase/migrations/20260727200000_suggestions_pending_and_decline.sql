-- Un suggerimento ricevuto è, di fatto, una richiesta/lead: va sotto "Richieste" con un
-- contatore +N finché il fornitore non risponde (invia preventivo OPPURE "non disponibile").

-- Conteggio dei suggerimenti ancora in attesa di risposta (per il badge su Richieste).
-- Canale cieco: SENT/VIEWED/QUOTE_CREATED = non ancora risposto (QUOTE_SENT/ACCEPTED/DECLINED = risposto).
-- Canale aperto: SUGGESTED senza preventivo creato.
create or replace function public.pending_suggestions_count()
returns int language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.supplier_suggestions
       where supplier_id = auth.uid() and status in ('SENT','VIEWED','QUOTE_CREATED'))
  + (select count(*) from public.supplier_referrals
       where suggested_id = auth.uid() and status = 'SUGGESTED' and quote_id is null)
  )::int;
$$;
revoke all on function public.pending_suggestions_count() from public, anon;
grant execute on function public.pending_suggestions_count() to authenticated;

-- "Non ci sono / non disponibile" per una segnalazione del canale aperto (supplier_referrals):
-- il fornitore suggerito la declina → CANCELLED. RLS non consente l'update diretto, serve la RPC.
-- (Il canale cieco supplier_suggestions è declinabile via RLS: update status='DECLINED'.)
create or replace function public.supplier_decline_referral(p_referral_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.supplier_referrals%rowtype;
begin
  select * into r from public.supplier_referrals where id = p_referral_id;
  if r.id is null then return jsonb_build_object('error','not_found'); end if;
  if r.suggested_id <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('error','not_owner');
  end if;
  update public.supplier_referrals set status = 'CANCELLED' where id = p_referral_id;
  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.supplier_decline_referral(uuid) from public, anon;
grant execute on function public.supplier_decline_referral(uuid) to authenticated;
