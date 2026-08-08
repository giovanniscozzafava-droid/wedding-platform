-- Consenso del FORNITORE alla modifica di una sua voce di catalogo da parte del CAPOSTIPITE.
-- Di default NO: il capostipite può solo vedere. Se il fornitore mette la spunta su una voce,
-- un capostipite con collaborazione ATTIVA può modificarla. (Richiesta prodotto: "a meno che sia
-- il professionista a sceglierlo con una spunta, il capostipite non modifica la voce del catalogo".)
alter table public.services
  add column if not exists capostipite_can_edit boolean not null default false;
comment on column public.services.capostipite_can_edit is
  'Se true, un capostipite con collaborazione ATTIVA col fornitore può modificare questa voce (consenso esplicito del fornitore).';

-- Policy UPDATE aggiuntiva (permissive): oltre al proprietario, può aggiornare la voce anche il
-- capostipite in collaborazione attiva SE il fornitore l'ha consentito. Il WITH CHECK impedisce al
-- capostipite di spegnere il consenso o di riassegnare la voce a un fornitore con cui non collabora.
drop policy if exists "services_update_consented_capostipite" on public.services;
create policy "services_update_consented_capostipite" on public.services
  for update
  using (capostipite_can_edit = true and has_active_collab_with_supplier(fornitore_id))
  with check (capostipite_can_edit = true and has_active_collab_with_supplier(fornitore_id));
