import { useEffect, useState } from 'react'
import { FileSignature, Send, Plus, Lock, MessageCircle, BookMarked, Wand2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useContractMutations, useContracts } from '@/hooks/useWedding'
import { shareWhatsAppLink } from '@/lib/share'
import { waContractToClient } from '@/lib/waMessages'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { HelpDot } from '@/components/help/HelpDot'

// Placeholder che il sistema riempie da solo (dati fiscali, date, offerte, prezzi).
const PLACEHOLDERS: Array<{ k: string; d: string }> = [
  { k: '{{cliente_nome}}', d: 'Nome cliente' }, { k: '{{cliente_email}}', d: 'Email cliente' },
  { k: '{{capostipite_nome}}', d: 'Tua ragione sociale' }, { k: '{{capostipite_piva}}', d: 'Tua P.IVA' },
  { k: '{{capostipite_cf}}', d: 'Tuo cod. fiscale' }, { k: '{{capostipite_indirizzo}}', d: 'Tuo indirizzo' },
  { k: '{{evento_titolo}}', d: 'Titolo evento' }, { k: '{{evento_data}}', d: 'Data evento' }, { k: '{{evento_luogo}}', d: 'Luogo evento' },
  { k: '{{voci_preventivo}}', d: 'Offerte scelte (elenco)' }, { k: '{{preventivo_totale}}', d: 'Totale €' },
]
const sbt = (): any => (supabase as any).from('supplier_contract_templates')

const STANDARD_SECTIONS = [
  { heading: 'Oggetto del contratto', body: 'Organizzazione e coordinamento dell\'evento matrimoniale come specificato nel preventivo allegato.', type: 'CLAUSULE' },
  { heading: 'Corrispettivo e modalita\' di pagamento', body: '30% alla firma, 40% 60 giorni prima dell\'evento, 30% il giorno dell\'evento.', type: 'PRICE' },
  { heading: 'Cancellazione', body: 'In caso di disdetta entro 90 giorni dall\'evento, viene trattenuto il 50% dell\'acconto. Oltre tale termine il 100%.', type: 'TERMS' },
  { heading: 'Forza maggiore', body: 'Le parti convengono di rinegoziare termini in caso di eventi imprevedibili (pandemia, calamita\').', type: 'TERMS' },
]

