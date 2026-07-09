// Libreria font per lo Studio disegno: Google Fonts (gratis, licenza OFL/Apache).
// Caricamento on-demand: un unico <link> batch per le anteprime, + document.fonts.load
// prima di disegnare sul canvas (così il glifo è pronto quando si fa fillText).

export type StudioFont = { name: string; cat: 'Serif' | 'Sans' | 'Display' | 'Script' | 'Mono' }

export const FONTS: StudioFont[] = [
  // Serif eleganti
  ...['Playfair Display', 'Cormorant Garamond', 'EB Garamond', 'Lora', 'Merriweather', 'PT Serif', 'Libre Baskerville', 'Crimson Text', 'Bitter', 'Source Serif 4', 'Noto Serif', 'Spectral', 'Cardo', 'Vollkorn', 'Frank Ruhl Libre', 'Alegreya', 'Domine', 'Zilla Slab', 'Bodoni Moda', 'DM Serif Display', 'DM Serif Text', 'Prata', 'Marcellus', 'Cinzel', 'Cormorant', 'Sorts Mill Goudy', 'Old Standard TT', 'Gilda Display', 'Bree Serif', 'Rozha One'].map((name) => ({ name, cat: 'Serif' as const })),
  // Sans moderni
  ...['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Raleway', 'Work Sans', 'Nunito', 'Nunito Sans', 'Source Sans 3', 'Rubik', 'Karla', 'Mulish', 'Manrope', 'DM Sans', 'Josefin Sans', 'Quicksand', 'Comfortaa', 'Barlow', 'Oswald', 'Archivo', 'Outfit', 'Sora', 'Space Grotesk', 'Figtree', 'Jost', 'Questrial', 'Cabin', 'Assistant', 'Kanit', 'Fira Sans'].map((name) => ({ name, cat: 'Sans' as const })),
  // Display / titoli
  ...['Bebas Neue', 'Anton', 'Abril Fatface', 'Alfa Slab One', 'Righteous', 'Fredoka', 'Lobster', 'Pacifico', 'Bungee', 'Passion One', 'Staatliches', 'Monoton', 'Bangers', 'Ultra', 'Rye', 'Shrikhand', 'Yeseva One', 'Cinzel Decorative', 'Fjalla One', 'Teko', 'Russo One', 'Titan One', 'Bowlby One', 'Bungee Shade', 'Faster One'].map((name) => ({ name, cat: 'Display' as const })),
  // Script / corsivi a mano
  ...['Dancing Script', 'Great Vibes', 'Satisfy', 'Parisienne', 'Allura', 'Alex Brush', 'Tangerine', 'Cookie', 'Kaushan Script', 'Yellowtail', 'Marck Script', 'Pinyon Script', 'Homemade Apple', 'Caveat', 'Shadows Into Light', 'Indie Flower', 'Amatic SC', 'Permanent Marker', 'Gochi Hand', 'Patrick Hand', 'Rock Salt', 'Reenie Beanie', 'Sacramento', 'Petit Formal Script', 'Italianno', 'Mr Dafoe', 'Mrs Saint Delafield', 'Kalam'].map((name) => ({ name, cat: 'Script' as const })),
  // Monospace
  ...['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Space Mono', 'Inconsolata', 'Roboto Mono', 'Ubuntu Mono'].map((name) => ({ name, cat: 'Mono' as const })),
]

let injected = false
export function injectFontsStylesheet() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const fams = FONTS.map((f) => 'family=' + encodeURIComponent(f.name).replace(/%20/g, '+')).join('&')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`
  document.head.appendChild(link)
}

const ready = new Set<string>()
export async function ensureFont(family: string): Promise<void> {
  injectFontsStylesheet()
  if (ready.has(family) || typeof document === 'undefined') return
  // link dedicato per la famiglia usata: garantisce il caricamento anche se il batch fallisce
  const id = 'gf-one-' + family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  if (!document.getElementById(id)) {
    const link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`
    document.head.appendChild(link)
  }
  try {
    await Promise.race([
      Promise.all([(document as any).fonts?.load(`40px "${family}"`), (document as any).fonts?.load(`700 40px "${family}"`).catch(() => {})]),
      new Promise((r) => setTimeout(r, 2000)),
    ])
    ready.add(family)
  } catch { /* fallback al font di sistema */ }
}
