// Ornamenti VERI (incisioni Art Nouveau di pubblico dominio, da Wikimedia Commons):
// fleuron, headpiece, sprig floreali. Pubblico dominio = uso commerciale libero.
// Serviti da /public/ornaments (stessa origine → niente CORS, html2canvas li cattura).
export const ORNAMENT_NAMES = ['headpiece', 'fleuron', 'sprig', 'floral1913'] as const
export type OrnamentName = (typeof ORNAMENT_NAMES)[number]

const cache: Partial<Record<OrnamentName, string>> = {}

export async function loadOrnaments(): Promise<Record<OrnamentName, string>> {
  await Promise.all(ORNAMENT_NAMES.map(async (n) => {
    if (cache[n]) return
    try { cache[n] = await (await fetch(`/ornaments/${n}.svg`)).text() } catch { cache[n] = '' }
  }))
  return cache as Record<OrnamentName, string>
}

// Ricolora l'unico fill dell'ornamento e lo rende responsive dentro il contenitore.
export function tintOrnament(raw: string, color: string): string {
  if (!raw) return ''
  return raw
    .replace(/fill:#[0-9a-fA-F]{6}/g, `fill:${color}`)
    .replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${color}"`)
    // forza il riempimento del contenitore (l'svg ha width/height intrinseci; style vince)
    .replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;overflow:visible"')
}
