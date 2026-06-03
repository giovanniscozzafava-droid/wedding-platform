// FASE 3.1 — Tab Pagamenti del WeddingDashboard.
// Mostra lo scadenzario (tabella scadenzario_voci) dell'evento, con stato pagato,
// scadenze, debitore/creditore. Mobile-first: una colonna su mobile, touch >=44px.

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Wallet, CheckCircle2, CircleDashed, Calendar, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Tipo = 'ACCONTO' | 'SALDO' | 'RATA' | 'PENALE' | 'RIMBORSO'

type Voce = {
  id: string
  entry_id: string
  titolo: string
  descrizione: string | null
  importo_eur: number
  tipo: Tipo
  debitore_id: string | null
  creditore_id: string | null
  scadenza: string | null
  pagato: boolean
  pagato_il: string | null
  metodo: string | null
  note: string | null
  created_at: string
}

const TIPO_LABEL: Record<Tipo, string> = {
  ACCONTO: 'Acconto',
  SALDO: 'Saldo',
  RATA: 'Rata',
  PENALE: 'Penale',
  RIMBORSO: 'Rimborso',
}

const TIPO_COLORS: Record<Tipo, { bg: string; fg: string }> = {
  ACCONTO:  { bg: 'rgb(var(--gold-100))',   fg: 'rgb(var(--gold-700))' },
  SALDO:    { bg: 'rgb(34 197 94 / 0.16)',  fg: 'rgb(22 163 74)' },
  RATA:     { bg: 'rgb(var(--bg-sunken))',  fg: 'rgb(var(--fg))' },
  PENALE:   { bg: 'rgb(220 38 38 / 0.16)',  fg: 'rgb(220 38 38)' },
  RIMBORSO: { bg: 'rgb(59 130 246 / 0.16)', fg: 'rgb(37 99 235)' },
}

