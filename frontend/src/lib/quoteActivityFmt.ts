// Formattazione per le metriche di attività del preventivo (viste cliente). Puro → testabile.

export function relTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = Math.max(0, now - t)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'adesso'
  if (min < 60) return `${min} min fa`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ieri'
  if (d < 7) return `${d} giorni fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function deviceFromUa(ua?: string | null): 'mobile' | 'desktop' {
  return ua && /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop'
}
