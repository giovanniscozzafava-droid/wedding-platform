// Cosa dicono i clienti quando li metti davanti alla domanda secca.
// Il numero che conta non è quanti ne recuperi: è QUANTE VOLTE a fermare la firma è
// il prezzo. Se quella fetta è grande, il problema è il listino, non il follow-up.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, TrendingUp } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Stats = {
  inviati: number; risposte: number; interessati: number; persi: number
  sconti_partiti: number; recuperati: number; valore_recuperato: number
  in_attesa: number; motivi: Record<string, number>
}

const MOTIVO_LABEL: Record<string, string> = {
  PREZZO: 'Prezzo',
  ALTRO_FORNITORE: 'Un altro professionista',
  DATA: 'Data cambiata',
  RINVIATO: 'Rimandato',
  NON_PIU: 'Non se ne fa nulla',
  ALTRO: 'Altro',
}
const MOTIVO_COLOR: Record<string, string> = {
  PREZZO: 'rgb(var(--gold-500))',
  ALTRO_FORNITORE: '#c2410c',
  DATA: '#0369a1',
  RINVIATO: '#7c3aed',
  NON_PIU: '#9f1239',
  ALTRO: 'rgb(var(--fg-subtle))',
}
const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export function UltimatumStats() {
  const [s, setS] = useState<Stats | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.rpc as any)('ultimatum_stats', { p_days: 365 })
      const r = data as (Stats & { error?: string }) | null
      if (r && !r.error) setS(r)
    })()
  }, [])

  // Niente ultimatum mandati = niente da raccontare: la scheda non compare proprio.
  if (!s || s.inviati === 0) return null

  const motivi = Object.entries(s.motivi ?? {}).sort((a, b) => b[1] - a[1])
  const totMotivi = motivi.reduce((t, [, n]) => t + n, 0)
  const perPrezzo = s.motivi?.PREZZO ?? 0
  const quotaPrezzo = totMotivi > 0 ? Math.round((perPrezzo / totMotivi) * 100) : 0
  const tassoRisposta = s.inviati > 0 ? Math.round((s.risposte / s.inviati) * 100) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-2 font-medium">
            <AlertTriangle size={16} className="text-[rgb(var(--gold-600))]" /> Ultimatum — cosa rispondono
          </span>
          <span className="text-xs text-[rgb(var(--fg-subtle))] tabular-nums">ultimi 12 mesi</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { k: 'Mandati', v: s.inviati, sub: `${tassoRisposta}% ha risposto` },
            { k: 'Ancora in gioco', v: s.interessati, sub: 'hanno detto sì' },
            { k: 'Sconti partiti', v: s.sconti_partiti, sub: 'per il prezzo' },
            { k: 'Recuperati', v: s.recuperati, sub: s.valore_recuperato > 0 ? euro(s.valore_recuperato) : 'firmati dopo' },
          ].map((c) => (
            <div key={c.k} className="rounded-lg p-3" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <div className="font-display text-2xl tabular-nums">{c.v}</div>
              <div className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-muted))] mt-0.5">{c.k}</div>
              <div className="text-[11px] text-[rgb(var(--fg-subtle))]">{c.sub}</div>
            </div>
          ))}
        </div>

        {totMotivi > 0 && (
          <>
            <p className="text-xs uppercase tracking-wide text-[rgb(var(--fg-muted))] mb-2">Perché si tirano indietro</p>
            <div className="flex h-2.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgb(var(--bg-sunken))' }}>
              {motivi.map(([k, n]) => (
                <div key={k} title={`${MOTIVO_LABEL[k] ?? k}: ${n}`}
                  style={{ width: `${(n / totMotivi) * 100}%`, background: MOTIVO_COLOR[k] ?? 'rgb(var(--fg-subtle))' }} />
              ))}
            </div>
            <ul className="space-y-1">
              {motivi.map(([k, n]) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: MOTIVO_COLOR[k] ?? 'rgb(var(--fg-subtle))' }} />
                  <span className="flex-1">{MOTIVO_LABEL[k] ?? k}</span>
                  <span className="tabular-nums text-[rgb(var(--fg-muted))]">{n}</span>
                  <span className="tabular-nums text-xs text-[rgb(var(--fg-subtle))] w-10 text-right">{Math.round((n / totMotivi) * 100)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {quotaPrezzo >= 50 && totMotivi >= 3 && (
          <p className="mt-4 text-sm rounded-lg p-3 inline-flex items-start gap-2"
            style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
            <TrendingUp size={15} className="shrink-0 mt-0.5" />
            <span>
              Nel <strong>{quotaPrezzo}%</strong> dei casi a fermarli è il prezzo. Quando la fetta è così larga
              il nodo è il listino o come lo racconti, non i solleciti.
            </span>
          </p>
        )}
        {s.in_attesa > 0 && (
          <p className="mt-3 text-xs text-[rgb(var(--fg-subtle))]">
            {s.in_attesa} {s.in_attesa === 1 ? 'ultimatum non ha' : 'ultimatum non hanno'} ancora ricevuto risposta.
          </p>
        )}
      </Card>
    </motion.div>
  )
}
