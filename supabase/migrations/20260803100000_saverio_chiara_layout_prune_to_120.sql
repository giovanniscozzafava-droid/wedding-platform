-- Riconciliazione LAYOUT album "Saverio e Chiara" (entry e9f79dd7-e73c-4391-9a65-7f57750e7179).
-- Stato: la selezione e' gia' corretta (pick_photographer = 120 = album_choice 'KEPT', fix 20260801120000).
-- MA le tavole (album_projects.layout) trascinavano ancora 179 foto piazzate, di cui 91 FUORI dalle 120
-- (residuo della vecchia selezione da 269). L'impaginatore mostra tutte le piazzate + il cassetto dei
-- KEPT non piazzati ⇒ il fotografo vedeva 179 piazzate + 32 in libreria = 211 foto.
--
-- Qui ripuliamo il layout: da ogni pagina togliamo SOLO gli elementi la cui foto non e' tra le 120.
-- - le 88 foto che coincidono restano dove sono (arrangiamento delle tavole INTATTO);
-- - le 91 fuori-selezione spariscono dalle tavole;
-- - le 32 delle 120 non ancora piazzate restano nel cassetto/libreria, pronte da posizionare.
-- Le pagine NON vengono eliminate (anche se restano vuote): non spostiamo nulla di cio' che il
-- fotografo ha gia' composto; eventuali pagine vuote le rimuove lui a mano.
-- Elementi senza 'mediaId' (testo/decori/sfondi) vengono sempre conservati.

with kept as (
  select id from public.gallery_media
  where entry_id = 'e9f79dd7-e73c-4391-9a65-7f57750e7179' and pick_photographer
),
proj as (
  select layout from public.album_projects where entry_id = 'e9f79dd7-e73c-4391-9a65-7f57750e7179'
),
newpages as (
  select coalesce(jsonb_agg(
    case when pg ? 'elements'
      then jsonb_set(pg, '{elements}', coalesce((
        select jsonb_agg(elem)
        from jsonb_array_elements(pg->'elements') elem
        where not (elem ? 'mediaId')
           or (elem->>'mediaId') = ''
           or (elem->>'mediaId')::uuid in (select id from kept)
      ), '[]'::jsonb))
      else pg
    end
    order by ord
  ), '[]'::jsonb) as pages
  from proj, lateral jsonb_array_elements(layout->'pages') with ordinality as t(pg, ord)
)
update public.album_projects ap
   set layout = jsonb_set(ap.layout, '{pages}', (select pages from newpages))
 where ap.entry_id = 'e9f79dd7-e73c-4391-9a65-7f57750e7179';
