// Catalogo stampe "universale" — prodotti che qualsiasi fotografo può vendere, senza gergo
// tecnico sulle carte. In beta NON si mostrano prezzi: il cliente sceglie e invia una richiesta,
// il fotografo segue. Il fotografo decide dalle Impostazioni quali prodotti mostrare (products[]).
//
// `accent` = gradiente per la card (UX fresca, mobile-first). `frame` = come disegnare l'anteprima
// della foto nel prodotto (cornice/tela/pannello…) senza compositing pesante.

export type PrintFormat = { key: string; label: string; ratio: number } // ratio = lato corto / lato lungo
export type PrintProduct = {
  key: string
  name: string
  tagline: string
  accent: [string, string]            // gradiente card
  frame: 'print' | 'canvas' | 'framed' | 'panel' | 'fineart' | 'set'
  formats: PrintFormat[]
  popular?: boolean
}

const F = (key: string, label: string, ratio = 2 / 3): PrintFormat => ({ key, label, ratio })

export const PRINT_PRODUCTS: PrintProduct[] = [
  {
    key: 'stampa',
    name: 'Stampa fotografica',
    tagline: 'La tua foto su carta fotografica, pronta da incorniciare.',
    accent: ['#EADFce', '#C9A227'],
    frame: 'print', popular: true,
    formats: [F('10x15', '10×15'), F('13x18', '13×18'), F('15x21', '15×21'), F('20x30', '20×30')],
  },
  {
    key: 'maxi',
    name: 'Maxi stampa',
    tagline: 'Grande formato, per dare risalto a un momento.',
    accent: ['#DfE7EC', '#5B7C99'],
    frame: 'print',
    formats: [F('30x45', '30×45'), F('40x60', '40×60'), F('50x70', '50×70')],
  },
  {
    key: 'tela',
    name: 'Quadro su tela',
    tagline: 'Effetto pittorico su tela, pronto da appendere.',
    accent: ['#E7E2D6', '#A98B5D'],
    frame: 'canvas', popular: true,
    formats: [F('30x45', '30×45'), F('40x60', '40×60'), F('50x70', '50×70'), F('60x90', '60×90')],
  },
  {
    key: 'cornice',
    name: 'Quadro con cornice',
    tagline: 'Stampa elegante, cornice inclusa. Scegli il colore.',
    accent: ['#EDE6DC', '#7A6A52'],
    frame: 'framed', popular: true,
    formats: [F('20x30', '20×30'), F('30x40', '30×40'), F('40x60', '40×60'), F('50x70', '50×70')],
  },
  {
    key: 'pannello',
    name: 'Pannello',
    tagline: 'Leggero e moderno, senza vetro: si appende e basta.',
    accent: ['#E3E6E8', '#6E7B82'],
    frame: 'panel',
    formats: [F('20x30', '20×30'), F('30x40', '30×40'), F('40x60', '40×60'), F('50x70', '50×70')],
  },
  {
    key: 'autore',
    name: "Stampa d'autore",
    tagline: 'Qualità da galleria, colori che durano nel tempo.',
    accent: ['#EFE9DF', '#B8923F'],
    frame: 'fineart',
    formats: [F('30x45', '30×45'), F('40x60', '40×60'), F('50x70', '50×70'), F('60x90', '60×90')],
  },
  {
    key: 'set',
    name: 'Set di mini stampe',
    tagline: 'Un pacchetto delle tue preferite, da regalare o tenere.',
    accent: ['#ECE4DE', '#C08552'],
    frame: 'set',
    formats: [F('set10', '10 foto · 10×15', 2 / 3), F('set20', '20 foto · 10×15', 2 / 3)],
  },
]

export const PRODUCT_BY_KEY: Record<string, PrintProduct> = Object.fromEntries(PRINT_PRODUCTS.map((p) => [p.key, p]))
export const ALL_PRODUCT_KEYS = PRINT_PRODUCTS.map((p) => p.key)
export const DEFAULT_ENABLED_KEYS = PRINT_PRODUCTS.filter((p) => p.popular).map((p) => p.key)
