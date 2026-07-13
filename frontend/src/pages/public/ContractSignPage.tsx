import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature, CheckCircle2, Sparkles, PenLine, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { QuoteSignaturePad } from '@/components/QuoteSignaturePad'
import { decodeCodiceFiscale, birthPlaceFromCF } from '@/lib/codiceFiscale'

type ContractData = {
  id: string
  title: string
  client_name: string | null
  client_email: string | null
  event_date: string | null
  total_amount: number
  status: string
  sections: Array<{ heading: string; body: string; type?: string }>
  signed_at: string | null
  signer_name?: string | null
  countersign_at?: string | null
  countersign_name?: string | null
  owner: { full_name: string | null; business_name: string | null; brand_primary_color: string | null }
  prefill?: {
    client_name?: string | null
    client_fiscal_code?: string | null
    doc_type?: string | null
    doc_number?: string | null
    doc_issued_by?: string | null
    from_quote?: boolean
  }
}

export default function ContractSignPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ContractData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState(false)

  // Stessi dati del flusso preventivo: anagrafica + documento + firma grafica + GDPR.
  const [signerName, setSignerName] = useState('')
  const [signerFiscal, setSignerFiscal] = useState('')
  const [docType, setDocType] = useState('CARTA_IDENTITA')
  const [docNumber, setDocNumber] = useState('')
  const [docIssuedBy, setDocIssuedBy] = useState('')
  // Data + luogo di nascita: dedotti dal codice fiscale (il cliente li verifica/corregge → entrano nel contratto).
  const [birthDate, setBirthDate] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [birthTouched, setBirthTouched] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [fromQuote, setFromQuote] = useState(false)

  // Controfirma del professionista (solo se sei tu, loggato, owner/supplier)
  const [canCs, setCanCs] = useState(false)
  const [csContractId, setCsContractId] = useState<string | null>(null)
  const [csOpen, setCsOpen] = useState(false)
  const [csName, setCsName] = useState('')
  const [csFiscal, setCsFiscal] = useState('')
  const [csConsent, setCsConsent] = useState(false)
  const [csBusy, setCsBusy] = useState(false)
  const [csErr, setCsErr] = useState<string | null>(null)

  async function load() {
    if (!token) return
    const { data: d, error } = await supabase.rpc('contract_get_by_token', { p_token: token })
    if (error) { setErr(error.message); return }
    if (!d) { setErr('Contratto non trovato.'); return }
    setData(d as unknown as ContractData)
    if ((d as any).signed_at) setSigned(true)
    // Niente ripetizioni: riprendi nome + CF + documento dalla firma del preventivo.
    const pf = (d as any).prefill ?? {}
    if (!signerName) setSignerName(pf.client_name ?? (d as any).client_name ?? '')
    if (!signerFiscal && pf.client_fiscal_code) setSignerFiscal(pf.client_fiscal_code)
    if (pf.doc_type) setDocType(pf.doc_type)
    if (!docNumber && pf.doc_number) setDocNumber(pf.doc_number)
    if (!docIssuedBy && pf.doc_issued_by) setDocIssuedBy(pf.doc_issued_by)
    if (pf.from_quote) setFromQuote(true)

    // Eleggibilità controfirma: la context RPC dà can_countersign + contract_id
    // SOLO al professionista autenticato (owner/supplier). Per il cliente/anon → false.
    const { data: ctx } = await (supabase.rpc as any)('contract_countersign_context', { p_token: token })
    if (ctx?.can_countersign && ctx?.contract_id) {
      setCanCs(true); setCsContractId(ctx.contract_id)
      const me = (await supabase.auth.getUser()).data.user?.id
      if (me) {
        const { data: prof } = await (supabase.from as any)('profiles')
          .select('business_name, full_name, fiscal_code, vat_number').eq('id', me).maybeSingle()
        if (prof) { setCsName(prof.business_name || prof.full_name || ''); setCsFiscal(prof.fiscal_code || prof.vat_number || '') }
      }
    } else { setCanCs(false); setCsContractId(null) }
  }

  async function doCountersign() {
    if (!csContractId) return
    setCsErr(null)
    if (!csName.trim()) { setCsErr('Nome / ragione sociale obbligatorio'); return }
    if (!csFiscal.trim()) { setCsErr('Codice fiscale / P.IVA obbligatorio'); return }
    if (!csConsent) { setCsErr('Conferma di voler controfirmare'); return }
    setCsBusy(true)
    try {
      const { error } = await (supabase.rpc as any)('countersign_contract', {
        p_contract_id: csContractId, p_signer_name: csName.trim(), p_signer_fiscal: csFiscal.trim().toUpperCase(),
      })
      if (error) {
        const m = (error.message || '').toLowerCase()
        if (m.includes('contract_not_signed_yet')) throw new Error('Il cliente non ha ancora firmato.')
        if (m.includes('already_countersigned') || m.includes('not_authorized')) throw new Error('Contratto già controfirmato o non sei autorizzato.')
        if (m.includes('unauthorized')) throw new Error('Sessione scaduta: accedi e riprova.')
        throw error
      }
      setCsOpen(false); setCanCs(false)
      await load()
    } catch (e) { setCsErr(e instanceof Error ? e.message : 'Errore') }
    finally { setCsBusy(false) }
  }

  useEffect(() => { void load() }, [token])

  // Deduci data + luogo di nascita dal codice fiscale (finché il cliente non li corregge a mano).
  useEffect(() => {
    if (birthTouched) return
    const d = decodeCodiceFiscale(signerFiscal)
    if (!d.valid) return
    if (d.birthDate) setBirthDate(d.birthDate)
    let alive = true
    birthPlaceFromCF(signerFiscal).then((r) => { if (alive && !birthTouched && r.label) setBirthPlace(r.label) })
    return () => { alive = false }
  }, [signerFiscal, birthTouched])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!signature) { setErr('Firma sul riquadro.'); return }
    if (!consentTerms || !consentPrivacy) { setErr('Devi accettare le condizioni e la privacy.'); return }
    setBusy(true); setErr(null)
    try {
      const { data: ok, error } = await (supabase.rpc as any)('contract_sign_full', {
        p_token: token,
        p_signer_name: signerName.trim(),
        p_signer_fiscal: signerFiscal.trim().toUpperCase(),
        p_doc_type: docType,
        p_doc_number: docNumber.trim(),
        p_doc_issued_by: docIssuedBy.trim() || null,
        p_signature_data_url: signature,
        p_consent_terms: consentTerms,
        p_consent_privacy: consentPrivacy,
        p_birth_date: birthDate || null,
        p_birth_place: birthPlace.trim() || null,
      })
      if (error) throw error
      if (!ok) { setErr('Contratto non firmabile (già annullato o non disponibile).'); return }
      setSigned(true)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore')
    } finally { setBusy(false) }
  }

  if (err && !data) return <div className="min-h-screen flex items-center justify-center px-4">
    <p className="text-[rgb(var(--rose-500))]">{err}</p>
  </div>
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-[rgb(var(--fg-subtle))]">Carico contratto...</p></div>

  const primary = data.owner?.brand_primary_color ?? '#1A2E4F'

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
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Contratto da firmare</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight" style={{ color: primary }}>{data.title}</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              Da {data.owner?.business_name ?? data.owner?.full_name} ·
              € {Number(data.total_amount).toLocaleString('it-IT')}
            </p>
          </header>

          <div className="px-6 sm:px-10 py-6 space-y-5">
            {data.sections.map((s, i) => (
              <section key={i}>
                <h2 className="font-display text-lg mb-1">{i + 1}. {s.heading}</h2>
                <p className="text-sm text-[rgb(var(--fg-muted))] whitespace-pre-line leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>

          <div className="px-6 sm:px-10 py-6 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            {signed ? (
              <div className="text-center py-6">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3"
                  style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
                  <CheckCircle2 size={28} />
                </span>
                <h2 className="font-display text-2xl">Contratto firmato</h2>
                {/* Atto bilaterale: firma di entrambe le parti */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-left max-w-md mx-auto">
                  <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                    <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Il professionista</p>
                    <p className="text-sm font-medium mt-0.5">{data.countersign_name ?? data.owner?.business_name ?? data.owner?.full_name ?? '—'}</p>
                    {data.countersign_at ? (
                      <p className="text-xs mt-1" style={{ color: 'rgb(var(--emerald-600))' }}>
                        ✓ Firmato il {new Date(data.countersign_at).toLocaleDateString('it-IT')}
                      </p>
                    ) : canCs ? (
                      <button type="button" onClick={() => { setCsErr(null); setCsConsent(false); setCsOpen(true) }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1"
                        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                        <PenLine size={12} /> Controfirma ora
                      </button>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: 'rgb(var(--fg-subtle))' }}>In attesa di controfirma</p>
                    )}
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                    <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Il cliente</p>
                    <p className="text-sm font-medium mt-0.5">{data.signer_name ?? data.client_name ?? '—'}</p>
                    <p className="text-xs mt-1" style={{ color: 'rgb(var(--emerald-600))' }}>
                      {data.signed_at ? `✓ Firmato il ${new Date(data.signed_at).toLocaleDateString('it-IT')}` : '✓ Firmato'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-3">Una copia firmata è stata registrata. Riceverai conferma via email.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <FileSignature size={20} /> Firma elettronica
                </h2>
                <p className="text-sm text-[rgb(var(--fg-muted))]">
                  Compila i tuoi dati, il documento d'identità e firma nel riquadro. La firma ha lo stesso valore di quella del preventivo.
                </p>
                {fromQuote && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-700))' }}>
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>I tuoi dati sono già stati ripresi dalla firma del preventivo. Controllali e firma — non serve reinserirli.</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="birthDate">Data di nascita</Label>
                    <Input id="birthDate" type="date" value={birthDate}
                      onChange={(e) => { setBirthTouched(true); setBirthDate(e.target.value) }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="birthPlace">Luogo di nascita</Label>
                    <Input id="birthPlace" value={birthPlace} placeholder="Comune (Provincia)"
                      onChange={(e) => { setBirthTouched(true); setBirthPlace(e.target.value) }} />
                  </div>
                </div>
                <p className="text-xs text-[rgb(var(--fg-subtle))] -mt-2">
                  Data e luogo di nascita sono dedotti dal tuo codice fiscale: <strong>controllali</strong> e correggili se sbagliati.
                </p>

                {/* Riepilogo live: quello che confermi qui entra nel contratto come "Dati del Committente". */}
                <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'rgb(var(--border))', background: '#fff' }}>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Come appariranno nel contratto</p>
                  <dl className="space-y-0.5 text-[rgb(var(--fg-muted))]">
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-[rgb(var(--fg-subtle))]">Nome e cognome</dt><dd className="font-medium text-[rgb(var(--fg))]">{signerName || '—'}</dd></div>
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-[rgb(var(--fg-subtle))]">Codice fiscale</dt><dd className="font-medium text-[rgb(var(--fg))]">{signerFiscal ? signerFiscal.toUpperCase() : '—'}</dd></div>
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-[rgb(var(--fg-subtle))]">Data di nascita</dt><dd className="font-medium text-[rgb(var(--fg))]">{birthDate ? new Date(birthDate + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</dd></div>
                    <div className="flex gap-2"><dt className="w-32 shrink-0 text-[rgb(var(--fg-subtle))]">Luogo di nascita</dt><dd className="font-medium text-[rgb(var(--fg))]">{birthPlace || '—'}</dd></div>
                  </dl>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">Se un dato non è corretto, modificalo qui sopra: verrà aggiornato anche nel contratto.</p>
                </div>

                <div className="space-y-1">
                  <Label>Firma grafica *</Label>
                  <QuoteSignaturePad onChange={setSignature} height={180} />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--gold-500))]"
                    checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
                  <span>Dichiaro di aver letto e di accettare integralmente il presente contratto e tutte le sue clausole, incluse quelle che richiedono approvazione specifica ai sensi degli artt. 1341 e 1342 c.c.</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--gold-500))]"
                    checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
                  <span>Acconsento al trattamento dei miei dati personali ai sensi del Reg. UE 2016/679 da parte di Fuyue Srl (titolare del marchio Planfully) per l'esecuzione del presente contratto.</span>
                </label>

                {err && <p className="text-sm text-[rgb(var(--rose-500))]">{err}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy || !signature || !consentTerms || !consentPrivacy}>
                  {busy ? 'Firma in corso...' : 'Firma il contratto'}
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

      {csOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => !csBusy && setCsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff', color: '#1A1714' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <ShieldCheck size={18} />
              </span>
              <div>
                <h3 className="font-display text-lg">Controfirma il contratto</h3>
                <p className="text-xs mt-0.5" style={{ color: '#6E6E6E' }}>
                  «{data.title}»{data.signed_at && <> · firmato dal cliente il {new Date(data.signed_at).toLocaleDateString('it-IT')}</>}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="csName">Nome / ragione sociale *</Label>
                <Input id="csName" value={csName} onChange={(e) => setCsName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="csFiscal">Codice fiscale / P.IVA *</Label>
                <Input id="csFiscal" value={csFiscal} onChange={(e) => setCsFiscal(e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--gold-500))]" checked={csConsent} onChange={(e) => setCsConsent(e.target.checked)} />
                <span>Confermo di voler <strong>controfirmare</strong> questo contratto come mia parte. La controfirma è un atto definitivo.</span>
              </label>
              {csErr && <p className="text-sm" style={{ color: 'rgb(var(--rose-500))' }}>{csErr}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setCsOpen(false)} disabled={csBusy}>Annulla</Button>
              <Button variant="gold" onClick={doCountersign} disabled={csBusy || !csConsent}>
                <PenLine size={14} /> {csBusy ? 'Controfirmo…' : 'Controfirma ora'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
