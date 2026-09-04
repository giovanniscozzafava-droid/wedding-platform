import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { Receipt, Check, Trash2 } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Profilo → "Fatture in Cloud": collega la TUA azienda (OAuth2) e configura le
// serie di numerazione (il campo "numeration" di Fatture in Cloud, es. "/A") con
// cui verranno emesse le fatture create da Planfully. Una serie = un prefisso;
// "predefinita" = quella usata quando non se ne sceglie una specifica.
type Connection = { company_id: string; company_name: string | null; default_vat_id: number | null; default_payment_method_id: number | null }
type Numerazione = { id: string; label: string; numeration: string | null; is_default: boolean }
type FicOption = { id: number; value?: string; description?: string; name?: string }
type FicSettings = { ok: boolean; vat_types: FicOption[] | null; payment_methods: FicOption[] | null; errors: { vat_types: unknown; payment_methods: unknown } }

function isInAppBrowser() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|Pinterest|Twitter|; wv\)/i.test(ua)
}

export function FattureInCloudCard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [busyConnect, setBusyConnect] = useState(false)
  const [label, setLabel] = useState('')
  const [numeration, setNumeration] = useState('')
  const [busyAdd, setBusyAdd] = useState(false)
  const [busySettings, setBusySettings] = useState(false)
  const [settings, setSettings] = useState<FicSettings | null>(null)
  const [vatChoice, setVatChoice] = useState('')
  const [pmChoice, setPmChoice] = useState('')

  const connQ = useQuery({
    queryKey: ['fic-connection', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('fic_connections').select('company_id, company_name, default_vat_id, default_payment_method_id').eq('professional_id', user!.id).maybeSingle()
      return (data as Connection | null) ?? null
    },
  })
  const numQ = useQuery({
    queryKey: ['fic-numerations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('fic_numerations').select('id, label, numeration, is_default').eq('professional_id', user!.id).order('created_at')
      if (error) throw error
      return (data ?? []) as Numerazione[]
    },
  })

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('fic')
    if (!p) return
    if (p === 'connected') toast.success('Fatture in Cloud collegato')
    else if (p === 'nokey') toast.error('Fatture in Cloud non configurato lato server (manca la chiave di cifratura).')
    else if (p === 'no_fic_app') toast.error('App Fatture in Cloud non configurata (manca FIC_CLIENT_ID).')
    else if (p === 'nocompany') toast.error('Nessuna azienda trovata sul tuo account Fatture in Cloud.')
    else toast.error('Collegamento Fatture in Cloud non riuscito.')
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function connect() {
    if (isInAppBrowser()) {
      try { await navigator.clipboard.writeText(`${window.location.origin}/profile`) } catch { /* ignore */ }
      toast.error('Apri planfully.it in Safari o Chrome per collegare Fatture in Cloud (non dentro WhatsApp/Instagram). Link copiato.', { duration: 8000 })
      return
    }
    setBusyConnect(true)
    try {
      const { data, error } = await supabase.functions.invoke('fic-oauth-start', { body: {} })
      if (error) throw error
      const r = data as { url?: string; error?: string; hint?: string }
      if (r?.error) { toast.error(r.hint ?? r.error); return }
      if (r?.url) { window.location.href = r.url; return }
      toast.error('Risposta inattesa')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusyConnect(false) }
  }

  async function disconnect() {
    if (!user || !window.confirm('Scollegare Fatture in Cloud? Le fatture già emesse restano su Fatture in Cloud.')) return
    const { error } = await supabase.from('fic_connections').delete().eq('professional_id', user.id)
    if (error) { toast.error('Non riesco a scollegare'); return }
    toast.success('Fatture in Cloud scollegato')
    await qc.invalidateQueries({ queryKey: ['fic-connection', user.id] })
  }

  async function addNumerazione() {
    if (!user || busyAdd || !label.trim()) return
    setBusyAdd(true)
    try {
      const { error } = await supabase.from('fic_numerations').insert({
        professional_id: user.id, label: label.trim(), numeration: numeration.trim() || null,
        is_default: (numQ.data ?? []).length === 0,
      })
      if (error) throw error
      setLabel(''); setNumeration('')
      await qc.invalidateQueries({ queryKey: ['fic-numerations', user.id] })
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusyAdd(false) }
  }

  async function setDefault(id: string) {
    if (!user) return
    const { error } = await supabase.from('fic_numerations').update({ is_default: true }).eq('id', id).eq('professional_id', user.id)
    if (error) { toast.error('Non riesco a impostarla come predefinita'); return }
    await qc.invalidateQueries({ queryKey: ['fic-numerations', user.id] })
  }

  async function removeNumerazione(id: string) {
    if (!user) return
    const { error } = await supabase.from('fic_numerations').delete().eq('id', id).eq('professional_id', user.id)
    if (error) { toast.error('Non riesco a eliminarla'); return }
    await qc.invalidateQueries({ queryKey: ['fic-numerations', user.id] })
  }

  async function loadSettings() {
    setBusySettings(true)
    try {
      const { data, error } = await supabase.functions.invoke('fic-settings', { body: {} })
      if (error) throw error
      setSettings(data as FicSettings)
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusySettings(false) }
  }

  async function saveDefaults() {
    if (!user || !vatChoice) { toast.error('Scegli il tipo di IVA'); return }
    const { error } = await (supabase as any).rpc('fic_set_defaults', {
      p_vat_id: Number(vatChoice), p_payment_method_id: pmChoice ? Number(pmChoice) : null,
    })
    if (error) { toast.error('Non riesco a salvare'); return }
    toast.success('Salvato')
    await qc.invalidateQueries({ queryKey: ['fic-connection', user.id] })
  }

  const conn = connQ.data
  const numerazioni = numQ.data ?? []

  return (
    <Card className="p-5" id="fatture-in-cloud">
      <h3 className="font-display text-lg mb-1 flex items-center gap-2">
        <Receipt size={18} className="text-[rgb(var(--gold-600))]" /> Fatture in Cloud
      </h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        Collega la tua azienda per emettere fatture direttamente da Planfully. Se gestisci più attività sulla stessa
        azienda, configura una serie di numerazione per ciascuna (es. «/A» per una, vuota/sequenziale per l'altra).
      </p>

      {connQ.isLoading ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Carico…</p>
      ) : conn ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] p-3 mb-5">
          <p className="text-sm flex items-center gap-2">
            <Check size={16} className="text-[rgb(var(--gold-600))]" />
            Collegato — <strong>{conn.company_name ?? `azienda ${conn.company_id}`}</strong>
          </p>
          <Button variant="subtle" size="sm" onClick={() => void disconnect()}>Scollega</Button>
        </div>
      ) : null}

      {conn && (
        <div className="mb-5 rounded-md border border-[rgb(var(--border))] p-3">
          <h4 className="text-sm font-medium mb-1">IVA e metodo di pagamento</h4>
          {conn.default_vat_id ? (
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Configurati (IVA #{conn.default_vat_id}{conn.default_payment_method_id ? `, pagamento #${conn.default_payment_method_id}` : ''}).
              Servono per emettere le fatture: senza IVA configurata «Crea fattura» non parte.
            </p>
          ) : (
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-2">
              Necessari prima di poter emettere fatture: dicono a Fatture in Cloud che regime IVA applicare.
            </p>
          )}
          {!settings && (
            <Button variant="outline" size="sm" className="mt-2" disabled={busySettings} onClick={() => void loadSettings()}>
              {busySettings ? 'Leggo dal tuo account…' : 'Carica IVA e pagamenti dal mio account'}
            </Button>
          )}
          {settings && !settings.ok && (
            <div className="text-xs text-[rgb(var(--danger))] mt-2 space-y-1">
              <p>Non sono riuscito a leggerli automaticamente da Fatture in Cloud (endpoint da verificare insieme).</p>
              <p>Puoi comunque inserire gli ID a mano se li conosci (li vedi nel tuo account Fatture in Cloud).</p>
            </div>
          )}
          {settings && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end mt-3">
              <div>
                <Label htmlFor="fic-vat">Tipo IVA</Label>
                {settings.vat_types?.length ? (
                  <select id="fic-vat" className="w-full h-10 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] px-3 text-sm"
                    value={vatChoice} onChange={(e) => setVatChoice(e.target.value)}>
                    <option value="">Scegli…</option>
                    {settings.vat_types.map((v) => <option key={v.id} value={v.id}>{v.description || v.value || `#${v.id}`}</option>)}
                  </select>
                ) : (
                  <Input id="fic-vat" type="number" placeholder="ID IVA" value={vatChoice} onChange={(e) => setVatChoice(e.target.value)} />
                )}
              </div>
              <div>
                <Label htmlFor="fic-pm">Metodo di pagamento</Label>
                {settings.payment_methods?.length ? (
                  <select id="fic-pm" className="w-full h-10 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] px-3 text-sm"
                    value={pmChoice} onChange={(e) => setPmChoice(e.target.value)}>
                    <option value="">Nessuno</option>
                    {settings.payment_methods.map((v) => <option key={v.id} value={v.id}>{v.name || v.value || `#${v.id}`}</option>)}
                  </select>
                ) : (
                  <Input id="fic-pm" type="number" placeholder="ID metodo (opzionale)" value={pmChoice} onChange={(e) => setPmChoice(e.target.value)} />
                )}
              </div>
              <Button variant="gold" size="sm" onClick={() => void saveDefaults()}>Salva</Button>
            </div>
          )}
        </div>
      )}

      {!conn && (
        <div className="mb-5">
          <Button variant="gold" size="sm" disabled={busyConnect} onClick={() => void connect()}>
            {busyConnect ? 'Apro Fatture in Cloud…' : 'Collega Fatture in Cloud'}
          </Button>
        </div>
      )}

      <h4 className="text-sm font-medium mb-2">Serie di numerazione</h4>
      {numerazioni.length === 0 ? (
        <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Nessuna serie configurata: le fatture useranno la numerazione predefinita di Fatture in Cloud.</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--border))] mb-3">
          {numerazioni.map((n) => (
            <li key={n.id} className="py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {n.label} <code className="text-xs font-normal text-[rgb(var(--fg-muted))]">{n.numeration || 'sequenziale'}</code>
                  {n.is_default && <span className="ml-2 text-xs text-[rgb(var(--gold-600))]">predefinita</span>}
                </p>
              </div>
              {!n.is_default && <Button variant="outline" size="sm" onClick={() => void setDefault(n.id)}>Rendi predefinita</Button>}
              <Button variant="subtle" size="sm" title="Elimina" onClick={() => void removeNumerazione(n.id)}><Trash2 size={14} /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <div>
          <Label htmlFor="fic-label">Nome (a cosa serve)</Label>
          <Input id="fic-label" placeholder="es. Fotografia, album, stampa" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="fic-num">Numerazione</Label>
          <Input id="fic-num" placeholder="/A (vuoto = sequenziale)" value={numeration} onChange={(e) => setNumeration(e.target.value)} maxLength={20} />
        </div>
        <Button variant="outline" size="sm" disabled={busyAdd || !label.trim()} onClick={() => void addNumerazione()}>
          {busyAdd ? 'Aggiungo…' : 'Aggiungi'}
        </Button>
      </div>
    </Card>
  )
}
export default FattureInCloudCard
