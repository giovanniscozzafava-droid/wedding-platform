import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

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
  owner: { full_name: string | null; business_name: string | null; brand_primary_color: string | null }
}

export default function ContractSignPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ContractData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerFiscal, setSignerFiscal] = useState('')

  async function load() {
    if (!token) return
    const { data: d, error } = await supabase.rpc('contract_get_by_token', { p_token: token })
    if (error) { setErr(error.message); return }
    if (!d) { setErr('Contratto non trovato.'); return }
    setData(d as unknown as ContractData)
    if ((d as any).signed_at) setSigned(true)
  }

  useEffect(() => { load() }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setBusy(true); setErr(null)
    try {
      const { data: ok, error } = await supabase.rpc('contract_sign_by_token', {
        p_token: token, p_signer_name: signerName, p_signer_fiscal: signerFiscal,
      })
      if (error) throw error
      if (!ok) { setErr('Contratto non firmabile (gia` annullato o non disponibile).'); return }
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
    <div className="min-h-screen py-10 px-4" style={{ background: 'rgb(var(--bg))' }}>
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
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                  {data.signed_at && `Il ${new Date(data.signed_at).toLocaleString('it-IT')}`}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="font-display text-xl flex items-center gap-2">
                  <FileSignature size={20} /> Firma elettronica
                </h2>
                <p className="text-sm text-[rgb(var(--fg-muted))]">
                  Compila i dati per firmare digitalmente. Riceverai una conferma via email.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="signer">Nome e cognome</Label>
                  <Input id="signer" required value={signerName} onChange={(e) => setSignerName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fiscal">Codice fiscale</Label>
                  <Input id="fiscal" required value={signerFiscal} onChange={(e) => setSignerFiscal(e.target.value)} placeholder="XXXXXX00X00X000X" />
                </div>
                {err && <p className="text-sm text-[rgb(var(--rose-500))]">{err}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                  {busy ? 'Firma in corso...' : 'Firma il contratto'}
                </Button>
              </form>
            )}
          </div>
          <div className="h-2" style={{ background: primary }} />
        </div>
        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-6">
          Documento legale · powered by Wedding Platform.
        </p>
      </motion.div>
    </div>
  )
}
