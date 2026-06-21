import { useState } from 'react'
import { X, Loader2, Check, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { POSTER_TEMPLATES, templateForTheme } from '@/lib/tableauPosters'
import { exportPlaceCards, exportTableSigns, exportMenu } from '@/lib/eventPrintables'
import type { PGuest, PTable } from '@/lib/eventPrintShared'

type Kind = 'place-card' | 'place-tent' | 'table-signs' | 'menu'
const KINDS: Array<{ id: Kind; label: string; desc: string }> = [
  { id: 'place-card', label: 'Segnaposto · cartoncino', desc: 'Un nome a testa, da ritagliare — 10 per foglio.' },
  { id: 'place-tent', label: 'Segnaposto · tenda', desc: 'A tendina, nome leggibile sui due lati — 8 per foglio.' },
  { id: 'table-signs', label: 'Cavalieri per tavolo', desc: 'Uno per tavolo: nome del tavolo + invitati, autoportante.' },
  { id: 'menu', label: 'Menu', desc: 'Scheda menu col tuo logo, portate dal menu evento — 2 per foglio.' },
]

export function PrintStudio({ open, onClose, guests, tables, menu, coupleNames, dateText, logoUrl, venueName, theme }: {
  open: boolean; onClose: () => void
  guests: PGuest[]; tables: PTable[]
  menu: Array<{ section: string; name: string; description?: string | null }>
  coupleNames: string; dateText: string; logoUrl?: string | null; venueName?: string | null; theme?: string | null
}) {
  const [kind, setKind] = useState<Kind>('place-card')
  const [styleId, setStyleId] = useState<string>(() => templateForTheme(theme))
  const [busy, setBusy] = useState(false)
  if (!open) return null

  async function run() {
    setBusy(true)
    const tid = toast.loading('Preparo il PDF…')
    try {
      if (kind === 'place-card') await exportPlaceCards(guests, tables, { variant: 'card', styleId })
      else if (kind === 'place-tent') await exportPlaceCards(guests, tables, { variant: 'tent', styleId })
      else if (kind === 'table-signs') await exportTableSigns(tables, guests, { styleId, coupleNames, dateText })
      else await exportMenu(menu, { styleId, logoUrl, venueName, coupleNames, dateText })
      toast.success('PDF pronto', { id: tid })
    } catch (e) { toast.error((e as Error).message, { id: tid }) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <div>
            <h3 className="font-display text-xl">Stampa per gli ospiti</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Segnaposto, cavalieri e menu — negli stessi stili del tableau.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Cosa stampi</p>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => {
                const sel = k.id === kind
                return (
                  <button key={k.id} onClick={() => setKind(k.id)}
                    className={`relative rounded-lg border p-2.5 text-left ${sel ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))] bg-[rgb(var(--gold-50))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--fg-subtle))]'}`}>
                    <p className="text-sm font-medium leading-tight">{k.label}</p>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] leading-snug mt-0.5">{k.desc}</p>
                    {sel && <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[rgb(var(--gold-500))] text-white flex items-center justify-center"><Check size={11} /></span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Stile</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {POSTER_TEMPLATES.map((tpl) => {
                const sel = tpl.id === styleId
                return (
                  <button key={tpl.id} onClick={() => setStyleId(tpl.id)}
                    className={`relative rounded-lg overflow-hidden border text-left ${sel ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>
                    <div className="h-14 w-full flex flex-col items-center justify-center gap-1" style={{ background: tpl.bg, color: tpl.nameColor }}>
                      <span style={{ fontFamily: tpl.nameFont, fontStyle: tpl.nameItalic ? 'italic' : 'normal', fontSize: 15 }}>Aa</span>
                      <span className="h-1 w-7 rounded" style={{ background: tpl.accent }} />
                    </div>
                    <div className="px-1.5 py-1"><p className="text-[10px] font-medium leading-tight truncate">{tpl.name}</p></div>
                    {sel && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[rgb(var(--gold-500))] text-white flex items-center justify-center"><Check size={10} /></span>}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[11px] text-[rgb(var(--fg-subtle))]">A4 da ritagliare · i nomi vengono dagli invitati presenti, le portate dal menu dell'evento. La generazione può richiedere qualche secondo.</p>
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end">
          <Button onClick={run} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Genera PDF</Button>
        </div>
      </div>
    </div>
  )
}