export function ContractTab({ wedding }: { wedding: any }) {
  const { data: contracts } = useContracts(wedding.quote?.id ?? null)
  const { create, update, send } = useContractMutations()
  const { profile } = useAuth()
  const me = profile?.id ?? null
  const [editing, setEditing] = useState<any | null>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [tplReload, setTplReload] = useState(0)

  useEffect(() => {
    if (!me) return
    let alive = true
    ;(async () => {
      const { data } = await sbt().select('id, title, sections').eq('fornitore_id', me).order('created_at', { ascending: false })
      if (alive) setTemplates(data ?? [])
    })()
    return () => { alive = false }
  }, [me, tplReload])

  // Un solo passaggio server: unisce heading+body di tutte le sezioni, sostituisce i {{...}}, ridivide.
  async function mergeSections(sections: any[]): Promise<any[]> {
    const SEP = '␞', ROW = '␟'
    const joined = sections.map((s) => `${s.heading ?? ''}${SEP}${s.body ?? ''}`).join(ROW)
    const { data } = await (supabase as any).rpc('contract_fill_text', { p_text: joined, p_entry_id: wedding.id, p_supplier_id: me })
    const rows = String(data ?? joined).split(ROW)
    return sections.map((s, i) => { const [h, b] = (rows[i] ?? `${s.heading ?? ''}${SEP}${s.body ?? ''}`).split(SEP); return { ...s, heading: h ?? s.heading, body: b ?? s.body } })
  }

  async function createFromTemplate(tpl: any) {
    try {
      const merged = await mergeSections(tpl.sections ?? [])
      const c = await create.mutateAsync({
        title: `${tpl.title} · ${wedding.title}`, quote_id: wedding.quote?.id, entry_id: wedding.id,
        client_name: wedding.client_name, client_email: wedding.client_email, event_date: wedding.date_from,
        total_amount: wedding.quote?.total_client ?? 0, sections: merged as any,
      })
      setEditing(c); toast.success('Bozza creata dal modello (dati importati)')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function saveAsTemplate() {
    if (!editing || !me) return
    const title = prompt('Nome del modello (es. "Contratto matrimonio location")', editing.title?.replace(/ · .*/, '') || 'Mio modello')
    if (!title) return
    // salva le sezioni come sono (con i {{...}} se li hai lasciati → riutilizzabili)
    const { error } = await sbt().insert({ fornitore_id: me, title, category: 'EVENTO', sections: editing.sections })
    if (error) return toast.error('Salvataggio modello non riuscito')
    toast.success('Modello salvato: lo ritrovi in "Nuova da modello"'); setTplReload((x) => x + 1)
  }

  async function fillData() {
    if (!editing) return
    try { setEditing({ ...editing, sections: await mergeSections(editing.sections ?? []) }); toast.success('Dati importati nelle sezioni') }
    catch { toast.error('Import non riuscito') }
  }

  const [aiBusy, setAiBusy] = useState(false)
  // Perfeziona con AI (Qwen): ribalta offerta + dati del preventivo → sezioni di contratto pronte.
  async function aiDraft() {
    if (!editing || !wedding.quote?.id) { toast.error('Serve un preventivo collegato'); return }
    setAiBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('contract-ai-draft', { body: { quote_id: wedding.quote.id } })
      if (error) throw new Error(error.message)
      const r = data as { ok?: boolean; sections?: any[]; error?: string }
      if (!r?.ok) {
        const map: Record<string, string> = {
          no_ai_key: 'AI non ancora configurata.', forbidden: 'Non sei il proprietario del preventivo.',
          quote_not_found: 'Preventivo non trovato.', ai_error: 'Errore del servizio AI.',
          parse: 'Risposta AI non interpretabile.', empty: 'Nessuna sezione generata.',
        }
        throw new Error(map[r?.error ?? ''] ?? ('Bozza AI non riuscita: ' + (r?.error ?? '')))
      }
      setEditing({ ...editing, sections: r.sections })
      toast.success('Bozza generata dall’AI — rivedila prima di inviare')
    } catch (e) { toast.error((e as Error).message) }
    finally { setAiBusy(false) }
  }

  async function createFromQuote() {
    try {
      const c = await create.mutateAsync({
        title: `Contratto ${wedding.title}`,
        quote_id: wedding.quote?.id,
        entry_id: wedding.id,
        client_name: wedding.client_name,
        client_email: wedding.client_email,
        event_date: wedding.date_from,
        total_amount: wedding.quote?.total_client ?? 0,
        sections: STANDARD_SECTIONS as any,
      })
      setEditing(c)
      toast.success('Bozza contratto creata')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function sendContract(id: string) {
    try {
      const token = await send.mutateAsync(id)
      // Invio email brandizzato al cliente (come il preventivo), non più mailto.
      const { data, error } = await supabase.functions.invoke('contract-send', { body: { contract_id: id } })
      await navigator.clipboard.writeText(`${window.location.origin}/p/contract/${token}`).catch(() => {})
      if (error) { toast.message('Contratto pronto. Email non inviata: usa il link copiato o WhatsApp.'); return }
      if ((data as any)?.skipped) toast.message('Contratto pronto. Email non configurata: usa il link copiato o WhatsApp.')
      else toast.success('Contratto inviato via email al cliente (link firma copiato)')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">Contratto</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Genera il contratto dal preventivo e inviane il link per la firma.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {templates.length > 0 && (
            <select defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) createFromTemplate(t); e.currentTarget.value = '' }}
              className="h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
              <option value="" disabled>Nuova da modello…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          <span className="inline-flex items-center gap-1">
            <Button variant="gold" onClick={createFromQuote} disabled={create.isPending}><Plus /> Nuova bozza</Button>
            <HelpDot id="contract.nuovo" />
          </span>
        </div>
      </header>

      <div className="space-y-4">
        {(contracts ?? []).length === 0 && (
          <Card className="p-10 text-center">
            <FileSignature size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-[rgb(var(--fg-muted))]">Nessun contratto ancora.</p>
          </Card>
        )}
        {(contracts ?? []).map((c: any) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-display text-lg">{c.title}</h3>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">
                  {c.client_name ?? '—'} · € {Number(c.total_amount).toLocaleString('it-IT')}
                  {c.signed_at && ` · firmato il ${new Date(c.signed_at).toLocaleDateString('it-IT')}`}
                </p>
              </div>
              <Badge tone={c.status === 'FIRMATO' ? 'emerald' : c.status === 'INVIATO' ? 'amber' : 'neutral'}>{c.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {c.status === 'FIRMATO' ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}><Lock size={13} /> Visualizza (immutabile)</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Modifica sezioni</Button>
              )}
              {c.status === 'BOZZA' && (
                <span className="inline-flex items-center gap-1">
                  <Button variant="gold" size="sm" onClick={() => sendContract(c.id)}><Send /> Invia per firma</Button>
                  <HelpDot id="contract.invia" />
                </span>
              )}
              {c.access_token && (
                <>
                  <Button variant="outline" size="sm" onClick={() => shareWhatsAppLink(
                    waContractToClient({ clientName: c.client_name, title: c.title }),
                    c.pdf_url ?? `${window.location.origin}/p/contract/${c.access_token}`)}>
                    <MessageCircle size={13} /> WhatsApp
                  </Button>
                  <a href={`/p/contract/${c.access_token}`} target="_blank" rel="noreferrer"
                    className="text-sm self-center text-[rgb(var(--fg-muted))] hover:underline">link firma cliente</a>
                </>
              )}
              {c.status === 'FIRMATO' && (
                <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-subtle))]" title="Un contratto firmato non puo essere modificato">
                  <Lock size={11} /> firmato e bloccato
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">Sezioni contratto</h3>
              {editing.status === 'FIRMATO' && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">
                  <Lock size={11} /> Firmato — sola lettura
                </span>
              )}
            </div>
            {editing.status === 'FIRMATO' && (
              <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgb(var(--bg-sunken))', borderLeft: '3px solid rgb(var(--gold-500))' }}>
                Questo contratto è stato firmato dal cliente il <strong>{new Date(editing.signed_at).toLocaleString('it-IT')}</strong>.
                Per legge non è più modificabile. In caso di modifiche, crea un addendum o un nuovo contratto.
              </div>
            )}
            {editing.status !== 'FIRMATO' && (
              <details className="mb-4 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                <summary className="cursor-pointer text-sm font-medium">Dati automatici disponibili (clic per copiare il codice)</summary>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PLACEHOLDERS.map((p) => (
                    <button key={p.k} onClick={() => { navigator.clipboard?.writeText(p.k); toast.success(`${p.k} copiato`) }}
                      className="text-[11px] px-2 py-1 rounded-md border hover:bg-[rgb(var(--bg-sunken))]" style={{ borderColor: 'rgb(var(--border))' }} title={p.d}>
                      <code>{p.k}</code> · {p.d}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-2">Scrivi questi codici nelle sezioni (dati fiscali, date, offerte scelte, prezzi): "Riempi dati" li sostituisce con i valori reali dell'evento.</p>
              </details>
            )}
            {editing.status === 'FIRMATO' ? (
              // Vista prosa pulita: titoli + paragrafi formattati
              <div className="space-y-5 mb-4">
                <div className="rounded-lg p-5 border" style={{ background: '#FDFBF6', borderColor: 'rgb(var(--border))', color: '#1A1714' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--gold-600))' }}>Contratto</p>
                  <h2 className="font-display text-xl mb-1">{editing.title}</h2>
                  <p className="text-xs" style={{ color: '#6E6E6E' }}>
                    {editing.client_name ?? '—'} · € {Number(editing.total_amount).toLocaleString('it-IT')}
                    {editing.event_date && ` · evento ${new Date(editing.event_date).toLocaleDateString('it-IT')}`}
                  </p>
                  <div className="my-4 h-px" style={{ background: 'rgb(var(--border))' }} />
                  {(editing.sections ?? []).map((sec: any, i: number) => (
                    <div key={i} className="mb-5">
                      <h3 className="font-display text-base mb-1.5" style={{ color: '#1A1714' }}>{sec.heading}</h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#3a3530' }}>{sec.body}</p>
                    </div>
                  ))}
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    <p className="text-xs" style={{ color: '#6E6E6E' }}>
                      <strong>Firmato</strong> il {new Date(editing.signed_at).toLocaleString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              (editing.sections ?? []).map((sec: any, i: number) => (
                <div key={i} className="mb-4 border-b pb-4" style={{ borderColor: 'rgb(var(--border))' }}>
                  <Input value={sec.heading} className="mb-2 font-medium"
                    onChange={(e) => {
                      const ns = [...editing.sections]; ns[i] = { ...sec, heading: e.target.value }
                      setEditing({ ...editing, sections: ns })
                    }} />
                  <Textarea rows={3} value={sec.body}
                    onChange={(e) => {
                      const ns = [...editing.sections]; ns[i] = { ...sec, body: e.target.value }
                      setEditing({ ...editing, sections: ns })
                    }} />
                </div>
              ))
            )}
            <div className="flex justify-between flex-wrap gap-2">
              {editing.status !== 'FIRMATO' && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const ns = [...(editing.sections ?? []), { heading: 'Nuova clausola', body: '', type: 'CLAUSULE' }]
                    setEditing({ ...editing, sections: ns })
                  }}><Plus size={14} /> Aggiungi articolo</Button>
                  <Button variant="ghost" size="sm" onClick={fillData}><Wand2 size={14} /> Riempi dati</Button>
                  <Button variant="ghost" size="sm" onClick={aiDraft} disabled={aiBusy}><Sparkles size={14} /> {aiBusy ? 'Genero…' : 'Perfeziona con AI'}</Button>
                  <Button variant="ghost" size="sm" onClick={saveAsTemplate}><BookMarked size={14} /> Salva come modello</Button>
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                {editing.status === 'FIRMATO' && editing.pdf_url && (
                  <a href={editing.pdf_url} target="_blank" rel="noreferrer">
                    <Button variant="outline">Scarica PDF</Button>
                  </a>
                )}
                <Button variant="outline" onClick={() => setEditing(null)}>Chiudi</Button>
                {editing.status !== 'FIRMATO' && (
                  <Button variant="gold" onClick={async () => {
                    try {
                      await update.mutateAsync({ id: editing.id, patch: { sections: editing.sections } })
                      toast.success('Salvato')
                      setEditing(null)
                    } catch (e) { toast.error((e as Error).message) }
                  }}>Salva</Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
