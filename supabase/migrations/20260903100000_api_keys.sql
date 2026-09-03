-- «Come possiamo creare un'API che si connette con altri agenti e altri miei
--  progetti?» (Giovanni, 02/09/2026).
--
-- Fondamenta: la CHIAVE API. Un professionista se ne crea una dalle impostazioni,
-- la dà a un agente (Claude, Skorpio, uno script) e quello parla con Planfully
-- come se fosse lui: stesse RLS, stesse RPC, stessi limiti. Niente da riscrivere.
--
-- Come funziona:
--   * la chiave in chiaro (pf_live_…) si vede UNA volta, alla creazione; qui resta
--     solo lo sha256. Se la perdi ne fai un'altra, come su Stripe.
--   * scope: read (solo letture) / write (anche scritture). L'edge api-v1 li applica.
--   * api_calls: ogni chiamata lascia una riga (chi, cosa, quanto ci ha messo) →
--     rate limit per chiave e, domani, una scheda "cosa stanno facendo i miei agenti".

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  prefix       text not null,                      -- 'pf_live_a1b2c3d4' per riconoscerla in lista
  key_hash     text not null unique,               -- sha256 hex della chiave in chiaro
  scopes       text[] not null default '{read}',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  constraint api_keys_scopes_chk check (scopes <@ array['read','write']::text[] and cardinality(scopes) > 0)
);
create index if not exists api_keys_owner_idx on public.api_keys (owner_id, created_at desc);
comment on table public.api_keys is 'Chiavi API dei professionisti (pf_live_…): in chiaro mai, solo sha256. Le usa l''edge api-v1.';

create table if not exists public.api_calls (
  id        bigserial primary key,
  key_id    uuid references public.api_keys(id) on delete cascade,
  owner_id  uuid not null,
  method    text not null,
  path      text not null,
  status    int  not null,
  ms        int,
  at        timestamptz not null default now()
);
create index if not exists api_calls_key_at_idx on public.api_calls (key_id, at desc);
create index if not exists api_calls_owner_at_idx on public.api_calls (owner_id, at desc);
comment on table public.api_calls is 'Registro chiamate API v1: una riga per richiesta. Serve al rate limit e alla scheda attività.';

alter table public.api_keys  enable row level security;
alter table public.api_calls enable row level security;
-- Nessuna policy: si passa SOLO dalle RPC qui sotto. Il service_role (edge) bypassa RLS.

-- Crea una chiave. Torna la chiave in chiaro: è l'unica volta che esiste fuori dal
-- browser di chi l'ha chiesta.
create or replace function public.api_key_create(p_name text, p_scopes text[] default '{read}')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_key text; v_id uuid; v_name text; v_scopes text[];
  v_role text;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  select role::text into v_role from profiles where id = v_uid;
  if v_role not in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN') then
    return jsonb_build_object('error','forbidden');
  end if;
  v_name := left(coalesce(nullif(trim(p_name), ''), 'Chiave'), 60);
  v_scopes := (select array_agg(distinct s) from unnest(coalesce(p_scopes, '{read}')) s where s in ('read','write'));
  if v_scopes is null or cardinality(v_scopes) = 0 then v_scopes := '{read}'; end if;
  -- write implica read: una chiave che scrive deve poter anche leggere.
  if 'write' = any(v_scopes) and not ('read' = any(v_scopes)) then v_scopes := v_scopes || '{read}'; end if;
  if (select count(*) from api_keys where owner_id = v_uid and revoked_at is null) >= 10 then
    return jsonb_build_object('error','too_many');
  end if;

  v_key := 'pf_live_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into api_keys (owner_id, name, prefix, key_hash, scopes)
  values (v_uid, v_name, left(v_key, 16), encode(extensions.digest(v_key, 'sha256'), 'hex'), v_scopes)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'key', v_key, 'prefix', left(v_key, 16),
                            'name', v_name, 'scopes', to_jsonb(v_scopes));
end$$;

create or replace function public.api_keys_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', k.id, 'name', k.name, 'prefix', k.prefix, 'scopes', to_jsonb(k.scopes),
           'created_at', k.created_at, 'last_used_at', k.last_used_at, 'revoked_at', k.revoked_at,
           'calls_30d', (select count(*) from api_calls c where c.key_id = k.id and c.at > now() - interval '30 days'))
         order by k.created_at desc), '[]'::jsonb)
    from api_keys k where k.owner_id = auth.uid();
$$;

create or replace function public.api_key_revoke(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update api_keys set revoked_at = now()
   where id = p_id and owner_id = auth.uid() and revoked_at is null;
  if not found then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true);
end$$;

-- Ultime chiamate del professionista: la scheda "cosa hanno fatto i miei agenti".
create or replace function public.api_calls_recent(p_limit integer default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'at', c.at, 'method', c.method, 'path', c.path, 'status', c.status, 'ms', c.ms,
           'key', (select k.name from api_keys k where k.id = c.key_id))
         order by c.at desc), '[]'::jsonb)
    from (select * from api_calls where owner_id = auth.uid()
           order by at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) c;
$$;

-- Per l'EDGE (service_role): dallo sha256 alla chiave. Torna owner, scope e quante
-- chiamate ha fatto nell'ultimo minuto (per il rate limit). Timbra last_used_at.
create or replace function public.api_key_resolve(p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_k record; v_min int;
begin
  select id, owner_id, scopes, revoked_at into v_k from api_keys where key_hash = p_hash;
  if v_k.id is null then return jsonb_build_object('error','invalid_key'); end if;
  if v_k.revoked_at is not null then return jsonb_build_object('error','revoked'); end if;
  select count(*) into v_min from api_calls where key_id = v_k.id and at > now() - interval '1 minute';
  update api_keys set last_used_at = now() where id = v_k.id
     and (last_used_at is null or last_used_at < now() - interval '1 minute');
  return jsonb_build_object('ok', true, 'key_id', v_k.id, 'owner_id', v_k.owner_id,
                            'scopes', to_jsonb(v_k.scopes), 'last_minute', v_min);
end$$;

create or replace function public.api_call_log(p_key uuid, p_owner uuid, p_method text, p_path text, p_status int, p_ms int)
returns void language sql security definer set search_path = public as $$
  insert into api_calls (key_id, owner_id, method, path, status, ms)
  values (p_key, p_owner, left(p_method, 10), left(p_path, 300), p_status, p_ms);
$$;

revoke all on function public.api_key_create(text, text[]) from public;
revoke all on function public.api_keys_list() from public;
revoke all on function public.api_key_revoke(uuid) from public;
revoke all on function public.api_calls_recent(integer) from public;
revoke all on function public.api_key_resolve(text) from public;
revoke all on function public.api_call_log(uuid, uuid, text, text, int, int) from public;
grant execute on function public.api_key_create(text, text[]) to authenticated;
grant execute on function public.api_keys_list() to authenticated;
grant execute on function public.api_key_revoke(uuid) to authenticated;
grant execute on function public.api_calls_recent(integer) to authenticated;
grant execute on function public.api_key_resolve(text) to service_role;
grant execute on function public.api_call_log(uuid, uuid, text, text, int, int) to service_role;
