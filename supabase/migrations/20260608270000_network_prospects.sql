-- ============================================================================
-- RECRUITING CRM per capostipiti (WP/Location)
-- ----------------------------------------------------------------------------
-- La WP costruisce la rete contattando professionisti e facendoli iscrivere.
-- Qui tiene la LISTA dei contatti, lo STATO (da contattare → contattato →
-- richiamare → appuntamento → iscritto), il RICHIAMO (recall) e l'APPUNTAMENTO,
-- e registra ogni interazione (chiamata, email, whatsapp, nota). Quando il
-- prospect si iscrive col suo codice invito, si collega al profilo creato.
-- ============================================================================

create table if not exists public.network_prospects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  business_name text,
  subrole       text,                       -- tipo professionista (fotografo, fioraio, ...)
  phone         text,
  email         text,
  city          text,
  status        text not null default 'DA_CONTATTARE'
                check (status in ('DA_CONTATTARE','CONTATTATO','RICHIAMARE','APPUNTAMENTO','ISCRITTO','NON_INTERESSATO')),
  recall_at     timestamptz,                -- prossimo richiamo
  appointment_at timestamptz,              -- appuntamento fissato
  notes         text,
  last_contacted_at timestamptz,
  source        text,
  registered_profile_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_np_owner_status on public.network_prospects(owner_id, status);
create index if not exists idx_np_owner_recall on public.network_prospects(owner_id, recall_at);

drop trigger if exists trg_np_upd on public.network_prospects;
create trigger trg_np_upd before update on public.network_prospects
  for each row execute function public.set_updated_at();

-- Log interazioni (storico chiamate/contatti)
create table if not exists public.network_prospect_logs (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.network_prospects(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('CHIAMATA','EMAIL','WHATSAPP','APPUNTAMENTO','NOTA')),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_npl_prospect on public.network_prospect_logs(prospect_id, created_at desc);

alter table public.network_prospects      enable row level security;
alter table public.network_prospect_logs  enable row level security;

drop policy if exists "np_owner_all" on public.network_prospects;
create policy "np_owner_all" on public.network_prospects
  for all using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());

drop policy if exists "npl_owner_all" on public.network_prospect_logs;
create policy "npl_owner_all" on public.network_prospect_logs
  for all using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());

-- ── Lista prospect dell'owner, con gli ultimi log e i contatori ─────────────
create or replace function public.network_prospects_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows jsonb; v_counts jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id, 'name', p.name, 'business_name', p.business_name, 'subrole', p.subrole,
             'phone', p.phone, 'email', p.email, 'city', p.city, 'status', p.status,
             'recall_at', p.recall_at, 'appointment_at', p.appointment_at, 'notes', p.notes,
             'last_contacted_at', p.last_contacted_at, 'source', p.source,
             'registered_profile_id', p.registered_profile_id, 'created_at', p.created_at,
             'logs', (
               select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'kind',l.kind,'note',l.note,'created_at',l.created_at)
                                order by l.created_at desc), '[]'::jsonb)
               from public.network_prospect_logs l where l.prospect_id = p.id
             )
           )
           -- prima i richiami scaduti, poi i più imminenti
           order by (p.recall_at is not null and p.recall_at <= now()) desc,
                    coalesce(p.recall_at, p.appointment_at, p.created_at) asc
         ), '[]'::jsonb)
    into v_rows
  from public.network_prospects p where p.owner_id = v_uid;

  select jsonb_build_object(
    'totale', count(*),
    'da_contattare', count(*) filter (where status = 'DA_CONTATTARE'),
    'richiami_oggi', count(*) filter (where recall_at is not null and recall_at <= now() and status <> 'ISCRITTO'),
    'iscritti', count(*) filter (where status = 'ISCRITTO')
  ) into v_counts from public.network_prospects where owner_id = v_uid;

  return jsonb_build_object('ok', true, 'prospects', v_rows, 'counts', v_counts);
end$$;
grant execute on function public.network_prospects_list() to authenticated;

-- ── Crea / aggiorna un prospect (whitelist campi) ───────────────────────────
create or replace function public.network_prospect_save(p_id uuid, p_data jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_id is null then
    insert into public.network_prospects(owner_id, name, business_name, subrole, phone, email, city, status, recall_at, appointment_at, notes, source)
    values (
      v_uid,
      coalesce(nullif(p_data->>'name',''), 'Senza nome'),
      nullif(p_data->>'business_name',''),
      nullif(p_data->>'subrole',''),
      nullif(p_data->>'phone',''),
      nullif(p_data->>'email',''),
      nullif(p_data->>'city',''),
      coalesce(nullif(p_data->>'status',''), 'DA_CONTATTARE'),
      nullif(p_data->>'recall_at','')::timestamptz,
      nullif(p_data->>'appointment_at','')::timestamptz,
      nullif(p_data->>'notes',''),
      nullif(p_data->>'source','')
    ) returning id into v_id;
  else
    update public.network_prospects set
      name          = coalesce(nullif(p_data->>'name',''), name),
      business_name = case when p_data ? 'business_name' then nullif(p_data->>'business_name','') else business_name end,
      subrole       = case when p_data ? 'subrole' then nullif(p_data->>'subrole','') else subrole end,
      phone         = case when p_data ? 'phone' then nullif(p_data->>'phone','') else phone end,
      email         = case when p_data ? 'email' then nullif(p_data->>'email','') else email end,
      city          = case when p_data ? 'city' then nullif(p_data->>'city','') else city end,
      status        = case when p_data ? 'status' then coalesce(nullif(p_data->>'status',''), status) else status end,
      recall_at     = case when p_data ? 'recall_at' then nullif(p_data->>'recall_at','')::timestamptz else recall_at end,
      appointment_at= case when p_data ? 'appointment_at' then nullif(p_data->>'appointment_at','')::timestamptz else appointment_at end,
      notes         = case when p_data ? 'notes' then nullif(p_data->>'notes','') else notes end
    where id = p_id and (owner_id = v_uid or is_admin())
    returning id into v_id;
    if v_id is null then return jsonb_build_object('error','not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.network_prospect_save(uuid, jsonb) to authenticated;

-- ── Registra un'interazione (chiamata/email/whatsapp/nota) ───────────────────
-- Aggiorna last_contacted_at e, opzionalmente, stato + prossimo richiamo.
create or replace function public.network_prospect_log(
  p_id uuid, p_kind text, p_note text default null,
  p_status text default null, p_recall_at timestamptz default null, p_appointment_at timestamptz default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_own uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select owner_id into v_own from public.network_prospects where id = p_id;
  if v_own is null then return jsonb_build_object('error','not_found'); end if;
  if v_own <> v_uid and not is_admin() then return jsonb_build_object('error','not_owner'); end if;

  insert into public.network_prospect_logs(prospect_id, owner_id, kind, note)
  values (p_id, v_own, coalesce(nullif(p_kind,''),'NOTA'), nullif(p_note,''));

  update public.network_prospects set
    last_contacted_at = now(),
    status        = coalesce(nullif(p_status,''), status),
    recall_at     = coalesce(p_recall_at, recall_at),
    appointment_at= coalesce(p_appointment_at, appointment_at)
  where id = p_id;

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.network_prospect_log(uuid, text, text, text, timestamptz, timestamptz) to authenticated;

create or replace function public.network_prospect_delete(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  delete from public.network_prospects where id = p_id and (owner_id = v_uid or is_admin());
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.network_prospect_delete(uuid) to authenticated;

comment on table public.network_prospects is
  'Recruiting CRM dei capostipiti: lista professionisti da contattare e far iscrivere, con stato, richiamo, appuntamento e storico interazioni.';
