// Risposta del cliente all'ULTIMATUM. I pulsanti stanno già nella mail (?r=si / ?r=no):
// qui si atterra a scelta fatta. Se è "no", chiediamo il motivo in un clic — e se il
// motivo è il prezzo parte da sola la controproposta scontata decisa dal professionista.
import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Loader2 } from '@/components/icons/lucide'
import { supabase } from '@/lib/supabase'

type Dati = {
  ok?: boolean; error?: string
  client_name?: string | null; title?: string | null; event_date?: string | null
  responded_at?: string | null; still_interested?: boolean | null
  discount_percent?: number; discount_applied?: boolean; quote_token?: string | null
  owner?: { business_name?: string | null; full_name?: string | null; brand_primary_color?: string | null; brand_logo_url?: string | null }
}

const MOTIVI: { key: string; label: string; hint: string }[] = [
  { key: 'PREZZO', label: 'Costa più di quanto possiamo spendere', hint: 'Il motivo più frequente, e il più facile da risolvere.' },
  { key: 'ALTRO_FORNITORE', label: 'Abbiamo scelto un altro professionista', hint: '' },
  { key: 'DATA', label: 'La data è cambiata', hint: '' },
  { key: 'RINVIATO', label: 'Abbiamo rimandato tutto', hint: '' },
  { key: 'NON_PIU', label: 'Non se ne fa più nulla', hint: '' },
  { key: 'ALTRO', label: 'Un altro motivo', hint: '' },
]

