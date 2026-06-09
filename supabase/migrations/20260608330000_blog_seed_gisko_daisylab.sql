-- ============================================================================
-- Articoli blog generati (a mano dall'assistente) per due fornitori reali:
-- Gisko (fotografo, Catanzaro) e DaisyLab_21 (coordinati grafici fatti a mano).
-- Pubblicati a loro nome. Idempotenti sullo slug.
-- ============================================================================

-- 1) Gisko — fotografo matrimonio Calabria
insert into blog_posts (author_id, category_id, slug, title, excerpt, body_html, tags, status, seo_title, seo_description, reading_minutes, published_at)
select '1d0177ba-bfd9-4e2e-a997-7201f9273d55'::uuid,
       (select id from blog_categories where slug = 'storie'),
       'reportage-matrimonio-calabria-gisko',
       $t$Reportage di matrimonio in Calabria: raccontare un giorno, non solo fotografarlo$t$,
       $e$Non metto in posa: osservo. Il racconto del vostro matrimonio in Calabria, fatto di attimi veri e di luce vera.$e$,
       $b$<p>Lo dico subito, cosi ci capiamo: al vostro matrimonio non troverete qualcuno che vi mette in fila per le foto di rito. Troverete qualcuno che osserva.</p>
<h2>Fotografare non basta: bisogna raccontare</h2>
<p>Ho studiato da filosofo e semiologo prima ancora che da fotografo. Sembra un dettaglio, e invece e tutto: per me ogni immagine e un <strong>testo</strong>, dice qualcosa &mdash; oppure e una banale fotografia. E le banali fotografie non mi interessano.</p>
<p>Un matrimonio non e una sequenza di pose: e una storia che accade una volta sola. Il mio lavoro e esserci nel momento giusto e lasciare che accada.</p>
<h2>Il reportage d&rsquo;istinto</h2>
<p>Niente set costruiti, niente &laquo;ora guardatevi e ridete&raquo;. Lavoro in punta di piedi e raccolgo gli attimi veri:</p>
<ul>
<li>la mano di tua madre che trema mentre ti sistema il velo;</li>
<li>lo sguardo che vi scambiate quando pensate che nessuno vi guardi;</li>
<li>la risata vera durante i discorsi, non quella in posa.</li>
</ul>
<p>Sono questi i fotogrammi che, riguardati tra vent&rsquo;anni, vi faranno dire: &laquo;eravamo proprio noi&raquo;.</p>
<h2>Perche la Calabria</h2>
<p>La Calabria, per me, non e uno sfondo: e casa. E quella luce di tardo pomeriggio che entra di taglio nelle sale, sono i volti e i gesti che conosco. Per questo ho scelto di raccontare i matrimoni di questa terra &mdash; a Catanzaro e in tutta la regione &mdash; con verita, non con cartoline.</p>
<h2>Cosa cercate davvero in un fotografo</h2>
<p>Quando scegliete chi raccontera il vostro giorno, cercate (anche se non lo dite) tre cose:</p>
<ul>
<li><strong>emozione vera</strong>, non perfezione patinata;</li>
<li><strong>naturalezza</strong>: sentirvi liberi, non in posa;</li>
<li><strong>un racconto</strong> che, sfogliato, vi riporti esattamente a quel giorno.</li>
</ul>
<p>Lo faccio per mestiere. Ma soprattutto <strong>lo faccio con amore</strong>: ed e la differenza che, in una foto, si vede sempre.</p>
<p><em>Vi sposate in Calabria e volete un racconto che sia davvero il vostro? Scriviamoci: partiamo dalla vostra storia.</em></p>$b$,
       array['fotografo matrimonio','reportage','Calabria','Catanzaro','wedding photographer'],
       'PUBLISHED',
       $st$Fotografo matrimonio Calabria: reportage d'istinto | Gisko$st$,
       $sd$Reportage di matrimonio in Calabria: niente pose, solo attimi veri. Lo stile narrativo di Gisko, fotografo a Catanzaro.$sd$,
       4, now()
