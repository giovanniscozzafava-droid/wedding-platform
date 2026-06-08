-- ============================================================================
-- FINANCE (Admin): cassetto + costi piattaforma + balance con reportistica.
-- Un'unica tabella movimenti (IN = entrate/cassetto, OUT = costi), una tantum o
-- ricorrenti. Ricavi automatici dalle commissioni referral. Tutto gated admin.
-- ============================================================================
create table if not exists public.platform_finance_entries (
  id          uuid primary key default gen_random_uuid(),
  direction   text not null check (direction in ('IN','OUT')),
  category    text,
  label       text not null,
  amount      numeric(12,2) not null check (amount >= 0),
  recurrence  text not null default 'UNA_TANTUM' check (recurrence in ('UNA_TANTUM','MENSILE','ANNUALE')),
  entry_date  date not null default current_date,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_finance_entries_date on public.platform_finance_entries(entry_date);
drop trigger if exists trg_finance_entries_upd on public.platform_finance_entries;
create trigger trg_finance_entries_upd before update on public.platform_finance_entries
  for each row execute function set_updated_at();

alter table public.platform_finance_entries enable row level security;
drop policy if exists "finance_entries_admin" on public.platform_finance_entries;
create policy "finance_entries_admin" on public.platform_finance_entries
  for all using (public.is_support_staff()) with check (public.is_support_staff());

-- ---- Lista / CRUD ----------------------------------------------------------
create or replace function public.admin_finance_entries(p_direction text default null)
returns setof public.platform_finance_entries
language sql stable security definer set search_path = public as $$
  select * from public.platform_finance_entries
   where public.is_support_staff()
     and (p_direction is null or direction = p_direction)
   order by entry_date desc, created_at desc;
$$;
grant execute on function public.admin_finance_entries(text) to authenticated;

create or replace function public.admin_finance_entry_add(
  p_direction text, p_label text, p_amount numeric, p_category text default null,
  p_recurrence text default 'UNA_TANTUM', p_entry_date date default current_date, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_support_staff() then return jsonb_build_object('error','forbidden'); end if;
  insert into public.platform_finance_entries(direction, label, amount, category, recurrence, entry_date, notes, created_by)
  values (p_direction, p_label, p_amount, p_category, coalesce(p_recurrence,'UNA_TANTUM'), coalesce(p_entry_date, current_date), p_notes, auth.uid())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.admin_finance_entry_add(text,text,numeric,text,text,date,text) to authenticated;

create or replace function public.admin_finance_entry_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_support_staff() then return jsonb_build_object('error','forbidden'); end if;
  delete from public.platform_finance_entries where id = p_id;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.admin_finance_entry_delete(uuid) to authenticated;

-- ---- Overview: cassetto, ricorrenti, commissioni, utenti, proiezioni -------
create or replace function public.admin_finance_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_in_once numeric; v_out_once numeric;
  v_in_rec numeric;  v_out_rec numeric;        -- normalizzati al MESE
  v_comm_tot numeric; v_comm_settled numeric;
  v_users jsonb; v_subs jsonb; v_forn int;
begin
  if not public.is_support_staff() then return jsonb_build_object('error','forbidden'); end if;

  select coalesce(sum(amount) filter (where direction='IN'  and recurrence='UNA_TANTUM' and entry_date<=current_date),0),
         coalesce(sum(amount) filter (where direction='OUT' and recurrence='UNA_TANTUM' and entry_date<=current_date),0),
         coalesce(sum(case recurrence when 'MENSILE' then amount when 'ANNUALE' then amount/12 else 0 end) filter (where direction='IN'),0),
         coalesce(sum(case recurrence when 'MENSILE' then amount when 'ANNUALE' then amount/12 else 0 end) filter (where direction='OUT'),0)
    into v_in_once, v_out_once, v_in_rec, v_out_rec
    from public.platform_finance_entries;

  select coalesce(sum(platform_commission),0),
         coalesce(sum(platform_commission) filter (where status='SETTLED'),0)
    into v_comm_tot, v_comm_settled
    from public.supplier_credits;

  select coalesce(jsonb_object_agg(role, n),'{}'::jsonb) into v_users
    from (select role, count(*) n from public.profiles group by role) t;
  select coalesce(jsonb_object_agg(coalesce(subscription_status,'?'), n),'{}'::jsonb) into v_subs
    from (select subscription_status, count(*) n from public.profiles group by subscription_status) t;
  select count(*) into v_forn from public.profiles where role='FORNITORE';

  return jsonb_build_object(
    'cassetto',            v_in_once + v_comm_settled - v_out_once,
    'entrate_una_tantum',  v_in_once,
    'costi_una_tantum',    v_out_once,
    'entrate_ricorrenti_mese', v_in_rec,
    'costi_ricorrenti_mese',   v_out_rec,
    'netto_ricorrente_mese',   v_in_rec - v_out_rec,
    'commissioni_totali',  v_comm_tot,
    'commissioni_incassate', v_comm_settled,
    'commissioni_da_incassare', v_comm_tot - v_comm_settled,
    'users_by_role',       v_users,
    'subs_by_status',      v_subs,
    'fornitori_totali',    v_forn
  );
end$$;
grant execute on function public.admin_finance_overview() to authenticated;

-- ---- Report mensile: IN/OUT per mese (ultimi N mesi) -----------------------
create or replace function public.admin_finance_monthly(p_months int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not public.is_support_staff() then return jsonb_build_object('error','forbidden'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'mese', to_char(m, 'YYYY-MM'),
           'entrate', coalesce((select sum(amount) from public.platform_finance_entries e
                                 where e.direction='IN' and date_trunc('month',e.entry_date)=m),0)
                      + coalesce((select sum(platform_commission) from public.supplier_credits c
                                   where c.status='SETTLED' and date_trunc('month',c.settled_at)=m),0),
           'costi',   coalesce((select sum(amount) from public.platform_finance_entries e
                                 where e.direction='OUT' and date_trunc('month',e.entry_date)=m),0)
         ) order by m), '[]'::jsonb)
    into v_res
  from generate_series(date_trunc('month', current_date) - ((p_months-1) || ' months')::interval,
                       date_trunc('month', current_date), interval '1 month') m;
  return jsonb_build_object('ok', true, 'months', v_res);
end$$;
grant execute on function public.admin_finance_monthly(int) to authenticated;
