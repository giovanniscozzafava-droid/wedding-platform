import { useState } from 'react'
import { Bug, X, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const SEV = [
  { v: 'BASSA', l: 'Piccola cosa' },
  { v: 'NORMALE', l: 'Fastidioso' },
  { v: 'ALTA', l: 'Mi blocca un lavoro' },
  { v: 'BLOCCANTE', l: 'Non riesco a usare l\'app' },
]

export function ReportProblemWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sev, setSev] = useState('NORMALE')
  const [sending, setSending] = useState(false)

  if (!user) return null

  async function send() {
    if (!msg.trim()) { toast.error('Raccontaci cosa è successo'); return }
    setSending(true)
    try {
      const context = {
        path: location.pathname + location.search,
        ua: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        at: new Date().toISOString(),
      }
      const { error } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ error: Error | null }> })
        .rpc('log_bug_report', { p_message: msg.trim(), p_url: location.pathname + location.search, p_context: context, p_severity: sev })
      if (error) throw error
      toast.success('Segnalazione inviata. Grazie! La guardiamo subito.')
      setMsg(''); setSev('NORMALE'); setOpen(false)
    } catch (e) { toast.error((e as Error).message) }
    finally { setSending(false) }
  }

  return (
    <>
      {/* Pulsante flottante discreto */}
      <button onClick={() => setOpen(true)} title="Segnala un problema"
        className="fixed bottom-5 left-5 z-40 hidden sm:inline-flex items-center gap-1.5 rounded-full shadow-lg px-3 py-2 text-xs font-medium"
        style={{ background: 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border-strong))', color: 'rgb(var(--fg-muted))' }}>
        <Bug size={14} /> Segnala
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-[rgb(var(--bg-elev))] w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5"
            style={{ borderColor: 'rgb(var(--border))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-lg flex items-center gap-2"><Bug size={18} /> Segnala un problema</h3>
              <button onClick={() => setOpen(false)} aria-label="Chiudi" className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
            </div>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
              Dicci cosa non va: alleghiamo in automatico la pagina e il dispositivo, così lo staff capisce subito.
            </p>
            <label className="block text-xs font-medium mb-1">Quanto ti blocca?</label>
            <select value={sev} onChange={(e) => setSev(e.target.value)}
              className="w-full h-10 px-3 mb-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
              {SEV.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)}
              placeholder="Es. Clicco 'Invia preventivo' e non succede niente…" />
            <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1 mb-3 truncate">Pagina: {location.pathname}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annulla</Button>
              <Button variant="gold" size="sm" onClick={() => void send()} disabled={sending}>
                <Send size={14} /> {sending ? 'Invio…' : 'Invia'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