export default function UltimatumPage() {
  const { token } = useParams<{ token: string }>()
  const [sp] = useSearchParams()
  const [d, setD] = useState<Dati | null>(null)
  const [fase, setFase] = useState<'carico' | 'scelta' | 'motivo' | 'concorrente' | 'fatto'>('carico')
  const [esito, setEsito] = useState<{ interessato: boolean; scontoApplicato: boolean; pct: number; quoteToken?: string | null } | null>(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)

  const carica = useCallback(async () => {
    if (!token) return
    const { data } = await (supabase.rpc as any)('ultimatum_get_by_token', { p_token: token })
    const r = (data ?? { error: 'not_found' }) as Dati
    setD(r)
    if (r.error) { setFase('fatto'); return }
    if (r.responded_at) {
      setEsito({ interessato: !!r.still_interested, scontoApplicato: !!r.discount_applied,
                 pct: Number(r.discount_percent ?? 0), quoteToken: (r as any).quote_token ?? null })
      setFase('fatto'); return
    }
    // La scelta arriva già dalla mail: "sì" si chiude subito, "no" passa al motivo.
    const r0 = sp.get('r')
    if (r0 === 'si') { void rispondi(true) } else if (r0 === 'no') { setFase('motivo') } else { setFase('scelta') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => { void carica() }, [carica])

  async function rispondi(interessato: boolean, motivo?: string, perPrezzo = false) {
    if (!token || busy) return
    setBusy(true)
    const { data, error } = await (supabase.rpc as any)('ultimatum_respond_by_token', {
      p_token: token, p_interested: interessato, p_reason: motivo ?? null,
      p_note: nota.trim() || null, p_price: perPrezzo,
    })
    setBusy(false)
    // supabase-js non lancia sugli errori Postgres: senza controllare, il cliente
    // vedrebbe "grazie" mentre la risposta non è arrivata a nessuno.
    if (error) { setD({ error: 'net' }); setFase('fatto'); return }
    const r = (data ?? {}) as { ok?: boolean; error?: string; discount_applied?: boolean; discount_percent?: number; quote_token?: string | null }
    if (r.error && r.error !== 'already') { setD({ error: r.error }); setFase('fatto'); return }
    setEsito({ interessato, scontoApplicato: !!r.discount_applied, pct: Number(r.discount_percent ?? 0), quoteToken: r.quote_token ?? null })
    setFase('fatto')
    // La controproposta finisce anche nella loro posta: se chiudono questa pagina
    // devono avere in mano la cifra nuova e il link, non un ricordo.
    if (r.discount_applied) {
      void supabase.functions.invoke('ultimatum-discount-email', { body: { token } }).catch(() => {})
    }
  }

  const primary = d?.owner?.brand_primary_color ?? '#1A2E4F'
  const studio = d?.owner?.business_name ?? d?.owner?.full_name ?? 'il professionista'

  if (fase === 'carico') {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[rgb(var(--fg-muted))]" /></div>
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-16" style={{ background: 'rgb(var(--bg))' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
        <div className="surface p-7 sm:p-9">
          {d?.owner?.brand_logo_url && (
            <img src={d.owner.brand_logo_url} alt="" className="h-12 w-auto max-w-[200px] object-contain mb-5" />
          )}

          {d?.error ? (
            <div className="text-center py-6">
              <AlertCircle size={36} className="mx-auto mb-3 text-[rgb(var(--fg-muted))]" />
              <h1 className="font-display text-2xl mb-2">
                {d.error === 'expired' ? 'Questo link è scaduto' : 'Link non valido'}
              </h1>
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                Scrivi direttamente a {studio}: ti risponderà volentieri.
              </p>
            </div>
          ) : fase === 'fatto' && esito ? (
            <div className="text-center py-4">
              <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: primary }} />
              {esito.interessato ? (
                <>
                  <h1 className="font-display text-2xl mb-2">Perfetto, grazie</h1>
                  <p className="text-sm text-[rgb(var(--fg-muted))]">
                    Abbiamo avvisato {studio}: vi ricontatta a breve.
                  </p>
                  {esito.quoteToken && (
                    <a href={`/p/preview/${esito.quoteToken}`}
                      className="mt-5 inline-block px-5 py-3 rounded-xl font-semibold text-white"
                      style={{ background: primary }}>Rivedi il preventivo</a>
                  )}
                </>
              ) : esito.scontoApplicato ? (
                <>
                  <h1 className="font-display text-2xl mb-2">Aspettate un attimo</h1>
                  <p className="text-sm text-[rgb(var(--fg-muted))]">
                    Abbiamo previsto per voi <strong style={{ color: primary }}>un ulteriore sconto del {esito.pct}% sul totale</strong>,
                    già applicato al preventivo.
                  </p>
                  {esito.quoteToken && (
                    <a href={`/p/preview/${esito.quoteToken}`} data-testid="vedi-preventivo-scontato"
                      className="mt-5 inline-block px-5 py-3 rounded-xl font-semibold text-white"
                      style={{ background: primary }}>Vedi il preventivo con lo sconto</a>
                  )}
                  <p className="mt-3 text-xs text-[rgb(var(--fg-subtle))]">
                    Il nuovo totale è già quello che vedrete aprendo il preventivo.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-display text-2xl mb-2">Grazie di avercelo detto</h1>
                  <p className="text-sm text-[rgb(var(--fg-muted))]">
                    Sapere come stanno le cose ci basta: liberiamo la data e non vi scriviamo più.
                    In bocca al lupo per il vostro giorno.
                  </p>
                </>
              )}
            </div>
          ) : fase === 'concorrente' ? (
            <>
              {/* Il punto che mancava: chi se ne va per un preventivo più basso è
                  una perdita di PREZZO, e merita la controproposta come gli altri. */}
              <h1 className="font-display text-2xl mb-1">Vi hanno fatto un prezzo migliore?</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">
                Se è una questione di cifra, forse possiamo ancora fare qualcosa.
              </p>
              <div className="space-y-2">
                <button type="button" disabled={busy}
                  onClick={() => void rispondi(false, 'ALTRO_FORNITORE', true)}
                  data-testid="concorrente-prezzo"
                  className="w-full text-left px-4 py-3 rounded-xl border transition-colors hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50"
                  style={{ borderColor: primary }}>
                  <span className="font-medium">Sì, costava meno</span>
                  <span className="block text-xs text-[rgb(var(--fg-subtle))] mt-0.5">Vediamo se possiamo avvicinarci.</span>
                </button>
                <button type="button" disabled={busy}
                  onClick={() => void rispondi(false, 'ALTRO_FORNITORE', false)}
                  className="w-full text-left px-4 py-3 rounded-xl border transition-colors hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50"
                  style={{ borderColor: 'rgb(var(--border))' }}>
                  <span className="font-medium">No, per altri motivi</span>
                  <span className="block text-xs text-[rgb(var(--fg-subtle))] mt-0.5">Stile, disponibilità, feeling…</span>
                </button>
              </div>
            </>
          ) : fase === 'motivo' ? (
            <>
              <h1 className="font-display text-2xl mb-1">Ci dite solo perché?</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">Un clic, niente di più. Serve a {studio} per fare meglio.</p>
              <div className="space-y-2">
                {MOTIVI.map((m) => (
                  <button key={m.key} type="button" disabled={busy}
                    onClick={() => (m.key === 'ALTRO_FORNITORE' ? setFase('concorrente') : void rispondi(false, m.key))}
                    className="w-full text-left px-4 py-3 rounded-xl border transition-colors hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <span className="font-medium">{m.label}</span>
                    {m.hint && <span className="block text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{m.hint}</span>}
                  </button>
                ))}
              </div>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
                placeholder="Volete aggiungere qualcosa? (facoltativo)"
                className="mt-4 w-full rounded-lg border px-3 py-2 text-sm bg-[rgb(var(--bg))]"
                style={{ borderColor: 'rgb(var(--border))' }} />
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl mb-1">
                {d?.client_name ? `${d.client_name}, siete ancora dei nostri?` : 'Siete ancora dei nostri?'}
              </h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">
                {studio} vi aveva mandato il preventivo{d?.title ? ` per ${d.title}` : ''} e non ha più avuto vostre notizie.
                Se non siete più interessati{d?.event_date ? ' a quella data' : ''}, basta dirlo qui: nessun problema.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" disabled={busy} onClick={() => void rispondi(true)}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: primary }}>
                  Sì, siamo interessati
                </button>
                <button type="button" disabled={busy} onClick={() => setFase('motivo')}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border disabled:opacity-50"
                  style={{ borderColor: 'rgb(var(--border))' }}>
                  No, abbiamo cambiato idea
                </button>
              </div>
            </>
          )}
        </div>
        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-5">Planfully</p>
      </motion.div>
    </div>
  )
}