where not exists (select 1 from blog_posts where slug = 'reportage-matrimonio-calabria-gisko');

-- 2) DaisyLab_21 — coordinati grafici fatti a mano
insert into blog_posts (author_id, category_id, slug, title, excerpt, body_html, tags, status, seo_title, seo_description, reading_minutes, published_at)
select '1d5b5670-1e36-43a5-9219-d680f01ad889'::uuid,
       (select id from blog_categories where slug = 'ispirazioni'),
       'coordinato-grafico-matrimonio-fatto-a-mano-daisylab',
       $t$Coordinato grafico di matrimonio fatto a mano: perche la carta racconta gia la vostra storia$t$,
       $e$Partecipazioni, tableau, menu: il primo &laquo;si&raquo; che i vostri invitati ricevono e di carta. Ecco perche farlo a mano cambia tutto.$e$,
       $b$<p>Prima ancora dell&rsquo;abito, prima della torta, prima di ogni dettaglio: il primo &laquo;assaggio&raquo; del vostro matrimonio che gli invitati ricevono e di <strong>carta</strong>. E la partecipazione. Ed e li che la vostra storia comincia a raccontarsi.</p>
<h2>La prima impressione e di carta</h2>
<p>Una partecipazione non comunica solo una data e un luogo: anticipa lo <strong>stile</strong> del vostro giorno. Elegante o scanzonato, botanico o minimal, classico o contemporaneo &mdash; chi la riceve capisce subito che aria tira. Per questo non e un dettaglio: e la prima parola del racconto.</p>
<h2>Fatto a mano: cosa cambia davvero</h2>
<p>Realizzo coordinati grafici <strong>interamente fatti a mano</strong>, e non e un vezzo. La carta lavorata a mano si sente: nello spessore, nella piega, in una rifinitura che una stampa industriale non potra mai avere. Ogni pezzo e pensato per <em>impreziosire</em> il vostro giorno in modo originale &mdash; il vostro, non quello di un catalogo.</p>
<h2>Cos&rsquo;e il coordinato e cosa comprende</h2>
<p>&laquo;Coordinato&raquo; vuol dire che tutto parla la stessa lingua, dallo stesso filo grafico. In genere comprende:</p>
<ul>
<li><strong>save the date</strong> e <strong>partecipazioni</strong>;</li>
<li><strong>tableau de mariage</strong> e segnaposto;</li>
<li><strong>menu</strong> e libretti messa;</li>
<li><strong>ringraziamenti</strong> e dettagli per la confettata.</li>
</ul>
<p>Quando ogni elemento dialoga con gli altri, l&rsquo;occhio percepisce cura: ed e quella cura che gli ospiti ricordano.</p>
<h2>Come nasce un coordinato su misura</h2>
<p>Si parte dalla vostra storia e dal mood che avete in testa (anche solo qualche immagine di ispirazione). Da li costruisco palette, materiali e dettagli, e li realizzo a mano, pezzo per pezzo, fino al risultato finale. Niente template: tutto cucito addosso al vostro evento.</p>
<p><em>Volete che il vostro matrimonio si racconti gia dalla prima busta? Parliamone: progettiamo insieme il vostro coordinato.</em></p>$b$,
       array['partecipazioni matrimonio','tableau de mariage','coordinato grafico','fatto a mano','wedding stationery'],
       'PUBLISHED',
       $st$Coordinato grafico matrimonio fatto a mano | DaisyLab_21$st$,
       $sd$Partecipazioni, tableau e menu di matrimonio fatti a mano: il coordinato grafico su misura di DaisyLab_21 in Calabria.$sd$,
       4, now()
where not exists (select 1 from blog_posts where slug = 'coordinato-grafico-matrimonio-fatto-a-mano-daisylab');
