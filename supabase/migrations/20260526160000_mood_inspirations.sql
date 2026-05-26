-- ============================================================================
-- MOOD INSPIRATIONS — link Pinterest / Instagram refs / mood words / note libere
-- raccolti durante il questionario su /p/accept (flusso capostipite, ovvero
-- WP/Location). Una row per categoria (fotografo, fioraio, ...). Si affiancano
-- a mood_images (immagini caricate) per costruire la moodboard del cliente.
-- ============================================================================

create table if not exists mood_inspirations (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  category        text not null,
  pinterest_url   text,
  instagram_refs  text[] not null default '{}',
  mood_words      text[] not null default '{}',
  free_notes      text,
  source          text not null default 'questionario',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_mood_insp_entry on mood_inspirations(entry_id, category);
create index if not exists idx_mood_insp_quote on mood_inspirations(quote_id);

alter table mood_inspirations enable row level security;

-- Owner del calendar_entry (WP/Location) può vedere/modificare
drop policy if exists "mood_insp_owner_all" on mood_inspirations;
create policy "mood_insp_owner_all" on mood_inspirations for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Couple linkata può inserire/aggiornare/cancellare le proprie ispirazioni
drop policy if exists "mood_insp_couple_select" on mood_inspirations;
create policy "mood_insp_couple_select" on mood_inspirations for select using (
  exists (
    select 1 from wedding_couple_members wcm
    where wcm.entry_id = mood_inspirations.entry_id
      and wcm.user_id = auth.uid()
  )
);
drop policy if exists "mood_insp_couple_modify" on mood_inspirations;
create policy "mood_insp_couple_modify" on mood_inspirations for all using (
  exists (
    select 1 from wedding_couple_members wcm
    where wcm.entry_id = mood_inspirations.entry_id
      and wcm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from wedding_couple_members wcm
    where wcm.entry_id = mood_inspirations.entry_id
      and wcm.user_id = auth.uid()
  )
);

drop policy if exists "mood_insp_admin_all" on mood_inspirations;
create policy "mood_insp_admin_all" on mood_inspirations for all
  using (is_admin()) with check (is_admin());

-- ============================================================================
-- RPC: save_quote_inspirations — salva (upsert) ispirazioni per categoria
-- chiamata da /p/accept via access_token (anon-safe come quote_questionnaire_submit).
-- p_inspirations: { fotografo: { pinterest_url, instagram_refs[], mood_words[], free_notes }, ... }
-- ============================================================================
create or replace function save_quote_inspirations(p_token uuid, p_inspirations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_entry_id uuid;
  v_count int := 0;
  v_cat text;
  v_data jsonb;
begin
  select id into v_quote_id from quotes where access_token = p_token limit 1;
  if v_quote_id is null then
    return jsonb_build_object('error', 'token_invalid');
  end if;

  select id into v_entry_id from calendar_entries where quote_id = v_quote_id limit 1;
  if v_entry_id is null then
    return jsonb_build_object('error', 'entry_missing');
  end if;

  for v_cat, v_data in select * from jsonb_each(coalesce(p_inspirations, '{}'::jsonb)) loop
    -- Salta categorie senza alcun contenuto utile
    if coalesce(v_data->>'pinterest_url','') = ''
       and coalesce(v_data->>'free_notes','') = ''
       and (v_data->'instagram_refs' is null or jsonb_array_length(coalesce(v_data->'instagram_refs','[]'::jsonb)) = 0)
       and (v_data->'mood_words' is null or jsonb_array_length(coalesce(v_data->'mood_words','[]'::jsonb)) = 0)
    then
      continue;
    end if;

    -- Upsert manuale per categoria (entry + category)
    update mood_inspirations
       set pinterest_url  = nullif(v_data->>'pinterest_url', ''),
           instagram_refs = coalesce(
             (select array_agg(value::text) from jsonb_array_elements_text(v_data->'instagram_refs')),
             '{}'::text[]
           ),
           mood_words     = coalesce(
             (select array_agg(value::text) from jsonb_array_elements_text(v_data->'mood_words')),
             '{}'::text[]
           ),
           free_notes     = nullif(v_data->>'free_notes', ''),
           updated_at     = now()
     where entry_id = v_entry_id and category = v_cat;

    if not found then
      insert into mood_inspirations (entry_id, quote_id, category, pinterest_url, instagram_refs, mood_words, free_notes, source)
      values (
        v_entry_id, v_quote_id, v_cat,
        nullif(v_data->>'pinterest_url', ''),
        coalesce(
          (select array_agg(value::text) from jsonb_array_elements_text(v_data->'instagram_refs')),
          '{}'::text[]
        ),
        coalesce(
          (select array_agg(value::text) from jsonb_array_elements_text(v_data->'mood_words')),
          '{}'::text[]
        ),
        nullif(v_data->>'free_notes', ''),
        'questionario'
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_count, 'entry_id', v_entry_id);
end$$;

grant execute on function save_quote_inspirations(uuid, jsonb) to anon, authenticated;

comment on table mood_inspirations is
  'Link Pinterest, IG refs, mood words e note libere raccolte dal questionario su /p/accept per categoria (fotografo, fioraio, ...). Visibili dal couple loggato e dal WP/Location owner. Base per la moodboard futura.';
