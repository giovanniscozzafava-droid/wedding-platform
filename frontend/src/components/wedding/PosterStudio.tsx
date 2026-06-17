import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Download, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MOOD_PALETTE } from '@/lib/moodBoard'
import { POSTER_TEMPLATES, POSTER_FORMATS, getTemplate, templateForTheme, type Palette } from '@/lib/tableauPosters'
import { loadOrnaments, type OrnamentName } from '@/lib/tableauOrnaments'
import { exportPosterNode } from '@/lib/tableauExport'
import { TableauPoster, type PosterData } from './TableauPoster'

type T = { id: string; table_no: number; label: string | null; seats: number; is_staff?: boolean | null }
type G = { id: string; full_name: string; table_id: string | null }

export function PosterStudio({ open, onClose, tables, guests, coupleNames, dateText, location, theme }: {
  open: boolean; onClose: () => void
  tables: T[]; guests: G[]
  coupleNames: string; dateText: string; location?: string; theme?: string | null
}) {
  const [templateId, setTemplateId] = useState<string>(() => templateForTheme(theme))
  const [accent, setAccent] = useState<string | null>(null)
  const [fmt, setFmt] = useState<string>('70x100')
  const [names, setNames] = useState(coupleNames)
  const [date, setDate] = useState(dateText)
  const [busy, setBusy] = useState(false)
  const [ornaments, setOrnaments] = useState<Record<OrnamentName, string> | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open && !ornaments) void loadOrnaments().then(setOrnaments) }, [open, ornaments])

  const template = getTemplate(templateId)
  const palette: Palette = accent ? { ...template.palette, accent } : template.palette

  const data: PosterData = useMemo(() => {
    const sorted = [...tables].sort((a, b) => (a.is_staff ? -1 : b.is_staff ? 1 : 0) || (a.table_no - b.table_no))
    return {
      coupleNames: names, dateText: date, location,
      tables: sorted.map((t) => ({
        id: t.id, name: t.label ?? `Tavolo ${t.table_no}`,
        guests: guests.filter((g) => g.table_id === t.id).map((g) => g.full_name),
      })),
    }
  }, [tables, guests, names, date, location])

  if (!open) return null
  const fmtMm = POSTER_FORMATS[fmt]!
  const ratio = fmtMm.h / fmtMm.w
  const previewW = 320

  async function doExport() {
    if (!exportRef.current || !ornaments) return
    setBusy(true)
    try {
      await exportPosterNode(exportRef.current, { w: fmtMm.w, h: fmtMm.h }, `tableau-${fmt}-${(names || 'sposi').toLowerCase().replace(/\s+/g, '-')}.pdf`)
      toast.success('Poster esportato')
    } catch (e) { toast.error('Export non riuscito: ' + (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <div>
            <h3 className="font-display text-xl">Poster del tableau</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Scegli un pro forma, personalizza e scarica fino a 70×100 cm.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-[1fr_340px] gap-0">
          {/* Controlli */}
          <div className="p-4 space-y-4 order-2 md:order-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Pro forma</p>
              <div className="grid grid-cols-3 gap-2">
                {POSTER_TEMPLATES.map((tpl) => {
                  const sel = tpl.id === templateId
                  return (
                    <button key={tpl.id} onClick={() => { setTemplateId(tpl.id); setAccent(null) }}
                      className={`relative rounded-lg overflow-hidden border text-left ${sel ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>
                      <div className="h-16 w-full" style={{ background: tpl.palette.bg }}>
                        <div className="h-full w-full flex flex-col items-center justify-center gap-1" style={{ color: tpl.palette.ink }}>
                          <span style={{ fontFamily: tpl.titleFont, fontStyle: tpl.titleItalic ? 'italic' : 'normal', fontSize: 13 }}>Aa</span>
                          <span className="h-1 w-8 rounded" style={{ background: tpl.palette.accent }} />
                        </div>
                      </div>
                      <div className="px-1.5 py-1">
                        <p className="text-[10px] font-medium leading-tight truncate">{tpl.name}</p>
                        <p className="text-[9px] text-[rgb(var(--fg-subtle))] leading-tight truncate">{tpl.vibe}</p>
                      </div>
                      {sel && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[rgb(var(--gold-500))] text-white flex items-center justify-center"><Check size={11} /></span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Colore accento (dal mood)</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setAccent(null)} title="Colore del pro forma" className={`h-6 w-6 rounded-full border grid place-items-center ${accent === null ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: template.palette.accent }}>{accent === null && <Check size={11} className="text-white" />}</button>
                {MOOD_PALETTE.map((c) => (
                  <button key={c} onClick={() => setAccent(c)} className={`h-6 w-6 rounded-full border ${accent === c ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-[rgb(var(--fg-muted))] mb-1">Sposi</p><Input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Marco & Anna" /></div>
              <div><p className="text-xs text-[rgb(var(--fg-muted))] mb-1">Data / luogo</p><Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="12 settembre 2026" /></div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Formato di stampa</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POSTER_FORMATS).map(([k, v]) => (
                  <button key={k} onClick={() => setFmt(k)} className={`px-3 py-1.5 rounded-lg border text-xs ${fmt === k ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{v.label}</button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <Button variant="gold" disabled={busy || !ornaments} onClick={doExport} className="w-full">{busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Scarica poster PDF ({POSTER_FORMATS[fmt]!.label})</Button>
              <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1.5 text-center">{data.tables.length} tavoli · {data.tables.reduce((s, t) => s + t.guests.length, 0)} nomi</p>
            </div>
          </div>

          {/* Anteprima */}
          <div className="p-4 bg-[rgb(var(--bg-sunken))] flex items-start justify-center order-1 md:order-2">
            <div className="shadow-xl" style={{ width: previewW, minHeight: previewW * ratio }}>
              {ornaments
                ? <TableauPoster template={template} palette={palette} data={data} width={previewW} ratio={ratio} ornaments={ornaments} />
                : <div className="flex items-center justify-center text-[rgb(var(--fg-subtle))]" style={{ height: previewW * ratio }}><Loader2 size={20} className="animate-spin" /></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Nodo nascosto ad alta risoluzione per l'export */}
      {ornaments && (
        <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none', opacity: 1 }} aria-hidden>
          <TableauPoster ref={exportRef} template={template} palette={palette} data={data} width={1500} ratio={ratio} ornaments={ornaments} />
        </div>
      )}
    </div>
  )
}
