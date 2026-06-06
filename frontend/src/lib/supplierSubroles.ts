// Lista subroles fornitore — sorgente unica usata in:
// - SuppliersPage (capostipite invita fornitore)
// - ProviderOnboardingWizard (signup fornitore)
// - QuoteEditor, dropdown filtri, ecc
//
// Quando aggiungi un subrole qui, aggiungi anche:
// - Q_* in lib/supplierQuestions.ts (questionario dedicato)
// - SUBROLE_STYLE_SECTIONS event-agnostic
// - SUBROLE_LABELS
// - categorie service standard (migration *_service_categories.sql)

export type SubroleOption = { v: string; l: string }

export const SUPPLIER_SUBROLES: SubroleOption[] = [
  // Foto/Video
  { v: 'fotografo',     l: 'Fotografo' },
  { v: 'videomaker',    l: 'Videomaker' },
  { v: 'photobooth',    l: 'Photobooth / Cabina fotografica' },
  { v: 'livepainter',   l: 'Live painter / Caricaturista' },
  // Beauty
  { v: 'make_up',       l: 'Make-up artist' },
  { v: 'parrucchiere',  l: 'Parrucchiere / Hairstylist' },
  { v: 'estetista',     l: 'Estetista / Manicure / Beauty' },
  // Allestimenti & decor
  { v: 'fioraio',       l: 'Fioraio' },
  { v: 'allestimenti',  l: 'Allestimenti / Wedding designer' },
  { v: 'luci',          l: 'Luci / Light designer' },
  { v: 'fuochista',     l: 'Fuochi pirotecnici' },
  { v: 'noleggio',      l: 'Noleggio attrezzature' },
  // Cibo & bevande
  { v: 'catering',      l: 'Catering' },
  { v: 'chef',          l: 'Personal chef / Show cooking' },
  { v: 'food_truck',    l: 'Food truck' },
  { v: 'pasticcere',    l: 'Pasticceria / Wedding cake' },
  { v: 'sweet_table',   l: 'Sweet table / Confettata' },
  { v: 'bartender',     l: 'Bartender / Open bar' },
  { v: 'sommelier',     l: 'Sommelier' },
  // Musica & intrattenimento
  { v: 'musica',        l: 'Musica / DJ / Band' },
  { v: 'magia',         l: 'Mago / Illusionista / Mentalista' },
  { v: 'animazione',    l: 'Animazione bambini' },
  { v: 'animali',       l: 'Falconiere / Animali cerimonia' },
  // Logistica
  // NB: 'location' e 'wedding_planner' NON sono fornitori: sono CAPOSTIPITI
  // (ruoli a sé, alternativi). Si registrano dal ruolo top-level, non qui.
  { v: 'auto',          l: 'Auto / Trasporti' },
  { v: 'navetta',       l: 'Navetta ospiti' },
  { v: 'valet',         l: 'Valet parking' },
  { v: 'maitre',        l: 'Maitre / Coordinatore sala' },
  { v: 'hostess',       l: 'Hostess / Steward / Accoglienza' },
  // Cerimonia
  { v: 'celebrante',    l: 'Celebrante / Officiante' },
  // Cartoleria & gadget
  { v: 'abiti',         l: 'Atelier abiti' },
  { v: 'stampe',        l: 'Stampe / Inviti / Tableau' },
  { v: 'calligrafo',    l: 'Calligrafo' },
  { v: 'bomboniere',    l: 'Bomboniere' },
  // Altro
  { v: 'altro',         l: 'Altro' },
]

// Versione con prefisso "Seleziona..." per use nei dropdown del form
export const SUPPLIER_SUBROLES_WITH_PLACEHOLDER: SubroleOption[] = [
  { v: '', l: 'Seleziona...' },
  ...SUPPLIER_SUBROLES,
]
