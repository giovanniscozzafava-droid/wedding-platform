import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Loader2, Shield, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { QuoteSignaturePad } from '@/components/QuoteSignaturePad'
import { getQuestionsFor, getMoodboardSectionsForCapostipite, extractInspirationsFromAnswers } from '@/lib/eventQuestions'
import { getQuestionsForSupplierContext, subroleLabel } from '@/lib/supplierQuestions'
import { eventTerm } from '@/lib/eventKind'
import { QuestionnaireForm } from '@/components/QuestionnaireForm'

type DocType = 'CARTA_IDENTITA' | 'PASSAPORTO' | 'PATENTE'

type QuoteInfo = {
  id: string
  title: string
  client_name: string | null
  client_email: string | null
  total_client: number
  status: string
  revision: number
  event_date: string | null
}

type QuoteItem = {
  name_snapshot: string
  description_snapshot: string | null
  quantity: number
  unit_snapshot: string | null
  line_client: number
}

export default function QuoteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState<QuoteInfo | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ acceptance_pdf_url?: string | null } | null>(null)

  // Lo step 0 (questionario "Raccontaci il matrimonio") duplica dati che il
  // WP ha gia` raccolto nel lead/preventivo (nome coppia, data, tipo evento).
  // Default: si parte da step 1 (firma). Il questionario di personalizzazione
  // verra` riproposto nel portale coppia post-firma.
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(1)
  const [eventKind, setEventKind] = useState<string>('matrimonio')
  const [ownerSubrole, setOwnerSubrole] = useState<string | null>(null)
  const [isSupplierDirect, setIsSupplierDirect] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [, setQuestionnaireDone] = useState(false)
  const [savingQ, setSavingQ] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerPhone, setSignerPhone] = useState('')
  const [docType, setDocType] = useState<DocType>('CARTA_IDENTITA')
  const [docNumber, setDocNumber] = useState('')
  const [docIssuedBy, setDocIssuedBy] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [priceLocked, setPriceLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  // Dati fiscali del cliente — richiesti per la stipula del contratto
  const [fiscalCode, setFiscalCode] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [province, setProvince] = useState('')
  const [country] = useState('Italia')
  const [sdiCode, setSdiCode] = useState('')
  const [pecEmail, setPecEmail] = useState('')

  const load = async () => {
      if (!token) return
      try {
        const { data, error } = await supabase.rpc('quote_get_by_token', { p_token: token })
        if (error) throw error
        if (!data) { setErr('Preventivo non trovato o link scaduto'); return }
        const q = (data as any).quote ?? data
        if (q.error) { setErr('Questo link non è più valido. Richiedi un nuovo link al professionista.'); return }
        setPriceLocked(!!q.price_locked)
        setQuote({
          id: q.id, title: q.title,
          client_name: q.client_name, client_email: q.client_email,
          total_client: Number(q.total_client ?? 0),
          status: q.status, revision: q.revision,
          event_date: q.event_date,
        })
        setEventKind((q.event_kind ?? 'matrimonio').toLowerCase())
        const owner = q.owner ?? {}
        const sub = (owner.subrole ?? '').toLowerCase().trim() || null
        setOwnerSubrole(sub)
        setIsSupplierDirect(!!q.direct_client_id && (owner.role === 'FORNITORE' || !!sub))
        // Carica risposte questionario gia salvate (se rientra)
        const qrRes = await supabase.rpc('quote_questionnaire_get', { p_token: token })
        const qr = qrRes.data as { event_kind?: string; answers?: Record<string, unknown>; completed_at?: string | null } | null
        if (qr?.answers && Object.keys(qr.answers).length > 0) {
          setAnswers(qr.answers)
          if (qr.completed_at) {
            setQuestionnaireDone(true)
            setStep(1)
          }
        }
        const its = ((data as any).items ?? []) as QuoteItem[]
        setItems(its.map((it: any) => ({
          name_snapshot: it.name_snapshot,
          description_snapshot: it.description_snapshot,
          quantity: Number(it.quantity ?? 1),
          unit_snapshot: it.unit_snapshot,
          line_client: Number(it.line_client ?? 0),
        })))
        if (q.client_name && !signerName) setSignerName(q.client_name)
      } catch (e) { setErr((e as Error).message) }
      finally { setLoading(false) }
  }
  useEffect(() => { if (token) void load() }, [token])

  async function submit() {
    if (!token) return
    if (!signerName.trim()) return toast.error('Inserisci nome e cognome')
    if (!fiscalCode.trim()) return toast.error('Codice fiscale obbligatorio')
    if (!address.trim() || !city.trim()) return toast.error('Indirizzo e città obbligatori')
    if (!docNumber.trim()) return toast.error('Inserisci numero documento')
    if (!signature) return toast.error('Firma sul riquadro')
    if (!consentTerms || !consentPrivacy) return toast.error('Devi accettare termini e privacy')
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('quote-accept-sign', {
        body: {
          token,
          signer_name: signerName.trim(),
          signer_phone: signerPhone.trim() || null,
          doc_type: docType,
          doc_number: docNumber.trim(),
          doc_issued_by: docIssuedBy.trim() || null,
          signature_data_url: signature,
          consent_terms: consentTerms,
          consent_privacy: consentPrivacy,
          fiscal: {
            fiscal_code: fiscalCode.trim().toUpperCase(),
            vat_number: vatNumber.trim().toUpperCase() || null,
            business_name: businessName.trim() || null,
            address: address.trim(),
            city: city.trim(),
            zip: zip.trim() || null,
            province: province.trim().toUpperCase() || null,
            country: country.trim() || 'Italia',
            sdi_code: sdiCode.trim().toUpperCase() || null,
            pec_email: pecEmail.trim() || null,
          },
        },
      })
      if (error) throw error
      setDone({ acceptance_pdf_url: (data as any)?.acceptance_pdf_url })
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  if (loading) return (
    <Centered><Loader2 className="animate-spin" /></Centered>
  )

  if (err) return (
    <Centered>
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
        style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-500))' }}>
        <AlertCircle size={28} />
      </span>
      <h1 className="font-display text-2xl">Link non valido</h1>
      <p className="text-sm text-[rgb(var(--rose-500))] mt-2">{err}</p>
    </Centered>
  )

  if (done) return (
    <Centered>
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
        style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
        <CheckCircle2 size={28} />
      </span>
      <h1 className="font-display text-3xl tracking-tight mb-2">Preventivo accettato</h1>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">
        L'atto di accettazione è stato registrato. Ti abbiamo inviato una copia firmata via email.
      </p>
      {done.acceptance_pdf_url && (
        <a href={done.acceptance_pdf_url} target="_blank" rel="noreferrer" className="block mb-4">
          <Button variant="gold" className="w-full"><FileText size={14} /> Scarica atto firmato</Button>
        </a>
      )}
      <Link to={`/p/preview/${token}`} className="text-sm text-[rgb(var(--fg-muted))] hover:underline">
        Torna al preventivo
      </Link>
    </Centered>
  )

  if (!quote) return null

  // Regola: prezzo (e accettazione) solo dopo registrazione + consenso dati.
  if (priceLocked) return <AcceptPriceConsent token={token!} clientName={quote.client_name} clientEmail={quote.client_email} onUnlocked={() => { void load() }} />

  const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(quote.total_client)

  return (
    <div className="min-h-screen px-4 py-6 sm:py-12" style={{ background: '#FDFBF6', color: '#1A1714', colorScheme: 'light' }}>
      <style>{`
        .legal-doc { color: #1A1714; }
        .legal-doc input, .legal-doc textarea, .legal-doc select { color: #1A1714 !important; background: #fff !important; border-color: #E4DED2 !important; }
        .legal-doc label, .legal-doc p, .legal-doc h1, .legal-doc h2, .legal-doc h3, .legal-doc span, .legal-doc strong { color: #1A1714 }
        .legal-doc .surface { background: #fff !important; border: 1px solid #E4DED2 !important; box-shadow: 0 2px 14px rgba(26,23,20,0.06) !important; }
        .legal-doc .text-muted-legal { color: #6E6E6E !important; }
      `}</style>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto legal-doc">

        {/* Header preventivo + dettaglio voci */}
        <div className="surface surface-lift p-5 mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--gold-600))]">Stai accettando il preventivo</p>
          <h1 className="font-display text-2xl sm:text-3xl mt-1">{quote.title}</h1>
          {items.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Cosa stai acquistando ({items.length} {items.length === 1 ? 'voce' : 'voci'})</p>
              <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {items.map((it, i) => (
                  <li key={i} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{it.name_snapshot}</p>
                      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">
                        {it.quantity} {(it.unit_snapshot ?? '').toLowerCase()}
                      </p>
                      {it.description_snapshot && (
                        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1 italic line-clamp-2">{it.description_snapshot}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                      € {Number(it.line_client).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <span className="text-sm text-[rgb(var(--fg-muted))]">Importo totale</span>
            <span className="font-display text-2xl">{totFmt}</span>
          </div>
        </div>

        {/* Steps progress (step 0 questionario nascosto: gia` raccolto dal WP) */}
        <div className="flex items-center gap-1 mb-4 px-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: step >= (n as 0 | 1 | 2 | 3 | 4) ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))' }} />
          ))}
        </div>

        {/* STEP 0: Questionario dinamico */}
        {step === 0 && (
          <div className="surface surface-lift p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl">
                {isSupplierDirect
                  ? `Aiutaci a personalizzare il servizio`
                  : `Raccontaci ${eventTerm(eventKind).article === "l'" ? "l'evento" : `${eventTerm(eventKind).article} ${eventTerm(eventKind).label}`}`}
              </h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                {isSupplierDirect
                  ? `Poche domande mirate per il/la ${subroleLabel(ownerSubrole)} che hai scelto. Puoi anche allegare link Pinterest o profili Instagram di ispirazione.`
                  : `Poche domande veloci sul/la tuo/a ${eventTerm(eventKind).label} per personalizzare il servizio. Puoi tornare a rivedere prima della firma.`}
              </p>
            </div>
            <QuestionnaireForm
              sections={isSupplierDirect
                ? getQuestionsForSupplierContext(ownerSubrole, eventKind, getQuestionsFor(eventKind))
                : [...getQuestionsFor(eventKind), ...getMoodboardSectionsForCapostipite(eventKind)]}
              initial={answers}
              onChange={setAnswers}
            />
            {!isSupplierDirect && (
              <p className="text-[11px] text-[rgb(var(--fg-subtle))] italic">
                Le ispirazioni che lasci qui (Pinterest, Instagram, parole chiave) vengono salvate nella tua moodboard personale: le ritroverai quando entrerai nella tua area riservata.
              </p>
            )}
            <div className="flex justify-between gap-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="ghost" onClick={() => { setQuestionnaireDone(false); setStep(1) }}>
                Salta per ora
              </Button>
              <Button variant="gold" disabled={savingQ} onClick={async () => {
                if (!token) return
                setSavingQ(true)
                try {
                  const { data, error } = await supabase.rpc('quote_questionnaire_submit', { p_token: token, p_answers: answers as never })
                  if (error) throw error
                  const r = data as { ok?: boolean; error?: string }
                  if (r.error) throw new Error(r.error)
                  // Per capostipite, persiste anche le ispirazioni nella moodboard
                  if (!isSupplierDirect) {
                    const inspirations = extractInspirationsFromAnswers(answers)
                    if (Object.keys(inspirations).length > 0) {
                      await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
                        .rpc('save_quote_inspirations', { p_token: token, p_inspirations: inspirations })
                    }
                  }
                  toast.success('Risposte salvate')
                  setQuestionnaireDone(true)
                  setStep(1)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Errore salvataggio')
                } finally { setSavingQ(false) }
              }}>
                {savingQ ? 'Salvataggio…' : 'Continua →'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: Dati firmatario */}
        {step === 1 && (
          <div className="surface surface-lift p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl">I tuoi dati</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">Servono per identificarti come parte contraente.</p>
            </div>
            <div className="space-y-1">
              <Label>Nome e cognome</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Mario Rossi" />
            </div>
            <div className="space-y-1">
              <Label>Telefono (opzionale)</Label>
              <Input type="tel" value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} placeholder="+39 333 1234567" />
            </div>
            <Button variant="gold" className="w-full" onClick={() => setStep(2)} disabled={!signerName.trim()}>
              Continua <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* STEP 2: Dati fiscali del cliente per stipula contratto */}
        {step === 2 && (
          <div className="surface surface-lift p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl">Dati fiscali</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                Servono per intestare correttamente il contratto e l'eventuale fattura. Vengono usati solo a questo scopo.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Codice fiscale <span className="text-[rgb(var(--rose-500))]">*</span></Label>
              <Input value={fiscalCode} maxLength={16}
                onChange={(e) => setFiscalCode(e.target.value.toUpperCase())}
                placeholder="RSSMRA80A01H501Z" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Partita IVA (se azienda)</Label>
                <Input value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value.toUpperCase())}
                  placeholder="01234567890" />
              </div>
              <div className="space-y-1">
                <Label>Ragione sociale</Label>
                <Input value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Se azienda" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Indirizzo <span className="text-[rgb(var(--rose-500))]">*</span></Label>
              <Input value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Via Roma 12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Città <span className="text-[rgb(var(--rose-500))]">*</span></Label>
                <Input value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cosenza" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>CAP</Label>
                  <Input value={zip} maxLength={5}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="87100" />
                </div>
                <div className="space-y-1">
                  <Label>Prov.</Label>
                  <Input value={province} maxLength={2}
                    onChange={(e) => setProvince(e.target.value.toUpperCase())}
                    placeholder="CS" />
                </div>
              </div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-[rgb(var(--fg-muted))] py-1">
                Dati per fatturazione elettronica (opzionale)
              </summary>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Codice SDI</Label>
                  <Input value={sdiCode} maxLength={7}
                    onChange={(e) => setSdiCode(e.target.value.toUpperCase())}
                    placeholder="ABCDE12" />
                </div>
                <div className="space-y-1">
                  <Label>PEC</Label>
                  <Input type="email" value={pecEmail}
                    onChange={(e) => setPecEmail(e.target.value)}
                    placeholder="cliente@pec.it" />
                </div>
              </div>
            </details>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1"><ChevronLeft size={14} /> Indietro</Button>
              <Button variant="gold" onClick={() => setStep(3)}
                disabled={!fiscalCode.trim() || !address.trim() || !city.trim()}
                className="flex-1">
                Continua <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Documento identità */}
        {step === 3 && (
          <div className="surface surface-lift p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl flex items-center gap-2"><Shield size={18} /> Documento</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                Identificazione FES (firma elettronica semplice). I dati non vengono pubblicati.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Tipo documento</Label>
              <Select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
                <option value="CARTA_IDENTITA">Carta d'identità</option>
                <option value="PASSAPORTO">Passaporto</option>
                <option value="PATENTE">Patente di guida</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Numero documento</Label>
              <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value.toUpperCase())} placeholder="CA1234567" />
            </div>
            <div className="space-y-1">
              <Label>Rilasciato da (opzionale)</Label>
              <Input value={docIssuedBy} onChange={(e) => setDocIssuedBy(e.target.value)} placeholder="Comune di Cosenza" />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="flex-1"><ChevronLeft size={14} /> Indietro</Button>
              <Button variant="gold" onClick={() => setStep(4)} disabled={!docNumber.trim()} className="flex-1">
                Continua <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Firma + conferma */}
        {step === 4 && (
          <div className="surface surface-lift p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl">Firma</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                Firma con il dito (smartphone) o col mouse (desktop).
              </p>
            </div>
            <QuoteSignaturePad onChange={setSignature} height={180} />

            <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 size-4 accent-[rgb(var(--gold-500))]"
                  checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
                <span className="leading-snug">
                  Confermo di aver letto e accettato integralmente il <strong>preventivo v{quote.revision}</strong> per
                  un importo di <strong>{totFmt}</strong>.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 size-4 accent-[rgb(var(--gold-500))]"
                  checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
                <span className="leading-snug">
                  Accetto il trattamento dei dati di identificazione ai fini contrattuali (
                  <Link to="/privacy" target="_blank" className="underline">privacy</Link>) e dichiaro che i dati forniti sono veritieri.
                </span>
              </label>
            </div>

            <div className="text-[11px] text-[rgb(var(--fg-subtle))] p-3 rounded-lg" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <strong>Validità legale</strong>: firma elettronica semplice ai sensi dell'art. 20 CAD (D.Lgs. 82/2005) +
              accettazione contrattuale ex art. 1326 c.c. Verranno registrati: timestamp, IP, user-agent, hash del PDF.
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(3)} className="flex-1"><ChevronLeft size={14} /> Indietro</Button>
              <Button variant="gold" onClick={submit} disabled={busy || !signature || !consentTerms || !consentPrivacy} className="flex-1">
                {busy ? 'Invio...' : 'Conferma e firma'}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: 'rgb(var(--bg))' }}>
      <img src="/hero/success.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'rgba(14,17,22,0.55)' }} />
      <div className="surface surface-lift w-full max-w-md p-10 text-center relative z-10">{children}</div>
    </div>
  )
}

const ACCEPT_CONSENTS = [
  { key: 'registration', text: 'Mi registro su Planfully per visualizzare il prezzo del preventivo.' },
  { key: 'data_fuyue', text: 'Acconsento al trattamento dei miei dati personali da parte di Fuyue Srl, titolare del marchio Planfully, che ne diventa titolare.' },
  { key: 'commercial_third_parties', text: 'Acconsento all’utilizzo dei miei dati anche per finalità commerciali e alla loro eventuale cessione a terzi da parte di Fuyue Srl.' },
  { key: 'privacy_policy', text: 'Dichiaro di aver letto e compreso l’informativa privacy.' },
]

function AcceptPriceConsent({ token, clientName, clientEmail, onUnlocked }: {
  token: string; clientName: string | null; clientEmail: string | null; onUnlocked: () => void
}) {
  const [email, setEmail] = useState(clientEmail ?? '')
  const [name, setName] = useState(clientName ?? '')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)
  const allChecked = ACCEPT_CONSENTS.every((c) => checks[c.key])

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Email non valida')
    if (!allChecked) return toast.error('Devi accettare tutte le voci')
    setSending(true)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('register_quote_view', { p_token: token, p_email: email.trim(), p_name: name.trim() || null, p_consents: checks })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error('Devi accettare tutte le voci')
      onUnlocked()
    } catch (e) { toast.error((e as Error).message) } finally { setSending(false) }
  }

  return (
    <div className="min-h-screen px-4 py-10 flex items-center justify-center" style={{ background: '#FDFBF6', color: '#1A1714', colorScheme: 'light' }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ borderColor: '#E4DED2', background: '#fff' }}>
        <h1 className="font-display text-xl mb-1">Registrati per vedere il preventivo</h1>
        <p className="text-sm text-[#6B6358] mb-4">Per visualizzare il prezzo e accettare, registrati e accetta le condizioni.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: '#D6DAE1' }} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: '#D6DAE1' }} />
        </div>
        <div className="space-y-2 mb-4">
          {ACCEPT_CONSENTS.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-xs text-[#6B6358] cursor-pointer">
              <input type="checkbox" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))} className="mt-0.5 shrink-0" />
              <span>{c.text}</span>
            </label>
          ))}
        </div>
        <button onClick={() => void submit()} disabled={sending || !allChecked}
          className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: '#1A1714' }}>
          {sending ? 'Attendere…' : 'Registrati e continua'}
        </button>
      </div>
    </div>
  )
}
