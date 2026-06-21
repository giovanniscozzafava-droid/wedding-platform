import { useState } from 'react'
import { CalendarPlus, X, Loader2, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// "Evento diretto": crea un evento GIÀ CONFERMATO (bypassa preventivo/contratto, gestiti
// fuori piattaforma) e genera il link con cui la coppia si registra dal vivo e usa subito
// la dashboard cliente + foto. Pensato per la stagione in corso (contratti già firmati).
export function DirectEventButton({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [date, setDate] = useState('')
  const [kind, setKind] = useState('matrimonio')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function create() {
    if (name.trim().length < 2 || !email.includes('@') || !date) { toast.error('Compila nome, email e data'); return }
    setBusy(true)
    try {
      const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; token?: string; error?: string } }> })
        .rpc('create_direct_event', { p_couple_name: name.trim(), p_couple_email: email.trim(), p_date: date, p_title: null, p_event_kind: kind })
      if (!data?.ok || !data.token) { toast.error(data?.error === 'forbidden' ? 'Solo i professionisti.' : data?.error ?? 'Errore'); return }
      setLink(`${window.location.origin}/invito-coppia/${data.token}`)
      onCreated?.()
    } finally { setBusy(false) }
  }

  function reset() { setOpen(false); setName(''); setEmail(''); setDate(''); setKind('matrimonio'); setLink(null); setCopied(false) }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><CalendarPlus size={14} /> Evento diretto</Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={reset}>
          <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
              <div>
                <h4 className="font-medium">Evento diretto (cliente già contrattato)</h4>
                <p className="text-[11px] text-[rgb(var(--fg-muted))]">Salta preventivo e contratto: crea l'evento confermato e fai registrare il cliente dal vivo.</p>
              </div>
              <button className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={reset}><X size={18} /></button>
            </div>

            {!link ? (
              <div className="p-4 space-y-3">
                <label className="block text-xs text-[rgb(var(--fg-muted))]">Tipo di evento
                  <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm">
                    <option value="matrimonio">Matrimonio</option>
                    <option value="compleanno">Compleanno</option>
                    <option value="battesimo">Battesimo</option>
                    <option value="comunione">Comunione</option>
                    <option value="cresima">Cresima</option>
                    <option value="anniversario">Anniversario</option>
                    <option value="laurea">Laurea</option>
                    <option value="corporate">Evento aziendale</option>
                    <option value="altro">Altro evento</option>
                  </select>
                </label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'matrimonio' ? 'Nome della coppia (es. Zoe & Marco)' : 'Nome del cliente o dell’evento (es. Compleanno di Luca)'} className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email del cliente" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
                <label className="block text-xs text-[rgb(var(--fg-muted))]">Data dell'evento
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
                </label>
                <Button variant="gold" className="w-full" disabled={busy} onClick={create}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />} Crea evento e link</Button>
              </div>
            ) : (
              <div className="p-4 space-y-3 text-center">
                <p className="text-sm">Evento creato ✅. Dai questo link (o QR) al cliente: si registra e poi <strong>rientra sempre da qui</strong> nella sua dashboard (è anche il link di accesso).</p>
                <div className="rounded-2xl bg-white p-4 inline-block border border-[rgb(var(--border))]"><QRCodeSVG value={link} size={180} level="M" fgColor="#1A1714" bgColor="#ffffff" /></div>
                <div className="flex items-center gap-2">
                  <input readOnly value={link} className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] px-2.5 py-2 text-xs" />
                  <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); toast.success('Link copiato') }}>{copied ? <Check size={14} /> : <Copy size={14} />}</Button>
                </div>
                <Button variant="gold" size="sm" onClick={reset}>Fatto</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
