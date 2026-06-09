-- ============================================================================
-- Articolo Gisko riscritto dal post Instagram reale (matrimonio a Blu 70,
-- Yessica & Alberto, costa calabrese) con foto cover come hero.
-- ============================================================================
update blog_posts set
  category_id = (select id from blog_categories where slug = 'storie'),
  title = $t$Un matrimonio a Blu 70: la Calabria che diventa cinema$t$,
  excerpt = $e$Mare, roccia, fiori bianchi e lampadari accesi sul far della sera. Il racconto del matrimonio di Yessica e Alberto sulla costa calabrese.$e$,
  hero_image_url = 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/blog-media/gisko/blu70-1781023320.jpg',
  body_html = $b$<p>A Blu 70 la costa calabrese ha fatto quello che le riesce meglio: restare lì, silenziosamente drammatica sullo sfondo, mentre tutto il resto diventava puro cinema.</p>
<h2>Il mare come scenografia</h2>
<p>Il mare, la roccia, i fiori bianchi, il lino morbido, i lampadari accesi sopra i tavoli, il vento che attraversava la cerimonia, l’auto d’epoca a un passo dall’acqua. E poi la notte: luci, musica, balli, fuochi d’artificio, amici, risate, caos, bellezza.</p>
<h2>Anima mediterranea, eleganza editoriale</h2>
<p>È stato un matrimonio dall’anima mediterranea e dall’eleganza editoriale. Intimo, selvaggio, raffinato. Esattamente il tipo di celebrazione che non ha bisogno di gridare per farsi ricordare.</p>
<p>Yessica e Alberto ci hanno messo l’emozione. La Calabria ci ha messo lo scenario. La notte ci ha messo la magia — perché a quanto pare anche l’universo sa quando comportarsi bene.</p>
<h2>Raccontare, non mettere in posa</h2>
<p>Il mio lavoro, come sempre, è stato esserci senza disturbare: cogliere gli attimi veri — uno sguardo, una risata durante i discorsi, la luce di taglio sul far della sera — e lasciare che la storia accadesse da sé. È il <strong>reportage d’istinto</strong>: niente set costruiti, solo ciò che succede davvero.</p>
<h2>Una festa fatta da una rete di professionisti</h2>
<p>Un giorno così non lo fa una persona sola: lo fa una squadra. Grazie a chi ha reso possibile Blu 70:</p>
<ul>
<li><strong>Wedding planner</strong>: Rosella Elia Events</li>
<li><strong>Location</strong>: Blu 70</li>
<li><strong>Fiori</strong>: Giuseppe Aras Floral Designer</li>
<li><strong>Grafica</strong>: Armonia Grafica Eventi</li>
<li><strong>Beauty</strong>: Maria Milie Beauty Academy</li>
<li>e l’intera rete di musica, catering, fuochi e luci che ha acceso la notte.</li>
</ul>
<p><em>Vi sposate in Calabria e cercate un racconto che sia davvero il vostro? Scriviamoci: partiamo dalla vostra storia.</em></p>$b$,
  tags = array['matrimonio Calabria','Blu 70','fotografo matrimonio','reportage','wedding Calabria'],
  seo_title = $st$Matrimonio a Blu 70, Calabria: il reportage | Gisko$st$,
  seo_description = $sd$Il racconto fotografico del matrimonio di Yessica e Alberto a Blu 70, sulla costa calabrese. Reportage d'istinto di Gisko.$sd$,
  reading_minutes = 4,
  updated_at = now()
where slug = 'reportage-matrimonio-calabria-gisko';
