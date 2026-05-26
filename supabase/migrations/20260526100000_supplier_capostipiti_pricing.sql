-- ============================================================================
-- SUPPLIER → CAPOSTIPITI: prezziari personalizzati per ogni WP/Location collaborante.
--
-- Modello:
--   - collaborations: gia esistente per gestire il rapporto. Aggiunto markup
--     modifier percent (sconto/maggiorazione che il fornitore concede al
--     capostipite rispetto al proprio prezzo catalogo).
--   - supplier_capostipite_pricing: override del prezzo per singolo servizio,
--     PER quel specifico capostipite. Se assente, vale il prezzo catalogo
--     standard del servizio.
--   - RPC supplier_invite_capostipite(p_email): permette al fornitore di
--     inviare richiesta di collaborazione a un WP/LOCATION che esiste gia
--     su Planfully (lookup per email). Crea collab PENDING che il WP
--     accetta/rifiuta dalla sua UI standard.
-- ============================================================================

-- 1. Aggiungi markup modifier su collaborations ---------------------------
alter table collaborations
  add column if not exists supplier_markup_modifier_percent numeric(5,2) not null default 0
    check (supplier_markup_modifier_percent between -100 and 1000),
  add column if not exists supplier_note text,
  add column if not exists initiated_by text not null default 'CAPOSTIPITE'
    check (initiated_by in ('CAPOSTIPITE', 'FORNITORE'));

comment on column collaborations.supplier_markup_modifier_percent is
  'Modificatore prezzo applicato dal fornitore SOLO per questo capostipite (es. -10% sconto fidelta, +5% caso speciale). Sommato algebricamente al markup standard del WP quando crea preventivi.';
comment on column collaborations.supplier_note is
  'Note interne del fornitore su questo capostipite (es. "Paga sempre puntuale 30gg", "Richiede sempre extra orari").';
comment on column collaborations.initiated_by is
  'CAPOSTIPITE = il WP ha invitato il fornitore (flusso classico). FORNITORE = il fornitore ha richiesto collab al WP (nuovo flusso).';

-- 2. Tabella prezziario per servizio per capostipite ----------------------
create table if not exists supplier_capostipite_pricing (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references profiles(id) on delete cascade,
  capostipite_id  uuid not null references profiles(id) on delete cascade,
  service_id      uuid not null references services(id) on delete cascade,
  override_price  numeric(12,2) not null check (override_price >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, capostipite_id, service_id)
);

create index if not exists idx_scp_supplier_capo
  on supplier_capostipite_pricing(supplier_id, capostipite_id);
create index if not exists idx_scp_service
  on supplier_capostipite_pricing(service_id);

create trigger trg_scp_updated_at before update on supplier_capostipite_pricing
  for each row execute function set_updated_at();

alter table supplier_capostipite_pricing enable row level security;

-- RLS: fornitore vede/modifica solo le proprie price-list
drop policy if exists "scp_select_supplier" on supplier_capostipite_pricing;
create policy "scp_select_supplier" on supplier_capostipite_pricing for select using (
  supplier_id = auth.uid() or capostipite_id = auth.uid() or is_admin()
);

drop policy if exists "scp_modify_supplier" on supplier_capostipite_pricing;
create policy "scp_modify_supplier" on supplier_capostipite_pricing for all
  using (supplier_id = auth.uid())
  with check (supplier_id = auth.uid());

drop policy if exists "scp_admin_all" on supplier_capostipite_pricing;
create policy "scp_admin_all" on supplier_capostipite_pricing for all
  using (is_admin()) with check (is_admin());

-- 3. RPC: il fornitore invita un capostipite (lookup per email) ----------
create or replace function supplier_invite_capostipite(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid := auth.uid();
  v_capo_user uuid;
  v_capo_profile record;
  v_existing record;
  v_collab_id uuid;
begin
  if v_supplier is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  -- Verifica che il chiamante sia un FORNITORE
  if not exists (select 1 from profiles where id = v_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'only_fornitore_can_invite');
  end if;

  -- Lookup capostipite per email
  select id into v_capo_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_capo_user is null then
    return jsonb_build_object('error', 'capostipite_non_trovato',
      'detail', 'Nessun account Planfully con questa email. Chiedi al/la wedding planner di registrarsi prima.');
  end if;

  select * into v_capo_profile from profiles where id = v_capo_user;
  if v_capo_profile.role not in ('WEDDING_PLANNER', 'LOCATION', 'ADMIN') then
    return jsonb_build_object('error', 'non_e_capostipite',
      'detail', 'L''account trovato non e un wedding planner o location.');
  end if;

  if v_capo_user = v_supplier then
    return jsonb_build_object('error', 'self_invite');
  end if;

  -- Esiste gia collab?
  select * into v_existing from collaborations
   where fornitore_id = v_supplier and capostipite_id = v_capo_user
   limit 1;
  if v_existing.id is not null then
    if v_existing.status = 'ACTIVE' then
      return jsonb_build_object('error', 'gia_collaborano', 'collaboration_id', v_existing.id);
    end if;
    -- Riaperto: torna a PENDING
    update collaborations
       set status = 'PENDING', initiated_by = 'FORNITORE', updated_at = now()
     where id = v_existing.id;
    return jsonb_build_object('ok', true, 'collaboration_id', v_existing.id, 'mode', 'reopened');
  end if;

  -- Crea collab PENDING
  insert into collaborations (capostipite_id, fornitore_id, status, initiated_by)
    values (v_capo_user, v_supplier, 'PENDING', 'FORNITORE')
    returning id into v_collab_id;

  return jsonb_build_object('ok', true, 'collaboration_id', v_collab_id,
    'capostipite_name', coalesce(v_capo_profile.business_name, v_capo_profile.full_name));
end$$;

grant execute on function supplier_invite_capostipite(text) to authenticated;

comment on function supplier_invite_capostipite(text) is
  'Permette al fornitore (auth.uid()) di creare una richiesta di collaborazione PENDING verso un WP/LOCATION esistente identificato per email. Il capostipite la accetta dalla sua pagina /suppliers.';
