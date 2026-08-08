-- ============================================================================
-- "Disimporta" un servizio: quando il professionista importa un pacchetto di
-- servizi-tipo (servizio_template) nel proprio catalogo, alcune voci potrebbero
-- non interessargli. Per distinguerle dai servizi creati a mano e offrire un
-- "Disimporta" mirato, tracciamo la provenienza con imported_template_id.
-- NULL = servizio creato a mano; valorizzato = importato da un template.
-- ============================================================================

alter table public.services
  add column if not exists imported_template_id uuid
    references public.servizio_template(id) on delete set null;

comment on column public.services.imported_template_id is
  'Template di origine se il servizio è stato importato (PackImportPicker). NULL = creato a mano.';
