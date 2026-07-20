-- ============================================================================
-- ACCENDE le email server-side senza privilegi superuser.
--
-- Diagnosi (20/07/2026): le GUC app.supabase_url / app.functions_anon_key non erano
-- MAI configurate in prod (verificato nel contesto PostgREST). Ogni hook net.http_post
-- + notify_guc_ready saltava la POST → solo notifica in-app, mai email. "Neanche una
-- mail" per Daisy, e per ogni nuovo lead.
--
-- ALTER DATABASE/ROLE SET richiede superuser → permission denied per il migration role
-- su Supabase gestito. Soluzione senza privilegi: config in tabella + iniezione via
-- set_config(...,true) LOCALE alla transazione (permesso a chiunque). notify_guc_ready
-- è chiamato da ogni hook PRIMA di leggere le GUC → se lì facciamo set_config, il
-- current_setting successivo (stessa transazione) trova il valore. Zero modifiche agli hook.
-- ============================================================================

create table if not exists public.notify_config (
  id        boolean primary key default true check (id),   -- riga unica
  base_url  text not null,   -- es. https://<ref>.supabase.co/functions/v1
  anon_key  text not null,   -- ANON key (pubblica); popolata via API, non in git
  updated_at timestamptz not null default now()
);
alter table public.notify_config enable row level security;
-- Nessuna policy: solo le funzioni SECURITY DEFINER (che bypassano RLS) la leggono.

-- Carica la config nelle GUC di sessione (locale alla transazione). Ritorna true se c'è.
create or replace function public._notify_load_config()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  select base_url, anon_key into v_url, v_key from public.notify_config where id;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return false;
  end if;
  perform set_config('app.supabase_url', v_url, true);
  perform set_config('app.functions_anon_key', v_key, true);
  return true;
end$$;

-- notify_guc_ready ora si appoggia alla tabella (oltre alle GUC di sistema, se un domani
-- venissero settate). Effetto: lead-notify e circle-notify tornano a mandare email.
create or replace function public.notify_guc_ready(p_hook text, p_entity uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public._notify_load_config() then
    return true;
  end if;
  -- fallback: GUC di sistema già settate (deploy che le avesse configurate a mano)
  if coalesce(current_setting('app.supabase_url', true),'') <> ''
     and coalesce(current_setting('app.functions_anon_key', true),'') <> ''
     and current_setting('app.supabase_url', true) not like 'http://kong:%' then
    return true;
  end if;
  insert into public.notification_dispatch_failures(hook, entity_id, reason)
  values (p_hook, p_entity, 'guc_not_configured');
  return false;
end$$;

-- pulizia: la funzione diagnostica non serve più
drop function if exists public._diag_guc();
