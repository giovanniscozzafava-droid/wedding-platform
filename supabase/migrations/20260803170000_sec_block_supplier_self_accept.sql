-- SICUREZZA (H1 + H3): il fornitore suggerito poteva auto-sbloccarsi i contatti del cliente
-- (nome/email/telefono in supplier_suggestions_private, gate RLS su status='ACCEPTED') in due modi:
--   H1) UPDATE diretto: supabase.from('supplier_suggestions').update({status:'ACCEPTED'})  (la policy
--       sugg_update_owner consente all'UPDATE del supplier_id senza vincolare colonna/valore).
--   H3) portando da sé il PROPRIO preventivo cieco a status='ACCETTATO' (RLS owner + state machine),
--       che fa scattare tg_suggestion_on_quote_accept → status='ACCEPTED'.
-- In ENTRAMBI i casi, al momento dell'UPDATE che porta il suggerimento ad ACCEPTED, il chiamante è
-- autenticato come il FORNITORE del suggerimento (auth.uid() = supplier_id). Le vie legittime — il
-- CLIENTE che accetta via edge service_role (auth.uid() nullo) o via RPC a token (anon/cliente) —
-- hanno auth.uid() diverso da supplier_id. Quindi blocchiamo la transizione ad ACCEPTED quando a
-- farla è il fornitore stesso. Un solo guard chiude entrambe le vie (in H3 l'eccezione fa rollback
-- anche dell'accettazione fasulla del preventivo).

create or replace function public.tg_guard_suggestion_self_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACCEPTED' and coalesce(old.status, '') <> 'ACCEPTED'
     and auth.uid() is not null and auth.uid() = new.supplier_id
     and not public.is_admin() then
    raise exception 'I contatti del cliente si sbloccano solo quando è il CLIENTE ad accettare il preventivo.'
      using errcode = 'check_violation';
  end if;
  return new;
end$$;

drop trigger if exists trg_guard_suggestion_self_accept on public.supplier_suggestions;
create trigger trg_guard_suggestion_self_accept
  before update on public.supplier_suggestions
  for each row execute function public.tg_guard_suggestion_self_accept();
