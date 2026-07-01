-- Event & Wedding Planner: la "parcella" di coordinamento non è più una secca, ma diventano
-- PIÙ PRODOTTI nel pacchetto (parcella matrimonio, compleanno/festa, evento aziendale, cerimonia,
-- consulenza…). Semina i servizi nel catalogo del WP (categorie standard 'wedding_planner' già
-- presenti). Idempotente: solo se il WP non ha ancora servizi.

create or replace function public._wp_seed_parcelle_for(p_uid uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_parc numeric;
begin
  if exists (select 1 from public.services where fornitore_id = p_uid) then return 0; end if;
  select coalesce(parcella_default, 0) into v_parc from public.profiles where id = p_uid;
  insert into public.services(fornitore_id, category_id, name, description, base_price, unit) values
    (p_uid,'11111111-0000-0000-0000-000000000102','Coordinamento matrimonio — full planning','Pianificazione completa: fornitori, budget, scaletta, regia del giorno-G.', coalesce(nullif(v_parc,0),4500),'EVENTO'),
    (p_uid,'11111111-0000-0000-0000-000000000101','Coordinamento matrimonio — day-of','Coordinamento del solo giorno-G: briefing fornitori, timeline, regia.',1200,'EVENTO'),
    (p_uid,'11111111-0000-0000-0000-000000000103','Coordinamento compleanno / festa privata','Organizzazione e regia di feste private, compleanni, anniversari.',900,'EVENTO'),
    (p_uid,'11111111-0000-0000-0000-000000000104','Coordinamento evento aziendale','Regia di eventi corporate: meeting, gala, inaugurazioni, team building.',1800,'EVENTO'),
    (p_uid,'11111111-0000-0000-0000-000000000103','Coordinamento cerimonia (battesimo, comunione, laurea)','Organizzazione di cerimonie e ricevimenti a tema.',700,'EVENTO'),
    (p_uid,'11111111-0000-0000-0000-000000000100','Consulenza orientativa','3 sessioni per impostare l''evento in autonomia.',350,'EVENTO');
  return 6;
end$$;

-- RPC per il WP loggato (chiamata a fine onboarding). Non-WP: no-op.
create or replace function public.wp_ensure_parcelle()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text; v_created int;
begin
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'WEDDING_PLANNER' then return jsonb_build_object('ok', true, 'skipped', true); end if;
  v_created := public._wp_seed_parcelle_for(v_uid);
  return jsonb_build_object('ok', true, 'created', v_created);
end$$;
grant execute on function public.wp_ensure_parcelle() to authenticated;

-- Backfill: tutti i WEDDING_PLANNER esistenti SENZA servizi (es. Antonio Mancuso) ricevono le parcelle.
do $$
declare r record;
begin
  for r in select p.id from public.profiles p
           where p.role = 'WEDDING_PLANNER'
             and not exists (select 1 from public.services s where s.fornitore_id = p.id)
  loop
    perform public._wp_seed_parcelle_for(r.id);
  end loop;
end $$;
