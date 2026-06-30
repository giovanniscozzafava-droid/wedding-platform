-- Offerta reale Tenuta delle Grazie (dedotta dal web): uliveti/mulino/casale, sala 200 + winter
-- garden ~250, chef stellato Michelin, cucina calabrese rivisitata, cerimonie/ricevimenti/aziendali.
-- Sostituisce i servizi demo con quelli reali.
do $$
declare pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34';
  c_sala uuid := '11111111-0000-0000-0000-000000000030';
  c_allest uuid := '11111111-0000-0000-0000-000000000031';
  c_aper uuid := '11111111-0000-0000-0000-000000000032';
  c_cena uuid := '11111111-0000-0000-0000-000000000033';
begin
  delete from public.services where fornitore_id = pid;
  insert into public.services(fornitore_id, category_id, name, description, base_price, unit, is_active, display_order) values
    (pid, c_sala, 'Esclusiva Tenuta intera giornata', 'Uso esclusivo della tenuta tra gli antichi uliveti: mulino storico, casale in pietra e canale d''acqua.', 4500, 'EVENTO', true, 1),
    (pid, c_sala, 'Sala grande (fino a 200 ospiti)', 'Sala interna nei toni caldi del legno e del cotto, mise en place elegante.', 0, 'EVENTO', true, 2),
    (pid, c_sala, 'Winter garden / serra (fino a 250)', 'Struttura vetrata ~400 mq, ideale d''inverno o come piano B in caso di pioggia.', 1200, 'EVENTO', true, 3),
    (pid, c_sala, 'Cerimonia simbolica nel giardino degli ulivi', 'Rito simbolico o civile all''aperto, tra gli ulivi secolari.', 900, 'EVENTO', true, 4),
    (pid, c_allest, 'Allestimento floreale e mise en place', 'Composizioni e centrotavola coordinati, allestimento cerimonia e sala.', 2200, 'EVENTO', true, 5),
    (pid, c_allest, 'Tableau, segnaposto e menu stampati', 'Tableau de mariage su legno d''ulivo, segnaposto e menu per ogni tavolo.', 450, 'EVENTO', true, 6),
    (pid, c_allest, 'Illuminazione scenografica del giardino', 'Luci calde tra ulivi e mulino per il dopocena.', 700, 'EVENTO', true, 7),
    (pid, c_aper, 'Aperitivo di benvenuto con isole gourmet', 'Isole di crudo, salumi e formaggi calabresi, frittura e fingerfood dello chef.', 25, 'PERSONA', true, 8),
    (pid, c_aper, 'Open bar e cantina Cirò', 'Cantina calabrese (Cirò DOC) e open bar con cocktail station.', 18, 'PERSONA', true, 9),
    (pid, c_cena, 'Menu degustazione chef stellato', 'Percorso gourmet della cucina calabrese rivisitata dallo chef stellato Michelin.', 120, 'PERSONA', true, 10),
    (pid, c_cena, 'Menu gourmet ridotto (4 portate)', 'Versione essenziale del menu stellato, 4 portate.', 85, 'PERSONA', true, 11),
    (pid, c_cena, 'Angolo dolci e confettata', 'Carrello dei dolci della tradizione e confettata finale.', 12, 'PERSONA', true, 12),
    (pid, c_cena, 'Coordinamento e servizio in sala', 'Maître e brigata di sala dedicati, coordinamento dell''intera giornata.', 1500, 'EVENTO', true, 13);
  raise notice 'SERVIZI_REALI=%', (select count(*) from public.services where fornitore_id = pid);
end $$;
