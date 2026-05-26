-- ============================================================================
-- Catalogo preset stazioni/isole tipiche matrimoni italiani.
-- Importabili nel menu di un wedding dalla UI MenuTab (bottone "Importa preset").
-- Region: regionalità (sud, nord, sicilia, ...) per filtraggio.
-- ============================================================================

insert into menu_presets (section, title, description, dietary_tags, allergens, typical_price_per_guest, region) values

-- ─── ISOLE BENVENUTO / APERITIVO ───────────────────────────────────────────
('ISOLA_BENVENUTO', 'Aperitivo a buffet con bollicine',
 'Spumante metodo classico o Franciacorta in calice, accompagnato da finger food caldi e freddi: bruschette, tartine, mini-tramezzini.',
 array['vegetariano']::text[], array['glutine','lattosio','uova']::text[], 18, 'italia'),

('ISOLA_BENVENUTO', 'Welcome con cocktail di benvenuto',
 'Spritz, Hugo, Bellini in postazione bartender. Accompagnati da olive ascolane, taralli pugliesi, parmigiano in scaglie.',
 array['vegetariano']::text[], array['glutine','lattosio','solfiti']::text[], 22, 'italia'),

('ISOLA_BENVENUTO', 'Taralli e bollicine — pugliese',
 'Taralli pugliesi classici e al finocchio, friselle con pomodorino e olio EVO, mortadella IGP a fette, focaccia barese.',
 array['vegetariano']::text[], array['glutine','solfiti']::text[], 16, 'puglia'),

-- ─── ISOLE PRECENA / BUFFET ────────────────────────────────────────────────
('ISOLA_PRECENA', 'Buffet pre-cena 4 stazioni',
 'Quattro postazioni tematiche servite contemporaneamente: salumi e formaggi, pesce crudo, fritti caldi, verdure grigliate.',
 array[]::text[], array['glutine','lattosio','pesce','molluschi','crostacei','solfiti']::text[], 38, 'italia'),

('ISOLA_SALUMI', 'Isola salumi e formaggi DOP',
 'Prosciutto crudo di Parma 24 mesi tagliato a coltello, San Daniele DOP, mortadella IGP, salame Felino, soppressata calabrese. Parmigiano Reggiano 36 mesi, pecorino sardo, gorgonzola, ricotta fresca. Confetture artigianali, mostarda, miele millefiori.',
 array[]::text[], array['lattosio']::text[], 25, 'italia'),

('ISOLA_FRITTI', 'Isola fritti caldi misti',
 'Arancini siciliani al ragù, panzerotti pugliesi, supplì romani, fiori di zucca pastellati, olive all''ascolana, mozzarelline in carrozza.',
 array['vegetariano']::text[], array['glutine','lattosio','uova']::text[], 18, 'italia'),

('ISOLA_PIZZA', 'Isola pizzaiolo live',
 'Forno a legna in postazione con pizzaiolo dedicato. Pizza margherita, marinara, prosciutto e funghi, 4 stagioni, pizza al taglio rustica con vari topping. Servita calda direttamente dal forno.',
 array['vegetariano']::text[], array['glutine','lattosio']::text[], 22, 'italia'),

('ISOLA_PESCE_CRUDO', 'Isola crudo di mare',
 'Selezione di ostriche fines de claire, gamberi rossi di Mazara, scampi, tartare di tonno e di branzino, carpaccio di ricciola, salmone marinato all''aneto. Servita su ghiaccio tritato.',
 array['pesce_friendly']::text[], array['pesce','molluschi','crostacei']::text[], 45, 'sud'),

('ISOLA_PASTA_LIVE', 'Isola pasta fresca al momento',
 'Cuoco in postazione che tira la pasta al momento: tagliatelle ai funghi porcini, ravioli ricotta e spinaci con burro e salvia, gnocchi al pomodoro fresco e basilico.',
 array['vegetariano']::text[], array['glutine','uova','lattosio']::text[], 28, 'italia'),

('ISOLA_FORMAGGI', 'Isola formaggi italiani DOP',
 'Selezione di 8 formaggi italiani DOP a varia stagionatura: parmigiano 36 mesi, pecorino di fossa, gorgonzola dolce e piccante, taleggio, asiago, robiola, caprino fresco. Composte di frutta, miele millefiori, miele al tartufo, pane carasau, grissini.',
 array['vegetariano']::text[], array['lattosio','glutine']::text[], 22, 'italia'),

-- ─── SHOW COOKING ───────────────────────────────────────────────────────────
('SHOW_COOKING', 'Taglio prosciutto crudo live',
 'Maestro tagliatore in postazione con culatello di Zibello o prosciutto di Parma intero in morsa, taglio a coltello al momento. Accompagnato da pane casereccio caldo.',
 array[]::text[], array['glutine']::text[], 15, 'italia'),

