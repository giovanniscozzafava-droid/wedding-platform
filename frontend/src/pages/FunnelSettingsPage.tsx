import { useState } from 'react'
import { toast } from 'sonner'
import { Mail, CalendarClock, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Impostazioni funnel PER-PROFESSIONISTA: ogni professionista accende/spegne le automazioni email
// verso i propri clienti. Default ON (comportamento storico). I flag stanno su profiles e sono letti
// dal cron funnel-cron per owner.
function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-[rgb(var(--gold-600))]' : 'bg-[rgb(var(--border-strong))]'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function FunnelSettingsPage() {
  const { profile, user, refreshProfile } = useAuth()
  const [followup, setFollowup] = useState(profile?.funnel_followup_enabled !== false)
  const [contested, setContested] = useState(profile?.funnel_contested_enabled !== false)
  // busy per-chiave: due switch salvano in parallelo senza spegnersi a vicenda lo spinner
  const [busy, setBusy] = useState<Set<string>>(() => new Set())
  const setBusyKey = (col: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(col); else n.delete(col); return n })

  async function persist(col: 'funnel_followup_enabled' | 'funnel_contested_enabled', val: boolean, revert: (v: boolean) => void) {
    if (!user) return
    setBusyKey(col, true)
    try {
      const { error } = await (supabase.from as any)('profiles').update({ [col]: val }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Impostazioni funnel aggiornate')
    } catch (e) {
      revert(!val) // ripristina lo switch se il salvataggio fallisce
      toast.error((e as Error).message || 'Salvataggio non riuscito')
    } finally { setBusyKey(col, false) }
  }

  const rows: { key: 'funnel_followup_enabled' | 'funnel_contested_enabled'; icon: React.ReactNode; title: string; desc: string; val: boolean; set: (v: boolean) => void }[] = [
    { key: 'funnel_followup_enabled', icon: <Mail size={18} className="text-[rgb(var(--gold-600))]" />, title: 'Promemoria automatici al cliente', desc: 'Se il cliente non risponde al preventivo, gli arriva un promemoria gentile a +3, +7 e +14 giorni dall’invio (a tuo nome, con il tuo brand). Si ferma appena accetta.', val: followup, set: setFollowup },
    { key: 'funnel_contested_enabled', icon: <CalendarClock size={18} className="text-[rgb(var(--gold-600))]" />, title: 'Email “data richiesta”', desc: 'Quando la stessa data è al centro di più preventivi, avvisi il cliente che la data sta diventando richiesta, per spingerlo a confermare. Inviata una sola volta.', val: contested, set: setContested },
  ]

  return (
    <div className="min-h-full">
      <SettingsTabs />
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Funnel"
          title="Promemoria automatici ai clienti"
          description="Decidi tu quali email automatiche partono verso i tuoi clienti. Puoi accenderle e spegnerle quando vuoi: le modifiche valgono dal giorno dopo."
        />

        <div className="space-y-3 mt-4">
          {rows.map((r) => (
            <Card key={r.key} className="p-5 flex items-start gap-4">
              <div className="mt-0.5 shrink-0">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-0.5">{r.desc}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2 pt-0.5">
                {busy.has(r.key) && <Loader2 size={14} className="animate-spin text-[rgb(var(--fg-subtle))]" />}
                <Switch checked={r.val} disabled={busy.has(r.key)}
                  onChange={(v) => { r.set(v); void persist(r.key, v, r.set) }} />
              </div>
            </Card>
          ))}
        </div>

        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-4">
          I promemoria non partono mai per un preventivo già accettato, archiviato o messo in pausa dal suo pannello. Il singolo preventivo si può sempre mettere in pausa dalla sua scheda.
        </p>
      </div>
    </div>
  )
}
