-- Fix: ON CONFLICT (event_id, collaborator_id) richiede un vincolo UNIQUE vero,
-- non un indice parziale. Sostituiamo l'indice parziale con una unique constraint
-- regolare (i NULL restano distinti, quindi le righe a member_id non confliggono).
drop index if exists uq_assign_event_collaborator;
alter table public.supplier_team_assignments
  drop constraint if exists supplier_team_assignments_event_collab_key;
alter table public.supplier_team_assignments
  add constraint supplier_team_assignments_event_collab_key unique (event_id, collaborator_id);
