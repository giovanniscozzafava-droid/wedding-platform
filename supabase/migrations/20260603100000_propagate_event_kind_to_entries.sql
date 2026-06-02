-- ============================================================================
-- BUG: per gli eventi NON matrimonio (festa aziendale, battesimo, ...) il
-- cliente vedeva invito e questionario "da matrimonio". Causa: event_kind è
-- sul preventivo ma NON veniva propagato sulla calendar_entry che il flusso
-- cliente (invito + onboarding) legge → fallback a 'matrimonio'.
-- Fix: backfill + trigger di sincronizzazione + resolve_couple_invite ritorna
-- il tipo evento.
-- ----------------------------------------------------------------------------

-- 1) Backfill: allinea le voci di calendario al tipo evento del loro preventivo.
update public.calendar_entries ce
   set event_kind = q.event_kind
  from public.quotes q
 where ce.quote_id = q.id
   and q.event_kind is not null
   and ce.event_kind is distinct from q.event_kind;

-- 2) Trigger: ad ogni insert/update con quote_id, se manca o diverge, eredita
--    l'event_kind dal preventivo (fonte di verità).
create or replace function public.sync_entry_event_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if new.quote_id is not null then
    select event_kind into v_kind from public.quotes where id = new.quote_id;
    if v_kind is not null then
      new.event_kind := v_kind;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_sync_entry_event_kind on public.calendar_entries;
create trigger trg_sync_entry_event_kind
  before insert or update of quote_id on public.calendar_entries
  for each row execute function public.sync_entry_event_kind();

-- 3) resolve_couple_invite: ritorna anche event_kind (entry → fallback quote).
create or replace function public.resolve_couple_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member public.wedding_couple_members%rowtype;
  v_entry  public.calendar_entries%rowtype;
  v_owner  public.profiles%rowtype;
  v_kind   text;
begin
  select * into v_member from public.wedding_couple_members
    where invite_token = p_token and user_id is null
    limit 1;
  if not found then
    return jsonb_build_object('error', 'invito non valido o gia` accettato');
  end if;

  select * into v_entry from public.calendar_entries where id = v_member.entry_id;
  if not found then
    return jsonb_build_object('error', 'evento non trovato');
  end if;

  select * into v_owner from public.profiles where id = v_entry.owner_id;

  v_kind := v_entry.event_kind;
  if v_kind is null and v_entry.quote_id is not null then
    select event_kind into v_kind from public.quotes where id = v_entry.quote_id;
  end if;
  v_kind := coalesce(v_kind, 'matrimonio');

  return jsonb_build_object(
    'email', v_member.email,
    'full_name', v_member.full_name,
    'role', v_member.role,
    'wedding_title', v_entry.title,
    'wedding_date', v_entry.date_from,
    'planner_name', coalesce(v_owner.business_name, v_owner.full_name),
    'event_kind', v_kind
  );
end$$;

grant execute on function public.resolve_couple_invite(uuid) to anon, authenticated;