('SHOW_COOKING', 'Risotto al parmigiano alla forma',
 'Chef in postazione che manteca il risotto direttamente dentro una forma intera di parmigiano 36 mesi. Spettacolare e profumatissimo.',
 array['vegetariano']::text[], array['lattosio','solfiti']::text[], 18, 'nord'),

('SHOW_COOKING', 'Tagliata di manzo argentino',
 'Cuoco grigliatore in postazione live con tagliata di manzo angus o argentino, scaloppato al momento. Salse: chimichurri, senape antica, sale alle erbe.',
 array[]::text[], array['senape']::text[], 28, 'italia'),

-- ─── ISOLE DOLCI / DOPOCENA ─────────────────────────────────────────────────
('ISOLA_DOLCI', 'Isola dolci della tradizione italiana',
 'Cannoli siciliani farciti al momento, sfogliatelle napoletane, baba al rum, profiteroles, tiramisù, pasticcini mignon. Servita su alzate vintage.',
 array['vegetariano']::text[], array['glutine','lattosio','uova','frutta_a_guscio']::text[], 18, 'sud'),

('ISOLA_CIOCCOLATO', 'Fontana di cioccolato',
 'Fontana di cioccolato fondente e bianco con stecchi di frutta fresca (fragole, ananas, banana, kiwi), marshmallow, biscotti, brownies. Confettata cioccolato a parte.',
 array['vegetariano']::text[], array['lattosio','soia','frutta_a_guscio']::text[], 14, 'italia'),

('ISOLA_FRUTTA', 'Isola frutta esotica e caramellata',
 'Selezione di frutta esotica intera (ananas, mango, papaya, frutto della passione) e tagliata. Frutta caramellata su stecco. Spiedini di frutta fresca.',
 array['vegano','celiaco','no_lattosio']::text[], array[]::text[], 12, 'italia'),

('ISOLA_DOPOCENA', 'Gelateria mobile',
 'Carretto del gelato artigianale con 8 gusti tra cui pistacchio di Bronte, nocciola Piemonte IGP, fior di latte, cioccolato fondente. Coni e coppette, granite siciliane.',
 array['vegetariano']::text[], array['lattosio','frutta_a_guscio']::text[], 14, 'sud'),

-- ─── CARRELLI BAR / DOPOCENA ────────────────────────────────────────────────
('CARRELLO_DISTILLATI', 'Carrello distillati e amari',
 'Selezione di whisky single malt, rum invecchiati, cognac, grappe d''alta qualità, amari italiani (Amaro del Capo, Amaro Lucano, Fernet Branca).',
 array[]::text[], array['solfiti']::text[], 12, 'italia'),

('CARRELLO_SIGARI', 'Carrello sigari (in giardino o veranda)',
 'Selezione di sigari toscani, cubani Cohiba/Romeo y Julieta. Cutter, taglierini, fiammiferi al cedro. Servizio fuori dalla sala per il rispetto degli ospiti.',
 array[]::text[], array[]::text[], 18, 'italia'),

('CARRELLO_GIN_TONIC', 'Gin Tonic station',
 'Bartender dedicato con 12 gin diversi (Bombay, Hendrick''s, Tanqueray, Malfy, ...) e 5 toniche premium (Fever Tree, 1724, Indi&Co). Botanicals: bacche di ginepro, cetriolo, pompelmo rosa, rosmarino, cardamomo.',
 array[]::text[], array['solfiti']::text[], 14, 'italia'),

('CARRELLO_CAFFE_SPECIAL', 'Caffè con liquori',
 'Espresso napoletano accompagnato da grappe, sambuca, amaretto, Strega, anice, limoncello fatto in casa. Cioccolatini di accompagnamento.',
 array['vegetariano']::text[], array['solfiti','frutta_a_guscio','lattosio']::text[], 8, 'sud'),

-- ─── BEVANDE ────────────────────────────────────────────────────────────────
('OPEN_BAR', 'Open bar premium 5 ore',
 'Bartender dedicato per 5 ore. Cocktail classici: Negroni, Old Fashioned, Mojito, Aperol Spritz, Moscow Mule, Hugo. Birre artigianali, vini al calice, soft drinks.',
 array[]::text[], array['solfiti']::text[], 35, 'italia'),

('CONFETTATA', 'Confettata classica',
 'Tavolo confettata con confetti Pelino in vari gusti (mandorla, pistacchio, nocciola, cioccolato, ricotta&pera, tiramisù). Sacchettini personalizzati per gli ospiti.',
 array['vegetariano']::text[], array['frutta_a_guscio','lattosio']::text[], 8, 'italia');
