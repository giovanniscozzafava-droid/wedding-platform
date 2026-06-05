import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { QuoteSignaturePad } from '@/components/QuoteSignaturePad'

type Item = { name: string; qty: number; line_client: number; decision: string }
type AddendumData = {
  id: string; title: string; body: string | null; amount_delta: number
  service_changes: { old_total?: number; new_total?: number; delta?: number; items?: Item[] } | null
  status: string; signed_at: string | null; contract_title: string | null
  owner: { full_name: string | null; business_name: string | null; brand_primary_color: string | null }
  prefill?: {
    client_name?: string | null; client_fiscal_code?: string | null
    doc_type?: string | null; doc_number?: string | null; doc_issued_by?: string | null; from_quote?: boolean
  }
}

const fmtEuro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0)

export default function AddendumSignPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<AddendumData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState(false)

  const [signerName, setSignerName] = useState('')
  const [signerFiscal, setSignerFiscal] = useState('')
  const [docType, setDocType] = useState('CARTA_IDENTITA')
  const [docNumber, setDocNumber] = useState('')
  const [docIssuedBy, setDocIssuedBy] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [fromQuote, setFromQuote] = useState(false)

  async function load() {
    if (!token) return
    const { data: d, error } = await (supabase.rpc as any)('addendum_get_by_token', { p_token: token })
    if (error) { setErr(error.message); return }
    if (!d) { setErr('Addendum non trovato.'); return }
    if ((d as any).error === 'expired') { setErr('Il link di questo addendum è scaduto. Richiedine uno nuovo.'); return }
    setData(d as unknown as AddendumData)
    if ((d as any).signed_at) setSigned(true)
    const pf = (d as any).prefill ?? {}
    if (!signerName) setSignerName(pf.client_name ?? '')
    if (!signerFiscal && pf.client_fiscal_code) setSignerFiscal(pf.client_fiscal_code)
    if (pf.doc_type) setDocType(pf.doc_type)
    if (!docNumber && pf.doc_number) setDocNumber(pf.doc_number)
    if (!docIssuedBy && pf.doc_issued_by) setDocIssuedBy(pf.doc_issued_by)
    if (pf.from_quote) setFromQuote(true)
  }

  useEffect(() => { void load() }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!signature) { setErr('Firma sul riquadro.'); return }
    if (!consentTerms || !consentPrivacy) { setErr('Devi accettare le condizioni e la privacy.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: ok, error } = await (supabase.rpc as any)('addendum_sign_full', {
        p_token: token,
        p_signer_name: signerName.trim(),
        p_signer_fiscal: signerFiscal.trim().toUpperCase(),
        p_doc_type: docType,
        p_doc_number: docNumber.trim(),
        p_doc_issued_by: docIssuedBy.trim() || null,
        p_signature_data_url: signature,
        p_consent_terms: consentTerms,
        p_consent_privacy: consentPrivacy,
      })
      if (error) throw error
      if (!ok) { setErr('Addendum non firmabile (già annullato o link scaduto).'); return }
      setSigned(true)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore')
    } finally { setBusy(false) }
  }

  if (err && !data) return <div className="min-h-screen flex items-center justify-center px-4">
    <p className="text-[rgb(var(--rose-500))]">{err}</p>
  </div>
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-[rgb(var(--fg-subtle))]">Carico addendum...</p></div>

  const primary = data.owner?.brand_primary_color ?? '#1A2E4F'
  const sc = data.service_changes ?? {}

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#FDFBF6', color: '#1A1714', colorScheme: 'light' }}>
      <style>{`
        .legal-doc, .legal-doc * { color: #1A1714 }
        .legal-doc input, .legal-doc textarea, .legal-doc select { color: #1A1714 !important; background: #fff !important; border-color: #E4DED2 !important; }
        .legal-doc .surface, .legal-doc .surface-lift { background: #fff !important; border: 1px solid #E4DED2 !important; }
      `}</style>
      <div className="legal-doc">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
        <div className="surface surface-lift overflow-hidden">
          <div className="h-2" style={{ background: primary }} />
          <header className="px-6 sm:px-10 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <Sparkles size={14} strokeWidth={2.2} />
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Addendum da firmare</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight" style={{ color: primary }}>{data.title}</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              {data.contract_title ? `Integra: ${data.contract_title} · ` : ''}
              Da {data.owner?.business_name ?? data.owner?.full_name} ·
              variazione {fmtEuro(Number(data.amount_delta))}
            </p>
          </header>

          <div className="px-6 sm:px-10 py-6 space-y-5">
            {data.body && <p className="text-sm text-[rgb(var(--fg-muted))] whitespace-pre-line leading-relaxed">{data.body}</p>}

            {/* Riepilogo voci concordate */}
            {sc.items && sc.items.length > 0 && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Riepilogo voci</p>
                <ul className="space-y-1 text-sm">
                  {sc.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className={it.decision === 'RIFIUTATO' ? 'line-through text-[rgb(var(--fg-subtle))]' : ''}>
                        {it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                        {it.decision === 'RIFIUTATO' && <span className="ml-1 text-[11px]">(rifiutata)</span>}
                      </span>
                      <span className="tabular-nums">{fmtEuro(Number(it.line_client))}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm font-semibold" style={{ borderColor: 'rgb(var(--border))' }}>
                  <span>Nuovo totale concordato</span>
                  <span className="tabular-nums" style={{ color: primary }}>{fmtEuro(Number(sc.new_total ?? 0))}</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 sm:px-10 py-6 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            {signed ? (
              <div className="text-center py-6">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3"
                  style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
                  <CheckCircle2 size={28} />
                </span>
                <h2 className="font-display text-2xl">Addendum firmato</h2>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                  {data.signed_at && `Il ${new Date(data.signed_at).toLocaleString('it-IT')}`}
                </p>
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">Una copia firmata è stata registrata. Riceverai conferma via email.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <FileSignature size={20} /> Firma elettronica
                </h2>
                <p className="text-sm text-[rgb(var(--fg-muted))]">
                  Conferma i tuoi dati e firma nel riquadro. La firma ha lo stesso valore di quella del contratto.
                </p>
                {fromQuote && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-700))' }}>
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>I tuoi dati sono già stati ripresi dalla firma precedente. Controllali e firma — non serve reinserirli.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signer">Nome e cognome *</Label>
                    <Input id="signer" required value={signerName} onChange={(e) => setSignerName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fiscal">Codice fiscale *</Label>
                    <Input id="fiscal" required value={signerFiscal} onChange={(e) => setSignerFiscal(e.target.value)} placeholder="XXXXXX00X00X000X" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="docType">Documento *</Label>
                    <Select id="docType" value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="CARTA_IDENTITA">Carta d'identità</option>
                      <option value="PATENTE">Patente</option>
                      <option value="PASSAPORTO">Passaporto</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="docNumber">Numero documento *</Label>
                    <Input id="docNumber" required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="docIssued">Rilasciato da</Label>
                    <Input id="docIssued" value={docIssuedBy} onChange={(e) => setDocIssuedBy(e.target.value)} placeholder="Comune di…" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Firma grafica *</Label>
                  <QuoteSignaturePad onChange={setSignature} height={180} />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--gold-500))]"
                    checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
                  <span>Dichiaro di accettare integralmente il presente atto integrativo (addendum) e le sue modifiche al contratto originario, incluse le clausole ex artt. 1341 e 1342 c.c.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--gold-500))]"
                    checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
                  <span>Acconsento al trattamento dei miei dati personali ai sensi del Reg. UE 2016/679 da parte di Fuyue Srl (titolare del marchio Planfully) per l'esecuzione del presente atto.</span>
                </label>

                {err && <p className="text-sm text-[rgb(var(--rose-500))]">{err}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy || !signature || !consentTerms || !consentPrivacy}>
                  {busy ? 'Firma in corso...' : "Firma l'addendum"}
                </Button>
              </form>
            )}
          </div>
          <div className="h-2" style={{ background: primary }} />
        </div>
        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-6">
          Documento legale · powered by Planfully.
        </p>
      </motion.div>
      </div>
    </div>
  )
}
