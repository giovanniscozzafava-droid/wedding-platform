import { useRef, useState } from 'react'
import { Upload, X, FileText, Check, Download, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { parseCsv, type CsvRow } from '@/lib/csv'
import { IMPORT_TARGETS, detectTarget, buildMap, type ImportTarget } from '@/lib/csvTargets'

// Importatore CSV universale: rileva il tipo (prodotti/clienti/invitati…),
// mappa le colonne e scrive al posto giusto. defaultTargetKey pre-seleziona il
// tipo dove serve (es. nel catalogo → prodotti); resta cambiabile a mano.
type Props = {
  defaultTargetKey?: string
  entryId?: string
  onDone?: () => void
  label?: string
}

export function CsvImporter({ defaultTargetKey, entryId, onDone, label = 'Importa CSV' }: Props) {
  const [open, setOpen] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<CsvRow[]>([])
  const [target, setTarget] = useState<ImportTarget>(IMPORT_TARGETS.find((t) => t.key === defaultTargetKey) ?? IMPORT_TARGETS[0]!)
  const [autoDetected, setAutoDetected] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const valid = headers.length ? rawRows.map((r) => target.transform(r, buildMap(headers, target))).filter((x): x is Record<string, unknown> => x !== null) : []

  async function handleFile(f: File) {
    setParsing(true)
    try {
      const { headers: h, rows } = parseCsv(await f.text())
      setHeaders(h); setRawRows(rows)
      // auto-detect, ma rispetta il default se è coerente
      const det = detectTarget(h)
      if (!defaultTargetKey || det.key === defaultTargetKey) { setTarget(det); setAutoDetected(true) }
      else setAutoDetected(false)
    } catch (e) { toast.error('CSV non leggibile: ' + (e as Error).message) }
    finally { setParsing(false) }
  }

  async function doImport() {
    if (valid.length === 0) return
    if (target.needsEntry && !entryId) { toast.error('Per gli invitati serve aprire l’import dentro un evento.'); return }
    setImporting(true)
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('Non autenticato')
      const res = await target.run(valid, { userId, entryId })
      if (res.errors.length) toast.error(`${res.imported} importati, ${res.errors.length} errori: ${res.errors[0]}`)
      else toast.success(`Importati ${res.imported} ${target.noun}`)
      onDone?.()
      reset(); setOpen(false)
    } catch (e) { toast.error((e as Error).message) }
    finally { setImporting(false) }
  }

  function reset() { setHeaders([]); setRawRows([]); if (fileRef.current) fileRef.current.value = '' }
  function downloadTemplate() {
    const blob = new Blob([target.sample], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `modello-${target.key}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Upload size={14} /> {label}</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(0 0 0 / 0.4)' }}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <h3 className="font-display text-xl">Importa da CSV</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))]">Riconoscimento automatico del tipo e delle colonne. Mette ogni cosa al posto giusto.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { reset(); setOpen(false) }}><X size={16} /></Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {headers.length === 0 ? (
                <>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: 'rgb(var(--border-strong))' }}>
                    <FileText size={32} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
                    <p className="text-sm font-medium mb-1">Scegli un file .csv</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">Separatore virgola / punto-e-virgola / tab. Prima riga = intestazioni.</p>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
                    <Button variant="gold" disabled={parsing} onClick={() => fileRef.current?.click()}>{parsing ? 'Analisi…' : 'Scegli file CSV'}</Button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[rgb(var(--fg-muted))]">
                    <div className="flex items-center gap-2">
                      <span>Tipo:</span>
                      <Select value={target.key} onChange={(e) => setTarget(IMPORT_TARGETS.find((t) => t.key === e.target.value)!)} className="h-8 text-xs">
                        {IMPORT_TARGETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </Select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download size={12} /> Scarica modello</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {autoDetected && <span className="inline-flex items-center gap-1 text-[11px] text-[rgb(var(--gold-700))]"><Wand2 size={12} /> rilevato</span>}
                      <span className="text-sm">Tipo:</span>
                      <Select value={target.key} onChange={(e) => { setTarget(IMPORT_TARGETS.find((t) => t.key === e.target.value)!); setAutoDetected(false) }} className="h-8 text-sm">
                        {IMPORT_TARGETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </Select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset}>Cambia file</Button>
                  </div>
                  <p className="text-sm"><strong>{valid.length}</strong> {target.noun} validi su {rawRows.length} righe{rawRows.length - valid.length > 0 && <span className="text-[rgb(var(--fg-muted))]"> ({rawRows.length - valid.length} scartati: manca «{target.required}»)</span>}.</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">Colonne: {headers.join(' · ')}</p>
                  {target.needsEntry && !entryId && <p className="text-xs text-[rgb(var(--rose-500))]">Gli invitati vanno importati aprendo l’import dentro un evento.</p>}

                  <div className="border rounded-lg overflow-auto max-h-72" style={{ borderColor: 'rgb(var(--border))' }}>
                    <table className="w-full text-xs">
                      <thead className="bg-[rgb(var(--bg-sunken))] sticky top-0"><tr>{target.preview.map((c) => <th key={c.key} className="text-left p-2 font-medium">{c.label}</th>)}</tr></thead>
                      <tbody>
                        {valid.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                            {target.preview.map((c) => <td key={c.key} className="p-2 text-[rgb(var(--fg-muted))]">{r[c.key] != null ? String(r[c.key]) : '—'}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {valid.length > 50 && <p className="p-2 text-center text-xs text-[rgb(var(--fg-subtle))]">+ {valid.length - 50} altri…</p>}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="ghost" onClick={() => { reset(); setOpen(false) }}>Annulla</Button>
              {valid.length > 0 && (
                <Button variant="gold" disabled={importing || (target.needsEntry && !entryId)} onClick={() => void doImport()}>
                  <Check size={14} /> {importing ? 'Importazione…' : `Importa ${valid.length} ${target.noun}`}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
