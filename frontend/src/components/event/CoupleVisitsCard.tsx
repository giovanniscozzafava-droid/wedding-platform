// «Il cliente è entrato» — presenze dentro l'evento, per il professionista.
// Non basta sapere CHE è entrato: cinque secondi sul contratto e venti minuti sulle
// foto non sono la stessa visita. Perciò: quante volte, dove, quanto, e l'ultima.
import { useEffect, useState } from 'react'
import { Eye, Clock } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Sezione = { sezione: string; visite: number; secondi: number; ultima: string }
type Riga = { quando: string; sezione: string; secondi: number; chi: string }
type Dati = {
  visite: number; rimbalzi: number; secondi_totali: number
  ultima: string | null; prima: string | null; persone: number
  sezioni: Sezione[]; ultime: Riga[]; error?: string
}

const NOME: Record<string, string> = {
  overview: 'Panoramica', foto: 'Foto', preventivo: 'Preventivo', contratto: 'Contratto',
  fornitori: 'Professionisti', chat: 'Messaggi', planning: 'Organizzazione',
  invitati: 'Invitati', tavoli: 'Tavoli', programma: 'Programma', cerimonia: 'Cerimonia',
  audio: 'Auguri audio', guestbook: 'Guestbook', video: 'Video', evento: 'Evento',
}
const etichetta = (k: string) => NOME[k] ?? (k.charAt(0).toUpperCase() + k.slice(1))

function durata(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}min`
}
function quando(iso: string): string {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'adesso'
  if (min < 60) return `${min} min fa`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`
  const g = Math.floor(h / 24)
  if (g < 7) return `${g} ${g === 1 ? 'giorno' : 'giorni'} fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

export function CoupleVisitsCard({ entryId }: { entryId: string }) {
  const [d, setD] = useState<Dati | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.rpc as any)('couple_visits_summary', { p_entry: entryId })
      const r = data as Dati | null
      if (r && !r.error) setD(r)
    })()
  }, [entryId])

  // Mai entrato: la scheda non c'è. Un "0 visite" non aggiunge niente e ruba spazio.
  if (!d || d.visite === 0) return null

  const maxSec = Math.max(1, ...d.sezioni.map((s) => Number(s.secondi)))

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="inline-flex items-center gap-2 font-medium">
          <Eye size={16} className="text-[rgb(var(--gold-600))]" /> Il cliente è entrato
        </span>
        {d.ultima && <span className="text-xs text-[rgb(var(--fg-subtle))]">ultima volta {quando(d.ultima)}</span>}
      </div>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        <strong className="text-[rgb(var(--fg))]">{d.visite}</strong> {d.visite === 1 ? 'visita' : 'visite'}
        {' '}per <strong className="text-[rgb(var(--fg))]">{durata(Number(d.secondi_totali))}</strong> in tutto
        {d.persone > 1 ? `, da ${d.persone} persone` : ''}.
      </p>

      <ul className="space-y-2 mb-4">
        {d.sezioni.map((s) => (
          <li key={s.sezione}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{etichetta(s.sezione)}</span>
              <span className="text-[rgb(var(--fg-muted))] tabular-nums text-xs">
                {durata(Number(s.secondi))} · {s.visite} {s.visite === 1 ? 'volta' : 'volte'}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <div className="h-full rounded-full" style={{ width: `${(Number(s.secondi) / maxSec) * 100}%`, background: 'rgb(var(--gold-500))' }} />
            </div>
          </li>
        ))}
      </ul>

      {d.ultime.length > 0 && (
        <details>
          <summary className="text-xs text-[rgb(var(--fg-muted))] cursor-pointer select-none inline-flex items-center gap-1.5">
            <Clock size={12} /> Ultimi accessi
          </summary>
          <ul className="mt-2 space-y-1">
            {d.ultime.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-[rgb(var(--fg-muted))]">{quando(r.quando)} · {etichetta(r.sezione)}</span>
                <span className="tabular-nums text-[rgb(var(--fg-subtle))]">{durata(Number(r.secondi))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {d.rimbalzi > 0 && (
        <p className="mt-3 text-[11px] text-[rgb(var(--fg-subtle))]">
          Non conto {d.rimbalzi} {d.rimbalzi === 1 ? 'apertura' : 'aperture'} sotto i 5 secondi: sono rimbalzi, non visite.
        </p>
      )}
    </Card>
  )
}
