import { useRef, useState } from 'react'
import { Upload, X, FileText, Check, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { parseCsv, normalizeHeader, type CsvRow } from '@/lib/csv'

type GuestInsert = {
  full_name: string
  email?: string | null
  phone?: string | null
  party_size?: number
  side?: 'SPOSA' | 'SPOSO' | 'ENTRAMBI' | null
  group_label?: string | null
  diet?: string | null
  notes?: string | null
}

type Props = {
  entryId: string
  onImported: () => void
}

// Mapping fuzzy: header normalizzato → campo target.
const HEADER_MAP: Record<string, keyof GuestInsert> = {
  nome: 'full_name',
  nomecognome: 'full_name',
  nomeecognome: 'full_name',
  fullname: 'full_name',
  name: 'full_name',
  invitato: 'full_name',
  email: 'email',
  mail: 'email',
  emailaddress: 'email',
  telefono: 'phone',
  phone: 'phone',
  cellulare: 'phone',
  mobile: 'phone',
  partysize: 'party_size',
  numeropersone: 'party_size',
  posti: 'party_size',
  accompagnatori: 'party_size',
  side: 'side',
  lato: 'side',
  parte: 'side',
  group: 'group_label',
  gruppo: 'group_label',
  grouplabel: 'group_label',
  categoria: 'group_label',
  diet: 'diet',
  dieta: 'diet',
  allergia: 'diet',
  intolleranze: 'diet',
  note: 'notes',
  notes: 'notes',
  notas: 'notes',
}

function normalizeSide(v: string): 'SPOSA' | 'SPOSO' | 'ENTRAMBI' | null {
  const x = v.trim().toLowerCase()
  if (!x) return null
  if (['sposa', 'lei', 'bride', 'b'].includes(x)) return 'SPOSA'
  if (['sposo', 'lui', 'groom', 'g'].includes(x)) return 'SPOSO'
  if (['entrambi', 'both', 'comuni', 'comune'].includes(x)) return 'ENTRAMBI'
  return null
}

function mapRow(row: CsvRow, mapping: Map<string, keyof GuestInsert>): GuestInsert | null {
  const out: GuestInsert = { full_name: '' }
  for (const [origHeader, value] of Object.entries(row)) {
    const target = mapping.get(normalizeHeader(origHeader))
    if (!target) continue
    const v = value.trim()
    if (!v) continue
    if (target === 'party_size') {
      const n = parseInt(v, 10)
      if (!isNaN(n) && n > 0) out.party_size = n
    } else if (target === 'side') {
      out.side = normalizeSide(v)
    } else {
      ;(out as any)[target] = v
    }
  }
  if (!out.full_name) return null
  return out
}

const SAMPLE_CSV = `Nome,Email,Telefono,Posti,Lato,Gruppo,Dieta,Note
Mario Rossi,mario.rossi@email.it,+39 333 1234567,2,Sposa,Famiglia,Vegetariano,Allergia frutta secca
Giulia Bianchi,giulia@email.com,,1,Sposo,Amici università,Senza glutine,
Famiglia Verdi,verdi@email.com,+39 02 1234,4,Entrambi,Cugini,,Tavolo bambini
`

export function GuestsCsvImport({ entryId, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CsvRow[]>([])
  const [validRows, setValidRows] = useState<GuestInsert[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setParsing(true)
    try {
      const text = await f.text()
      const { headers, rows } = parseCsv(text)
      setHeaders(headers)
      setRows(rows)
      const headerMap = new Map<string, keyof GuestInsert>()
      for (const h of headers) {
        const norm = normalizeHeader(h)
        const target = HEADER_MAP[norm]
        if (target) headerMap.set(norm, target)
      }
      const mapped = rows.map((r) => mapRow(r, headerMap)).filter((g): g is GuestInsert => g !== null)
      setValidRows(mapped)
      if (mapped.length === 0) {
        toast.error('Nessun invitato valido. Verifica che ci sia almeno una colonna "Nome".')
      }
    } catch (e) {
      toast.error('CSV non leggibile: ' + (e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function doImport() {
    if (validRows.length === 0) return
    setImporting(true)
    let imported = 0
    try {
      // Insert a chunk per evitare payload troppo grosso
      const CHUNK = 100
      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK).map((g) => ({ entry_id: entryId, ...g }))
        const { error, count } = await (supabase.from('event_guests' as any) as any)
          .insert(chunk, { count: 'exact' })
        if (error) throw error
        imported += count ?? chunk.length
      }
      toast.success(`Importati ${imported} invitati`)
      onImported()
      reset()
      setOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setHeaders([])
    setRows([])
    setValidRows([])
    if (fileRef.current) fileRef.current.value = ''
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modello-invitati.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload size={14} /> Importa CSV
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(0 0 0 / 0.4)' }}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <h3 className="font-display text-xl">Importa invitati da CSV</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))]">Riconoscimento automatico colonne (Nome, Email, Telefono, Posti, Lato, Gruppo, Dieta, Note).</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { reset(); setOpen(false) }}>
                <X size={16} />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {validRows.length === 0 ? (
                <>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: 'rgb(var(--border-strong))' }}>
                    <FileText size={32} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
                    <p className="text-sm font-medium mb-1">Trascina qui un file .csv o sceglilo</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">Formato: separatore virgola/punto-e-virgola/tab. Prima riga = intestazioni.</p>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
                    <Button variant="gold" disabled={parsing} onClick={() => fileRef.current?.click()}>
                      {parsing ? 'Analisi…' : 'Scegli file CSV'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[rgb(var(--fg-muted))]">
                    <span>Non sai come strutturarlo?</span>
                    <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                      <Download size={12} /> Scarica modello
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">
                        <strong>{validRows.length}</strong> invitati validi su {rows.length} righe.
                        {rows.length - validRows.length > 0 && (
                          <span className="text-[rgb(var(--fg-muted))]"> ({rows.length - validRows.length} senza nome, ignorati)</span>
                        )}
                      </p>
                      <p className="text-xs text-[rgb(var(--fg-muted))]">Colonne riconosciute: {headers.join(' · ')}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset}>Cambia file</Button>
                  </div>

                  <div className="border rounded-lg overflow-auto max-h-80" style={{ borderColor: 'rgb(var(--border))' }}>
                    <table className="w-full text-xs">
                      <thead className="bg-[rgb(var(--bg-sunken))] sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Nome</th>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium">Telefono</th>
                          <th className="text-left p-2 font-medium">Posti</th>
                          <th className="text-left p-2 font-medium">Lato</th>
                          <th className="text-left p-2 font-medium">Gruppo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validRows.slice(0, 50).map((g, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                            <td className="p-2">{g.full_name}</td>
                            <td className="p-2 text-[rgb(var(--fg-muted))]">{g.email ?? '—'}</td>
                            <td className="p-2 text-[rgb(var(--fg-muted))]">{g.phone ?? '—'}</td>
                            <td className="p-2 text-[rgb(var(--fg-muted))]">{g.party_size ?? 1}</td>
                            <td className="p-2 text-[rgb(var(--fg-muted))]">{g.side ?? '—'}</td>
                            <td className="p-2 text-[rgb(var(--fg-muted))]">{g.group_label ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validRows.length > 50 && (
                      <p className="p-2 text-center text-xs text-[rgb(var(--fg-subtle))]">+ {validRows.length - 50} altri…</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="ghost" onClick={() => { reset(); setOpen(false) }}>Annulla</Button>
              {validRows.length > 0 && (
                <Button variant="gold" disabled={importing} onClick={() => void doImport()}>
                  <Check size={14} /> {importing ? 'Importazione…' : `Importa ${validRows.length} invitati`}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
