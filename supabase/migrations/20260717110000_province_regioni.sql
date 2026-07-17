-- Lookup province → regioni. Serve al filtro "raggio di disponibilità" della bacheca
-- maestranze: una maestranza con raggio REGIONE deve comparire solo nelle province della
-- SUA regione (senza questa tabella il filtro è sbagliato e un cameriere di Milano
-- compare cercando a Catanzaro).
-- Dato statico ISTAT: 107 province italiane (comprese le città metropolitane).

create table if not exists public.province_regioni (
  provincia varchar(4) primary key,
  nome      varchar(80) not null,
  regione   varchar(40) not null
);
create index if not exists idx_province_regione on public.province_regioni(regione);

alter table public.province_regioni enable row level security;
drop policy if exists "province_lettura_registrati" on public.province_regioni;
create policy "province_lettura_registrati" on public.province_regioni
  for select to authenticated using (true);

insert into public.province_regioni (provincia, nome, regione) values
  ('AQ','L''Aquila','Abruzzo'), ('CH','Chieti','Abruzzo'), ('PE','Pescara','Abruzzo'), ('TE','Teramo','Abruzzo'),
  ('MT','Matera','Basilicata'), ('PZ','Potenza','Basilicata'),
  ('CS','Cosenza','Calabria'), ('CZ','Catanzaro','Calabria'), ('KR','Crotone','Calabria'),
  ('RC','Reggio Calabria','Calabria'), ('VV','Vibo Valentia','Calabria'),
  ('AV','Avellino','Campania'), ('BN','Benevento','Campania'), ('CE','Caserta','Campania'),
  ('NA','Napoli','Campania'), ('SA','Salerno','Campania'),
  ('BO','Bologna','Emilia-Romagna'), ('FE','Ferrara','Emilia-Romagna'), ('FC','Forlì-Cesena','Emilia-Romagna'),
  ('MO','Modena','Emilia-Romagna'), ('PR','Parma','Emilia-Romagna'), ('PC','Piacenza','Emilia-Romagna'),
  ('RA','Ravenna','Emilia-Romagna'), ('RE','Reggio Emilia','Emilia-Romagna'), ('RN','Rimini','Emilia-Romagna'),
  ('GO','Gorizia','Friuli-Venezia Giulia'), ('PN','Pordenone','Friuli-Venezia Giulia'),
  ('TS','Trieste','Friuli-Venezia Giulia'), ('UD','Udine','Friuli-Venezia Giulia'),
  ('FR','Frosinone','Lazio'), ('LT','Latina','Lazio'), ('RI','Rieti','Lazio'), ('RM','Roma','Lazio'), ('VT','Viterbo','Lazio'),
  ('GE','Genova','Liguria'), ('IM','Imperia','Liguria'), ('SP','La Spezia','Liguria'), ('SV','Savona','Liguria'),
  ('BG','Bergamo','Lombardia'), ('BS','Brescia','Lombardia'), ('CO','Como','Lombardia'), ('CR','Cremona','Lombardia'),
  ('LC','Lecco','Lombardia'), ('LO','Lodi','Lombardia'), ('MN','Mantova','Lombardia'), ('MI','Milano','Lombardia'),
  ('MB','Monza e Brianza','Lombardia'), ('PV','Pavia','Lombardia'), ('SO','Sondrio','Lombardia'), ('VA','Varese','Lombardia'),
  ('AN','Ancona','Marche'), ('AP','Ascoli Piceno','Marche'), ('FM','Fermo','Marche'),
  ('MC','Macerata','Marche'), ('PU','Pesaro e Urbino','Marche'),
  ('CB','Campobasso','Molise'), ('IS','Isernia','Molise'),
  ('AL','Alessandria','Piemonte'), ('AT','Asti','Piemonte'), ('BI','Biella','Piemonte'), ('CN','Cuneo','Piemonte'),
  ('NO','Novara','Piemonte'), ('TO','Torino','Piemonte'), ('VB','Verbano-Cusio-Ossola','Piemonte'), ('VC','Vercelli','Piemonte'),
  ('BA','Bari','Puglia'), ('BT','Barletta-Andria-Trani','Puglia'), ('BR','Brindisi','Puglia'),
  ('FG','Foggia','Puglia'), ('LE','Lecce','Puglia'), ('TA','Taranto','Puglia'),
  ('CA','Cagliari','Sardegna'), ('NU','Nuoro','Sardegna'), ('OR','Oristano','Sardegna'),
  ('SS','Sassari','Sardegna'), ('SU','Sud Sardegna','Sardegna'),
  ('AG','Agrigento','Sicilia'), ('CL','Caltanissetta','Sicilia'), ('CT','Catania','Sicilia'), ('EN','Enna','Sicilia'),
  ('ME','Messina','Sicilia'), ('PA','Palermo','Sicilia'), ('RG','Ragusa','Sicilia'), ('SR','Siracusa','Sicilia'), ('TP','Trapani','Sicilia'),
  ('AR','Arezzo','Toscana'), ('FI','Firenze','Toscana'), ('GR','Grosseto','Toscana'), ('LI','Livorno','Toscana'),
  ('LU','Lucca','Toscana'), ('MS','Massa-Carrara','Toscana'), ('PI','Pisa','Toscana'), ('PT','Pistoia','Toscana'),
  ('PO','Prato','Toscana'), ('SI','Siena','Toscana'),
  ('BZ','Bolzano','Trentino-Alto Adige'), ('TN','Trento','Trentino-Alto Adige'),
  ('PG','Perugia','Umbria'), ('TR','Terni','Umbria'),
  ('AO','Aosta','Valle d''Aosta'),
  ('BL','Belluno','Veneto'), ('PD','Padova','Veneto'), ('RO','Rovigo','Veneto'), ('TV','Treviso','Veneto'),
  ('VE','Venezia','Veneto'), ('VR','Verona','Veneto'), ('VI','Vicenza','Veneto')
on conflict (provincia) do nothing;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.province_regioni;
  raise notice 'province_regioni: % righe (attese 107)', v_n;
end $$;
