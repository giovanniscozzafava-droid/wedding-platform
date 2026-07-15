import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSignature, FileDown, X, Copy, Mail, MessageCircle, Sparkles } from 'lucide-react'
import { shareWhatsAppLink } from '@/lib/share'
import { waContractToClient } from '@/lib/waMessages'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchFilterBar } from '@/components/common/SearchFilterBar'
import { supabase } from '@/lib/supabase'

type ContractRow = {
  id: string
  quote_id?: string | null
  title: string | null
  client_name: string | null
  client_email: string | null
  client_fiscal_code?: string | null
  event_date: string | null
  total_amount: number | null
  status: string | null
  signed_at: string | null
  pdf_url: string | null
  access_token?: string | null
  sections?: Array<{ heading?: string; body?: string }> | null
  signature_data?: Record<string, unknown> | null
  created_at: string
}

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContractRow | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'signed' | 'unsigned'>('all')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((c) => {
      if (statusFilter === 'signed' && !c.signed_at) return false
      if (statusFilter === 'unsigned' && c.signed_at) return false
      if (q && !`${c.title ?? ''} ${c.client_name ?? ''} ${c.client_email ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, statusFilter])

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('contracts' as any) as any)
        .select('id, quote_id, title, client_name, client_email, client_fiscal_code, event_date, total_amount, status, signed_at, pdf_url, access_token, sections, signature_data, created_at')
        .order('created_at', { ascending: false })
      setRows((data ?? []) as ContractRow[])
      setLoading(false)
    })()
  }, [])

  // Cambio card = contesto pulito: azzera l'editing e tiene un ref dell'id aperto ORA, così le operazioni
  // async (AI) applicano il risultato solo alla card su cui sono partite, non a quella aperta nel frattempo.
  const openIdRef = useRef<string | null>(null)
  useEffect(() => { openIdRef.current = selected?.id ?? null; setEditMode(false) }, [selected?.id])

  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftSections, setDraftSections] = useState<Array<{ heading?: string; body?: string }>>([])
  const [savingEdit, setSavingEdit] = useState(false)

  function startEdit() {
    if (!selected) return
    setDraftTitle(selected.title ?? '')
    setDraftSections(Array.isArray(selected.sections) ? selected.sections.map((s) => ({ ...s })) : [])
    setEditMode(true)
  }
  function setSection(i: number, k: 'heading' | 'body', v: string) {
    setDraftSections((xs) => xs.map((s, j) => j === i ? { ...s, [k]: v } : s))
  }
  function addSection() { setDraftSections((xs) => [...xs, { heading: 'Nuova clausola', body: '' }]) }
  function removeSection(i: number) { setDraftSections((xs) => xs.filter((_, j) => j !== i)) }
  function moveSection(i: number, dir: -1 | 1) {
    setDraftSections((xs) => {
      const j = i + dir; if (j < 0 || j >= xs.length) return xs
      const copy = [...xs]; const t = copy[i]!; copy[i] = copy[j]!; copy[j] = t; return copy
    })
  }
  async function saveEdit() {
    if (!selected) return
    setSavingEdit(true)
    try {
      const { error } = await (supabase.from('contracts' as any) as any)
        .update({ title: draftTitle.trim() || selected.title, sections: draftSections, updated_at: new Date().toISOString() })
        .eq('id', selected.id)
      if (error) throw error
      setRows((rs) => rs.map((r) => r.id === selected.id ? { ...r, title: draftTitle.trim() || r.title, sections: draftSections } : r))
      setSelected((s) => s ? { ...s, title: draftTitle.trim() || s.title, sections: draftSections } : s)
      setEditMode(false)
      toast.success('Contratto aggiornato. Rigenera il PDF per applicare le modifiche.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    } finally { setSavingEdit(false) }
  }

  // Compila con AI dal preventivo. Se il contratto ha già un FORMAT (le sezioni del professionista, es. da
  // un suo modello), l'AI RIFINISCE quel format inserendo i dati reali senza stravolgerlo; se è vuoto,
  // genera da zero ribaltando tutto il preventivo (dati fiscali, parti, offerta, importi).
  const [aiBusy, setAiBusy] = useState(false)
  async function aiFill() {
    if (!selected) return
    // Cattura la card SU CUI parte l'AI: da qui in poi si opera solo su questo id, mai su "selected" corrente.
    const cid = selected.id
    const qid = selected.quote_id
    const label = selected.title ?? 'contratto'
    const hasFormat = Array.isArray(selected.sections) && selected.sections.some((s) => (s?.body ?? '').trim() || (s?.heading ?? '').trim())
    const secsIn = hasFormat ? selected.sections : undefined
    if (!qid) { toast.error('Contratto senza preventivo collegato: l’AI non può ribaltarne i dati'); return }
    if (selected.status === 'FIRMATO') { toast.error('Contratto firmato: non modificabile'); return }
    if (!confirm(hasFormat
      ? 'L’AI compila i dati reali del preventivo nel TUO format di contratto, migliorandone la forma senza stravolgerlo.\n\nContinuo?'
      : 'L’AI ribalta tutti i dati del preventivo nel contratto (dati fiscali, offerta, importi) e scrive le clausole.\n\nContinuo?')) return
    setAiBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('contract-ai-draft', { body: { quote_id: qid, sections: secsIn } })
      if (error) throw new Error(error.message)
      const r = data as { ok?: boolean; sections?: Array<{ heading?: string; body?: string }>; error?: string }
      if (!r?.ok) {
        const map: Record<string, string> = {
          no_ai_key: 'AI non ancora configurata.', forbidden: 'Non sei il proprietario del preventivo.',
          quote_not_found: 'Preventivo non trovato.', ai_error: 'Errore del servizio AI.', no_quote: 'Contratto senza preventivo collegato.',
          quote_query: 'Errore nel leggere il preventivo.', parse: 'Risposta AI non interpretabile.', empty: 'Nessuna sezione generata.',
        }
        throw new Error(map[r?.error ?? ''] ?? ('Compilazione AI non riuscita: ' + (r?.error ?? '')))
      }
      const secs = r.sections ?? []
      // Il DB e la lista si aggiornano SEMPRE sulla card di partenza (cid), non su quella aperta ora.
      const { error: upErr } = await (supabase.from('contracts' as any) as any)
        .update({ sections: secs, updated_at: new Date().toISOString() }).eq('id', cid)
      if (upErr) throw upErr
      setRows((rs) => rs.map((x) => x.id === cid ? { ...x, sections: secs } : x))
      // La UI aperta si aggiorna solo se stai ancora guardando quella stessa card.
      if (openIdRef.current === cid) {
        setSelected((s) => (s && s.id === cid) ? { ...s, sections: secs } : s)
        if (editMode) setDraftSections(secs)
        toast.success('Contratto compilato dall’AI dal preventivo — rivedilo prima di inviare')
      } else {
        toast.success(`"${label}" compilato dall’AI — riaprilo per rivederlo`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Compilazione AI non riuscita')
    } finally { setAiBusy(false) }
  }

  function copyClientLink(token: string | null | undefined) {
    if (!token) { toast.error('Nessun link cliente disponibile'); return }
    const url = `${window.location.origin}/p/contract/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiato negli appunti')).catch(() => toast.error('Impossibile copiare'))
  }

  const [sendingEmail, setSendingEmail] = useState(false)
  async function emailClient(contractId: string) {
    setSendingEmail(true)
    try {
      const { data, error } = await supabase.functions.invoke('contract-send', { body: { contract_id: contractId } })
      if (error) throw error
      if ((data as any)?.skipped) toast.message('Email non configurata: usa il link firma o WhatsApp.')
      else toast.success('Email inviata al cliente con il link di firma')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invio email fallito')
    } finally { setSendingEmail(false) }
  }

  async function generatePdf(contractId: string) {
    setGeneratingPdf(true)
    try {
      const { data, error } = await supabase.functions.invoke('contract-generate-pdf', {
        body: { contract_id: contractId },
      })
      if (error) throw error
      const url = (data as { pdf_url?: string })?.pdf_url
      if (!url) throw new Error('PDF non generato')
      toast.success('PDF contratto generato')
      // Aggiorna riga in stato locale + apre PDF
      setRows((rs) => rs.map((r) => r.id === contractId ? { ...r, pdf_url: url } : r))
      setSelected((s) => s && s.id === contractId ? { ...s, pdf_url: url } : s)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore generazione PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const fmtEUR = (n: number | null) => n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      <PageHeader title="Contratti" description="Documenti firmati e in attesa di firma" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <FileSignature size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <h3 className="font-display text-lg">Ancora nessun contratto</h3>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
            I contratti vengono generati dal preventivo accettato. Apri un preventivo nello stato ACCETTATO e converti in contratto.
          </p>
        </Card>
      ) : (
        <>
          <SearchFilterBar value={search} onChange={setSearch} placeholder="Cerca per nome cliente, email o titolo…"
            chips={[{ key: 'all', label: 'Tutti' }, { key: 'signed', label: 'Firmati' }, { key: 'unsigned', label: 'Da firmare' }]}
            active={statusFilter} onChip={(k) => setStatusFilter(k as 'all' | 'signed' | 'unsigned')} />
          {filtered.length === 0 ? (
            <p className="text-sm text-[rgb(var(--fg-muted))] text-center py-8">Nessun contratto corrisponde ai filtri.</p>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="block w-full text-left"
                data-testid={`contract-card-${c.id}`}
              >
                <Card className="p-5 cursor-pointer hover:shadow-[var(--shadow-lift)] hover:border-[rgb(var(--gold-500))] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <FileSignature size={18} className="text-[rgb(var(--gold-600))]" />
                    <Badge status={c.status ?? 'BOZZA'} />
                  </div>
                  <h3 className="font-display text-lg leading-tight mb-1">{c.title ?? 'Contratto'}</h3>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{c.client_name ?? '—'}{c.client_email ? ` · ${c.client_email}` : ''}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Importo</p>
                      <p className="font-medium tabular-nums">{fmtEUR(c.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Evento</p>
                      <p className="font-medium">{fmtDate(c.event_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-[rgb(var(--fg-subtle))]">
                      {c.signed_at ? `Firmato ${fmtDate(c.signed_at)}` : `Creato ${fmtDate(c.created_at)}`}
                    </span>
                    {c.pdf_url && <FileDown size={11} className="text-[rgb(var(--gold-600))]" />}
                  </div>
                </Card>
              </button>
            </motion.div>
          ))}
          </div>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelected(null)}>
          <div className="surface surface-elev max-w-3xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-xl truncate">{selected.title ?? 'Contratto'}</h2>
                  <Badge status={selected.status ?? 'BOZZA'} />
                </div>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                  {selected.client_name ?? '—'}
                  {selected.client_email && ` · ${selected.client_email}`}
                  {selected.client_fiscal_code && ` · CF ${selected.client_fiscal_code}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Chiudi"><X size={18} /></Button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Importo totale</p>
                  <p className="font-display text-xl tabular-nums">{fmtEUR(selected.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Data evento</p>
                  <p className="font-medium">{fmtDate(selected.event_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Stato firma</p>
                  <p className="font-medium">
                    {selected.signed_at ? `Firmato ${fmtDate(selected.signed_at)}` : 'In attesa'}
                  </p>
                </div>
              </div>

              {selected.status === 'FIRMATO' && selected.signature_data && (
                <Card className="p-4" style={{ background: 'rgb(var(--sage-100) / 0.4)' }}>
                  <p className="text-sm font-medium flex items-center gap-2"><FileSignature size={14} /> Atto firmato — readonly</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                    Il contratto è stato firmato dal cliente. Non può più essere modificato per garantire l'integrità legale (CAD art. 20).
                  </p>
                </Card>
              )}

              {editMode ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))]">Titolo</label>
                    <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base">Clausole (modificabili)</h3>
                    <button onClick={addSection} className="text-xs inline-flex items-center gap-1 text-[rgb(var(--gold-600))]">+ Aggiungi clausola</button>
                  </div>
                  {draftSections.map((s, i) => (
                    <section key={i} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[rgb(var(--fg-subtle))]">{i + 1}.</span>
                        <input value={s.heading ?? ''} onChange={(e) => setSection(i, 'heading', e.target.value)} placeholder="Titolo clausola"
                          className="flex-1 text-sm font-medium px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
                        <button onClick={() => moveSection(i, -1)} className="text-xs text-[rgb(var(--fg-subtle))] px-1" title="Su">↑</button>
                        <button onClick={() => moveSection(i, 1)} className="text-xs text-[rgb(var(--fg-subtle))] px-1" title="Giù">↓</button>
                        <button onClick={() => removeSection(i)} className="text-xs text-[rgb(var(--rose-500))] px-1" title="Elimina">✕</button>
                      </div>
                      <textarea value={s.body ?? ''} onChange={(e) => setSection(i, 'body', e.target.value)} rows={5}
                        className="w-full text-sm px-2 py-1.5 rounded border bg-transparent leading-relaxed" style={{ borderColor: 'rgb(var(--border))' }} />
                    </section>
                  ))}
                </div>
              ) : Array.isArray(selected.sections) && selected.sections.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-display text-base">Clausole</h3>
                  {selected.sections.map((s, i) => (
                    <section key={i} className="border-l-2 pl-4" style={{ borderColor: 'rgb(var(--gold-500))' }}>
                      <h4 className="font-medium text-sm">{i + 1}. {s.heading ?? 'Sezione'}</h4>
                      {s.body && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 whitespace-pre-line leading-relaxed">{s.body}</p>}
                    </section>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[rgb(var(--fg-subtle))] italic">Nessuna sezione inserita.</p>
              )}
            </div>

            <div className="border-t p-4 flex flex-wrap items-center justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
              {selected.status !== 'FIRMATO' && (
                editMode ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} disabled={savingEdit}>Annulla</Button>
                    <Button variant="gold" size="sm" onClick={saveEdit} disabled={savingEdit} className="mr-auto">
                      {savingEdit ? 'Salvataggio…' : 'Salva modifiche'}
                    </Button>
                  </>
                ) : (
                  <div className="mr-auto flex flex-wrap items-center gap-2">
                    <Button variant="gold" size="sm" onClick={aiFill} disabled={aiBusy}
                      title="Ribalta tutti i dati del preventivo nel contratto: dati fiscali, offerta, importi">
                      <Sparkles size={14} /> {aiBusy ? 'Compilo…' : 'Compila con AI dal preventivo'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={startEdit}>Modifica testo</Button>
                  </div>
                )
              )}
              <Button variant="outline" size="sm" onClick={() => generatePdf(selected.id)} disabled={generatingPdf}>
                <FileDown size={14} /> {generatingPdf ? 'Generazione…' : selected.pdf_url ? 'Rigenera PDF' : 'Genera PDF contratto'}
              </Button>
              {selected.access_token && selected.status !== 'FIRMATO' && (
                <Button variant="outline" size="sm" onClick={() => copyClientLink(selected.access_token)}>
                  <Copy size={14} /> Copia link firma cliente
                </Button>
              )}
              {selected.client_email && (
                <Button variant="outline" size="sm" onClick={() => emailClient(selected.id)} disabled={sendingEmail}>
                  <Mail size={14} /> {sendingEmail ? 'Invio…' : 'Email cliente'}
                </Button>
              )}
              {(selected.pdf_url || selected.access_token) && (
                <Button variant="outline" size="sm" onClick={() => shareWhatsAppLink(
                  waContractToClient({ clientName: selected.client_name, title: selected.title }),
                  selected.pdf_url ?? `${window.location.origin}/p/contract/${selected.access_token}`)}>
                  <MessageCircle size={14} /> WhatsApp
                </Button>
              )}
              {selected.pdf_url && (
                <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium"
                  style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
                  <FileDown size={14} /> Apri PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
