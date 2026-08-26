-- Il fotografo abilita/disabilita il DOWNLOAD per singola cartella, distinto per
-- formato: web (leggero) e alta risoluzione (originali). Vale per sposi/ospiti;
-- il fotografo (owner) scarica sempre tutto. Default: entrambi abilitati
-- (comportamento attuale preservato), il fotografo restringe dove vuole.
alter table public.gallery_folders
  add column if not exists allow_dl_web  boolean not null default true,
  add column if not exists allow_dl_full boolean not null default true;
comment on column public.gallery_folders.allow_dl_web  is 'Consente il download in formato web (leggero) di questa cartella a sposi/ospiti.';
comment on column public.gallery_folders.allow_dl_full is 'Consente il download in alta risoluzione (originali) di questa cartella agli sposi.';
