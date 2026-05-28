import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSignature, Plus, Save, Trash2, Edit3, ExternalLink, Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

type Section = { heading: string; body: string }

type Template = {
  id: string
  title: string
  category: string | null
  sections: Section[]
  is_default: boolean
}

type Contract = {
  id: string
  title: string
  party_kind: string
  status: string
  client_name: string | null
  event_date: string | null
  total_amount: number | null
  signed_at: string | null
  countersign_at: string | null
  entry_id: string | null
  entry_title: string | null
  access_token: string
  created_at: string
}

const DEFAULT_SECTIONS: Section[] = [
  { heading: 'Oggetto', body: 'Il fornitore si impegna a fornire il servizio descritto per l\'evento indicato in calce.' },
  { heading: 'Corrispettivo', body: 'L\'importo dovuto è quello esposto nel preventivo allegato. Saldo entro la data dell\'evento.' },
  { heading: 'Obblighi del fornitore', body: 'Garantire qualità professionale del servizio, puntualità e rispetto degli accordi.' },
  { heading: 'Recesso', body: 'Recesso oltre 90gg dall\'evento: 30% acconto trattenuto. Entro 90gg: 100%.' },
]

export default function SupplierContractsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<{ title: string; category: string; sections: Section[] }>({
    title: '', category: '', sections: DEFAULT_SECTIONS,
  })

  async function load() {
    setLoading(true)
    try {
      const [{ data: t }, { data: c }] = await Promise.all([
        (supabase.from as any)('supplier_contract_templates').select('*').order('created_at', { ascending: false }),
        (supabase as any).rpc('list_supplier_contracts'),
      ])
      setTemplates((t ?? []) as Template[])
      setContracts((c ?? []) as Contract[])
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  function startNew() {
    setDraft({ title: 'Il mio contratto', category: '', sections: DEFAULT_SECTIONS })
    setEditingId('new')
  }
  function startEdit(t: Template) {
    setDraft({ title: t.title, category: t.category ?? '', sections: t.sections })
    setEditingId(t.id)
  }
  async function saveTemplate() {
    if (!draft.title.trim()) { toast.error('Titolo richiesto'); return }
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) throw new Error('no auth')
      if (editingId === 'new') {
        const { error } = await (supabase.from as any)('supplier_contract_templates').insert({
          fornitore_id: me, title: draft.title, category: draft.category || null, sections: draft.sections,
        })
        if (error) throw error
        toast.success('Modello creato')
      } else {
        const { error } = await (supabase.from as any)('supplier_contract_templates').update({
          title: draft.title, category: draft.category || null, sections: draft.sections,
        }).eq('id', editingId)
        if (error) throw error
        toast.success('Modello aggiornato')
      }
      setEditingId(null)
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }
  async function deleteTemplate(id: string) {
    if (!confirm('Eliminare questo modello? I contratti già firmati restano validi.')) return
    try {
      const { error } = await (supabase.from as any)('supplier_contract_templates').delete().eq('id', id)
      if (error) throw error
      toast.success('Modello eliminato')
      await load()
    } catch (e) { toast.error((e as Error).message) }
  }
  function patchSection(i: number, patch: Partial<Section>) {
    setDraft((d) => ({ ...d, sections: d.sections.map((s, idx) => idx === i ? { ...s, ...patch } : s) }))
  }
  function addSection() {
    setDraft((d) => ({ ...d, sections: [...d.sections, { heading: 'Nuova clausola', body: '' }] }))
  }
  function removeSection(i: number) {
    setDraft((d) => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) }))
  }

  function copyLink(token: string) {
    const url = `${location.origin}/p/contract/${token}`
    void navigator.clipboard.writeText(url)
    toast.success('Link firma copiato')
  }

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
        <PageHeader eyebrow="Strumenti fornitore" title="Contratti" description="Crea modelli personalizzati e gestisci i contratti firmati con clienti o wedding planner." />

        {/* Templates */}
        <section className="mb-10">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl">I miei modelli</h2>
            <Button variant="gold" onClick={startNew}><Plus size={14} /> Nuovo modello</Button>
          </header>

          {editingId !== null && (
            <Card className="p-5 mb-4 border-2 border-[rgb(var(--gold-500))]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label>Titolo modello *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Es. Contratto fotografo wedding base" />
                </div>
                <div className="space-y-1">
                  <Label>Categoria (facoltativa)</Label>
                  <Input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="Es. fotografia, musica, fiori..." />
                </div>
              </div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Sezioni / clausole</p>
              <div className="space-y-2 mb-3">
                {draft.sections.map((s, i) => (
                  <div key={i} className="border rounded-lg p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Input value={s.heading} onChange={(e) => patchSection(i, { heading: e.target.value })} className="font-medium" />
                      <Button variant="ghost" size="icon" onClick={() => removeSection(i)}><X size={14} /></Button>
                    </div>
                    <Textarea rows={3} value={s.body} onChange={(e) => patchSection(i, { body: e.target.value })} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSection}><Plus size={12} /> Aggiungi clausola</Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingId(null)}>Annulla</Button>
                <Button variant="gold" onClick={saveTemplate}><Save size={14} /> Salva modello</Button>
              </div>
            </Card>
          )}

          {!loading && templates.length === 0 && editingId === null && (
            <Card className="p-8 text-center text-[rgb(var(--fg-muted))]">
              <FileSignature size={28} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
              Nessun modello. Creane uno per ogni tipologia di servizio che offri.
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-4">
                <header className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-display text-base">{t.title}</h3>
                    {t.category && <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-600))]">{t.category}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Edit3 size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteTemplate(t.id)}><Trash2 size={14} /></Button>
                  </div>
                </header>
                <p className="text-xs text-[rgb(var(--fg-muted))]">{t.sections.length} clausole</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Contracts received/created */}
        <section>
          <header className="mb-3"><h2 className="font-display text-xl">I miei contratti</h2></header>
          {!loading && contracts.length === 0 && (
            <Card className="p-8 text-center text-[rgb(var(--fg-muted))]">
              Nessun contratto ancora. Quando un WP ti coinvolge in un wedding (GLOBAL), oppure quando crei tu un contratto standalone, lo trovi qui.
            </Card>
          )}
          <div className="space-y-2">
            {contracts.map((c) => {
              const kindLabel =
                c.party_kind === 'SUPPLIER_WP' ? '↔ Wedding Planner'
                : c.party_kind === 'SUPPLIER_CLIENT' ? '↔ Cliente'
                : c.party_kind
              return (
                <Card key={c.id} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{c.title}</h3>
                    <p className="text-xs text-[rgb(var(--fg-muted))]">
                      {kindLabel} · {c.entry_title ?? 'evento'}{c.event_date && ` · ${new Date(c.event_date).toLocaleDateString('it-IT')}`}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background:
                            c.status === 'FIRMATO' ? 'rgb(34 197 94 / 0.18)'
                            : c.status === 'INVIATO' ? 'rgb(var(--gold-100))'
                            : 'rgb(var(--bg-sunken))',
                          color:
                            c.status === 'FIRMATO' ? 'rgb(34 197 94)'
                            : c.status === 'INVIATO' ? 'rgb(var(--gold-700))'
                            : 'rgb(var(--fg-muted))',
                        }}>
                        {c.status}
                      </span>
                      {c.signed_at && <span className="text-[10px] ml-2 text-[rgb(var(--fg-subtle))]">firmato il {new Date(c.signed_at).toLocaleDateString('it-IT')}</span>}
                      {c.countersign_at && <span className="text-[10px] ml-2 text-[rgb(var(--fg-subtle))]">controfirmato il {new Date(c.countersign_at).toLocaleDateString('it-IT')}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => copyLink(c.access_token)}>
                      <Copy size={12} /> Link firma
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/p/contract/${c.access_token}`} target="_blank">
                        <ExternalLink size={12} /> Apri
                      </Link>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
