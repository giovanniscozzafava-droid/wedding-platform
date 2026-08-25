-- ============================================================================
-- Referral cieco (Scenario B): quando il cliente ACCETTA il preventivo di Pro B,
-- oltre a sbloccare i contatti va TRAVASATO il contatto reale nel preventivo di B,
-- altrimenti il contratto di B nasce intestato a "Cliente suggerito" con email
-- vuota. Il consenso è dato proprio dall'accettazione → è il momento giusto per
-- materializzare i dati (name/email/phone) da supplier_suggestions_private e
-- creare una vera anagrafica supplier_clients per B (con direct_client_id).
-- Si riempiono SOLO i campi ancora placeholder/vuoti (non si sovrascrive un dato
-- reale già messo dal firmatario in quote-accept-sign). Il fiscale del cliente
-- resta importato da quote_acceptances (build_contract_sections, mig 181000).
-- ============================================================================
create or replace function public.tg_suggestion_on_quote_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sugg public.supplier_suggestions%rowtype;
  v_priv public.supplier_suggestions_private%rowtype;
  v_client uuid;
begin
  if new.status = 'ACCETTATO' and coalesce(old.status,'') <> 'ACCETTATO' then
    select * into v_sugg from public.supplier_suggestions where quote_id = new.id limit 1;
    if v_sugg.id is not null and v_sugg.status <> 'ACCEPTED' then
      update public.supplier_suggestions set status = 'ACCEPTED', updated_at = now() where id = v_sugg.id;

      -- Contatto reale (referrer) ora sbloccabile: travaso nel preventivo di B.
      select * into v_priv from public.supplier_suggestions_private where suggestion_id = v_sugg.id;
      if v_priv.suggestion_id is not null then
        -- Anagrafica vera per il fornitore, se il preventivo non ne ha già una.
        if new.direct_client_id is null
           and coalesce(nullif(trim(v_priv.client_name),''), nullif(trim(v_priv.client_email),'')) is not null then
          insert into public.supplier_clients (supplier_id, full_name, email, phone, status)
          values (v_sugg.supplier_id,
                  coalesce(nullif(trim(v_priv.client_name),''), 'Cliente'),
                  nullif(trim(v_priv.client_email),''),
                  nullif(trim(v_priv.client_phone),''),
                  'CLIENTE')
          returning id into v_client;
        end if;

        update public.quotes set
          client_name = case
              when coalesce(nullif(trim(client_name),''),'') in ('', 'Cliente suggerito')
              then coalesce(nullif(trim(v_priv.client_name),''), client_name)
              else client_name end,
          client_email = case
              when coalesce(nullif(trim(client_email),''),'') = ''
              then coalesce(nullif(trim(v_priv.client_email),''), client_email)
              else client_email end,
          direct_client_id = coalesce(direct_client_id, v_client)
        where id = new.id;
      end if;

      -- notifica in-app al fornitore: ora vede i contatti
      begin
        perform public.push_user_notification(
          v_sugg.supplier_id, 'SUGGESTION_ACCEPTED',
          'Preventivo accettato',
          'Il cliente suggerito ha accettato il tuo preventivo: ora vedi i contatti.',
          '/quotes/' || new.id::text, v_sugg.id);
      exception when others then null; end;
    end if;
  end if;
  return new;
end$$;
