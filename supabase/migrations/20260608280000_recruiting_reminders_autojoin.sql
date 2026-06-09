-- ============================================================================
-- Recruiting CRM — automazioni
--  1) AUTO-ISCRITTO: quando un prospect si registra col codice invito del
--     capostipite, il suo contatto in lista passa a ISCRITTO e si collega al
--     profilo creato (match per email o telefono, ristretto al referrer).
--  2) PROMEMORIA RICHIAMI: conteggio dei richiami scaduti per l'utente, usato
--     dal menu per mostrare il pallino su "Recruiting".
-- ============================================================================

-- 1) Trigger su profiles: referred_by appena valorizzato → marca il prospect.
create or replace function public.auto_mark_prospect_registered()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_email text; v_phone text;
begin
  if new.referred_by is null then return new; end if;

  select id into v_owner from public.profiles where referral_code = upper(new.referred_by) limit 1;
  if v_owner is null then return new; end if;

  select email into v_email from auth.users where id = new.id;
  v_phone := regexp_replace(coalesce(new.phone,''), '[^0-9]', '', 'g');

  update public.network_prospects p set
    status = 'ISCRITTO',
    registered_profile_id = new.id
  where p.owner_id = v_owner
    and p.status <> 'ISCRITTO'
    and (
      (v_email is not null and lower(p.email) = lower(v_email))
      or (length(v_phone) >= 6 and regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g') = v_phone)
    );

  -- Notifica al capostipite (campanella + pallino su /recruiting)
  if found then
    perform public.push_user_notification(v_owner, 'PROSPECT_JOINED',
      'Un contatto si è iscritto',
      coalesce(new.business_name, new.full_name, 'Un professionista') || ' che seguivi si è registrato nella tua rete.',
      '/recruiting', new.id);
  end if;

  return new;
end$$;

drop trigger if exists trg_auto_mark_prospect_ins on public.profiles;
create trigger trg_auto_mark_prospect_ins after insert on public.profiles
  for each row when (new.referred_by is not null)
  execute function public.auto_mark_prospect_registered();

drop trigger if exists trg_auto_mark_prospect_upd on public.profiles;
create trigger trg_auto_mark_prospect_upd after update of referred_by on public.profiles
  for each row when (new.referred_by is not null and new.referred_by is distinct from old.referred_by)
  execute function public.auto_mark_prospect_registered();

-- 2) Conteggio richiami scaduti dell'utente (per il pallino nel menu).
create or replace function public.network_recall_due_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.network_prospects
   where owner_id = auth.uid()
     and status <> 'ISCRITTO'
     and recall_at is not null and recall_at <= now();
$$;
grant execute on function public.network_recall_due_count() to authenticated;
