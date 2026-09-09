// La riga «Decoro del modello» in scheda, PDF e PSD: cosa c'è sulla copertina di questo modello, dal catalogo.
// (modulo senza three.js: lo importano anche la scheda evento e le opzioni di copertina)
import type { Decor } from '@/components/album/glb/decor.generated'

export function decorLabel(d: Decor): string {
  const stones = d.stonesXY.length ? ` · ${d.stonesXY.length} cristalli Swarovski` : ''
  if (d.kind === 'plate') return `Piastra Cristalwhite intagliata (disegno del catalogo, il tessuto a vista nei fori)${stones}`
  if (d.kind === 'strip') return `Fascia stampata a tutta larghezza (motivo del catalogo)${stones}`
  if (d.kind === 'panel') return `Pannello Cristalplex con damasco chiaro (dal catalogo) e foto a fianco${stones}`
  return `${d.color ? 'Stampa a colori' : 'Disegno'} del catalogo${d.color ? '' : ', nel colore scelto per nomi e loghi'}${stones}`
}
