import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shareWhatsAppLink } from '@/lib/share'
import { FileSignature, Plus, Save, Trash2, Edit3, ExternalLink, Copy, X, CircleDashed, MessageCircle, Mail } from 'lucide-react'
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

type PendingItem = {
  id: string
  name_snapshot: string
  description_snapshot: string | null
  unit_snapshot: string
  quantity: number
  snapshot_price: number
  line_client: number
  supplier_confirmed_at: string | null
  quote_id: string
  entry_id: string | null
  entry_title: string | null
  event_date: string | null
  client_name: string | null
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
  const [pending, setPending] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<{ title: string; category: string; sections: Section[] }>({
    title: '', category: '', sections: DEFAULT_SECTIONS,
  })

  async function load() {
    setLoading(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      const [{ data: t }, { data: c }, pendingResp] = await Promise.all([
        (supabase.from as any)('supplier_contract_templates').select('*').order('created_at', { ascending: false }),
        (supabase as any).rpc('list_supplier_contracts'),
        me ? (supabase.from as any)('quote_items')
          .select('id, name_snapshot, description_snapshot, unit_snapshot, quantity, snapshot_price, line_client, supplier_confirmed_at, quote_id')
          .eq('supplier_id', me)
          .is('supplier_confirmed_at', null)
          .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setTemplates((t ?? []) as Template[])
      setContracts((c ?? []) as Contract[])

      // Arricchisce le righe pending con dati evento (best effort)
      const items = (pendingResp.data ?? []) as PendingItem[]
      const quoteIds = Array.from(new Set(items.map((x) => x.quote_id))).filter(Boolean)
      if (quoteIds.length > 0) {
        const { data: events } = await (supabase.from as any)('calendar_entries')
          .select('id, title, date_from, client_name, quote_id')
          .in('quote_id', quoteIds)
        const byQuote = new Map<string, any>((events ?? []).map((e: any) => [e.quote_id, e]))
        for (const it of items) {
          const ev = byQuote.get(it.quote_id)
          if (ev) {
            it.entry_id = ev.id
            it.entry_title = ev.title
            it.event_date = ev.date_from
            it.client_name = ev.client_name
          }
        }
      }
      setPending(items)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  function startNew() {
    setDraft({ title: 'Il mio contratto', category: '', sections: DEFAULT_SECTIONS })
    setEditingId('new')
  }
  // Clona il modello di default (per il proprio mestiere, con fallback generico).
  // Il modello contiene i segnaposto {{...}} che si riempiono da soli alla
  // generazione del contratto: anagrafica fornitore/capostipite, dati cliente,
  // voci del preventivo e totale.
  async function cloneDefault() {
    try {
      const { data, error } = await (supabase as any).rpc('clone_suggested_contract_template', {})
      if (error) throw error
      if (data?.error) { toast.error('Nessun modello di default disponibile'); return }
      toast.success('Modello di default aggiunto ai tuoi modelli')
      await load()
    } catch (e) { toast.error((e as Error).message) }
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
  async function emailClient(contractId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('contract-send', { body: { contract_id: contractId } })
      if (error) throw error
      if ((data as any)?.skipped) toast.message('Email non configurata: usa il link o WhatsApp.')
      else toast.success('Email inviata al cliente')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
        <PageHeader eyebrow="Strumenti fornitore" title="Contratti"
          description="Qui trovi i contratti che firmi col cliente. Due casi: (1) clienti tuoi diretti, dopo che hanno firmato il preventivo si passa alla contrattualizzazione; (2) clienti che arrivano da un capostipite che NON gestisce l'intero budget, in cui firmi tu col cliente (il capostipite supervisiona)." />

        {/* Voci preventivo del capostipite da confermare: NON sono contratti → pagina dedicata */}
        {!loading && pending.length > 0 && (
          <Card className="p-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: 'rgb(var(--bg-sunken))' }}>
            <CircleDashed size={20} style={{ color: 'rgb(var(--gold-700))' }} className="shrink-0" />
            <p className="text-sm flex-1">Hai <strong>{new Set(pending.map((p) => p.quote_id)).size}</strong> preventivi di un capostipite <strong>da confermare</strong> (ci sei / forse / no). Non sono contratti.</p>
            <Button variant="outline" asChild className="shrink-0"><Link to="/lavori-da-confermare">Vai a confermare</Link></Button>
          </Card>
        )}

        {/* Templates */}
        <section className="mb-10">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h2 className="font-display text-xl">I miei modelli</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cloneDefault}><Copy size={14} /> Parti da un modello di default</Button>
              <Button variant="gold" onClick={startNew}><Plus size={14} /> Nuovo modello</Button>
            </div>
          </header>
          <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
            I modelli supportano i segnaposto che si compilano da soli alla generazione del contratto:
            <code className="mx-1">{'{{cliente_nome}}'}</code>,
            <code className="mx-1">{'{{fornitore_nome}}'}</code> / <code className="mx-1">{'{{fornitore_piva}}'}</code>,
            <code className="mx-1">{'{{capostipite_nome}}'}</code>,
            <code className="mx-1">{'{{voci_preventivo}}'}</code>,
            <code className="mx-1">{'{{preventivo_totale}}'}</code>,
            <code className="mx-1">{'{{evento_titolo}}'}</code>, <code className="mx-1">{'{{evento_data}}'}</code>.
          </p>

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
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => copyLink(c.access_token)}>
                      <Copy size={12} /> Link firma
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => emailClient(c.id)}>
                      <Mail size={12} /> Email cliente
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => shareWhatsAppLink(
                      `Ciao, ecco il contratto da firmare${c.client_name ? ' per ' + c.client_name : ''}:`,
                      `${location.origin}/p/contract/${c.access_token}`)}>
                      <MessageCircle size={12} /> WhatsApp
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
