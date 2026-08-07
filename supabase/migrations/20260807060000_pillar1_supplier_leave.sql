-- ════════════════════════════════════════════════════════════════════════════
-- PILASTRO 1 — CONSENSO FORNITORE (decisione: "avvisato, può togliersi").
-- Increment 1: il fornitore può USCIRE da una collaborazione dall'app.
-- Finora "REVOKED" era solo un colore in UI: nessun self-service per il fornitore
-- (JB-23). Le scritture su collaborations sono lato capostipite/admin; serve una
-- RPC SECURITY DEFINER che permetta al FORNITORE di revocare la PROPRIA riga.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.supplier_leave_collaboration(p_capostipite_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  update public.collaborations
     set status = 'REVOKED', revoked_at = now(), updated_at = now()
   where capostipite_id = p_capostipite_id
     and fornitore_id = v_uid
     and status <> 'REVOKED';

  if not found then
    return jsonb_build_object('error','not_found');
  end if;
  return jsonb_build_object('ok', true);
end$$;

grant execute on function public.supplier_leave_collaboration(uuid) to authenticated;