export function PagamentiTab({ entryId }: { entryId: string }) {
  const [voci, setVoci] = useState<Voce[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [profiles, setProfiles] = useState<Array<{ id: string; nome: string }>>([])

  // form draft
  const emptyDraft = {
    titolo: '',
    descrizione: '',
    importo_eur: '',
    tipo: 'ACCONTO' as Tipo,
    debitore_id: '',
    creditore_id: '',
    scadenza: '',
    metodo: '',
    note: '',
  }
  const [draft, setDraft] = useState(emptyDraft)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const { data, error } = await (supabase.from as any)('scadenzario_voci')
        .select('*')
        .eq('entry_id', entryId)
        .order('scadenza', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      setVoci((data ?? []) as Voce[])

      // profili coinvolti per visualizzare nome debitore/creditore
      const ids = Array.from(new Set(
        (data ?? []).flatMap((v: any) => [v.debitore_id, v.creditore_id]).filter(Boolean),
      ))
      if (ids.length > 0) {
        const { data: pData } = await (supabase.from as any)('profiles')
          .select('id, full_name, business_name')
          .in('id', ids)
        setProfiles((pData ?? []).map((p: any) => ({
          id: p.id,
          nome: p.business_name || p.full_name || 'Senza nome',
        })))
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // Polling silenzioso: scadenze/pagamenti aggiornati da altri attori dell'evento.
    const t = setInterval(() => { void load(true) }, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  async function addVoce() {
    if (!draft.titolo.trim()) return toast.error('Titolo richiesto')
    const importo = Number(draft.importo_eur)
    if (!Number.isFinite(importo) || importo < 0) return toast.error('Importo non valido')

    try {
      const payload: any = {
        entry_id: entryId,
        titolo: draft.titolo.trim(),
        descrizione: draft.descrizione.trim() || null,
        importo_eur: importo,
        tipo: draft.tipo,
        debitore_id: draft.debitore_id || null,
        creditore_id: draft.creditore_id || null,
        scadenza: draft.scadenza || null,
        metodo: draft.metodo.trim() || null,
        note: draft.note.trim() || null,
      }
      const { error } = await (supabase.from as any)('scadenzario_voci').insert(payload)
      if (error) throw error
      toast.success('Voce aggiunta')
      setDraft(emptyDraft)
      setShowForm(false)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function togglePagato(v: Voce) {
    try {
      const { error } = await (supabase.from as any)('scadenzario_voci')
        .update({ pagato: !v.pagato })
        .eq('id', v.id)
      if (error) throw error
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  async function delVoce(v: Voce) {
    if (!confirm(`Eliminare "${v.titolo}"?`)) return
    try {
      const { error } = await (supabase.from as any)('scadenzario_voci').delete().eq('id', v.id)
      if (error) throw error
      toast.success('Voce eliminata')
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }

  const totals = useMemo(() => {
    const totale = voci.reduce((s, v) => s + Number(v.importo_eur), 0)
    const incassato = voci.filter((v) => v.pagato).reduce((s, v) => s + Number(v.importo_eur), 0)
    const da_incassare = totale - incassato
    return { totale, incassato, da_incassare }
  }, [voci])

  const nameOf = (id: string | null) => id ? (profiles.find((p) => p.id === id)?.nome ?? '—') : '—'

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Header + totali */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgb(var(--gold-600))' }}>
            Scadenzario
          </div>
          <h2 className="font-display text-xl mt-1">Pagamenti</h2>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
            Acconti, saldi, penali e rimborsi previsti per questo evento.
          </p>
        </div>
        <Button variant="gold" onClick={() => setShowForm((s) => !s)} className="min-h-[44px]">
          <Plus size={14} /> Aggiungi voce
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">Totale previsto</div>
          <div className="font-display text-2xl tabular-nums mt-1">
            € {totals.totale.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">Incassato</div>
          <div className="font-display text-2xl tabular-nums mt-1" style={{ color: 'rgb(22 163 74)' }}>
            € {totals.incassato.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">Da incassare</div>
          <div className="font-display text-2xl tabular-nums mt-1" style={{ color: 'rgb(var(--gold-700))' }}>
            € {totals.da_incassare.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
          </div>
        </Card>
      </div>

      {/* Form aggiungi voce */}
      {showForm && (
        <Card className="p-4 border-2" style={{ borderColor: 'rgb(var(--gold-500))' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Titolo *</Label>
              <Input value={draft.titolo}
                onChange={(e) => setDraft((d) => ({ ...d, titolo: e.target.value }))}
                placeholder="Es. Acconto 30% preventivo" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={draft.tipo}
                onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value as Tipo }))}>
                {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Importo (€) *</Label>
              <Input type="number" min="0" step="0.01" value={draft.importo_eur}
                onChange={(e) => setDraft((d) => ({ ...d, importo_eur: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Scadenza</Label>
              <Input type="date" value={draft.scadenza}
                onChange={(e) => setDraft((d) => ({ ...d, scadenza: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Metodo</Label>
              <Input value={draft.metodo}
                onChange={(e) => setDraft((d) => ({ ...d, metodo: e.target.value }))}
                placeholder="Bonifico / Contanti / Carta" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrizione</Label>
              <Textarea rows={2} value={draft.descrizione}
                onChange={(e) => setDraft((d) => ({ ...d, descrizione: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => { setShowForm(false); setDraft(emptyDraft) }} className="min-h-[44px]">
              Annulla
            </Button>
            <Button variant="gold" onClick={addVoce} className="min-h-[44px]">
              <Plus size={14} /> Salva voce
            </Button>
          </div>
        </Card>
      )}

      {/* Lista voci */}
      {loading && <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento…</p>}

      {!loading && voci.length === 0 && (
        <Card className="p-8 text-center text-[rgb(var(--fg-muted))]">
          <Wallet size={28} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
          <p className="text-sm">Nessun pagamento ancora pianificato.</p>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
            Aggiungi acconti, saldi e rate previsti per tenere sotto controllo i flussi.
          </p>
        </Card>
      )}

      {!loading && voci.length > 0 && (
        <div className="space-y-2">
          {voci.map((v) => {
            const c = TIPO_COLORS[v.tipo]
            const isOverdue = !v.pagato && v.scadenza && v.scadenza < today
            return (
              <Card key={v.id} className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* status pill */}
                  <button onClick={() => togglePagato(v)}
                    className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition"
                    style={{ background: v.pagato ? 'rgb(34 197 94 / 0.18)' : 'rgb(var(--bg-sunken))' }}
                    aria-label={v.pagato ? 'Segna come non pagato' : 'Segna come pagato'}>
                    {v.pagato
                      ? <CheckCircle2 size={20} style={{ color: 'rgb(22 163 74)' }} />
                      : <CircleDashed size={20} style={{ color: 'rgb(var(--fg-muted))' }} />}
                  </button>

                  {/* main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        style={{ background: c.bg, color: c.fg }}>
                        {TIPO_LABEL[v.tipo]}
                      </span>
                      <h3 className="font-medium text-sm">{v.titolo}</h3>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color: 'rgb(220 38 38)' }}>
                          <AlertTriangle size={10} /> Scaduto
                        </span>
                      )}
                    </div>
                    {v.descrizione && (
                      <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-2">{v.descrizione}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[rgb(var(--fg-subtle))]">
                      {v.scadenza && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} /> {new Date(v.scadenza).toLocaleDateString('it-IT')}
                        </span>
                      )}
                      {v.debitore_id && <span>da: {nameOf(v.debitore_id)}</span>}
                      {v.creditore_id && <span>a: {nameOf(v.creditore_id)}</span>}
                      {v.metodo && <span>· {v.metodo}</span>}
                    </div>
                  </div>

                  {/* amount + delete */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                    <div className="font-display text-lg tabular-nums">
                      € {Number(v.importo_eur).toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => delVoce(v)}
                      className="min-h-[44px] min-w-[44px]" aria-label="Elimina voce">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
