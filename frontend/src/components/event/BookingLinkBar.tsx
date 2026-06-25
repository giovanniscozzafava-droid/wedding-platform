import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, Copy, Link2, Code, CalendarDays, ExternalLink, Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// Barra "Calendario pubblico" in cima al Calendario: link da inviare ai clienti, codice HTML
// da incorporare e feed iCal. La configurazione (disponibilità) resta nel Profilo.
export function BookingLinkBar() {
  const [slug, setSlug] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [feed, setFeed] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) { setEnabled(false); return }
      const { data: prof } = await (supabase.from as any)('profiles').select('slug').eq('id', me).maybeSingle()
      setSlug(prof?.slug ?? null)
      const { data } = await (supabase.from as any)('booking_settings').select('enabled, feed_token').eq('professional_id', me).maybeSingle()
      setEnabled(!!data?.enabled); setFeed(data?.feed_token ?? null)
    })()
  }, [])

  if (enabled === null) return null

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://planfully.it'
  const publicUrl = slug ? `${base}/prenota/${slug}` : null
  const embed = publicUrl ? `<iframe src="${publicUrl}" width="100%" height="760" style="border:0;border-radius:16px" title="Prenota un appuntamento"></iframe>` : ''
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? ''
  const feedUrl = feed && supaUrl ? `${supaUrl}/functions/v1/booking-ics?token=${feed}` : null
  const copy = (t: string, msg: string) => { void navigator.clipboard.writeText(t).then(() => toast.success(msg)).catch(() => toast(t)) }

  if (!enabled || !publicUrl) {
    return (
      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><CalendarClock size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Calendario pubblico / Prenotazioni</p>
          <p className="text-[12px] text-[rgb(var(--fg-muted))]">Attiva le prenotazioni online per avere un link da inviare ai clienti e un codice da incorporare sul tuo sito.</p>
        </div>
        <Link to="/profile"><Button variant="gold" size="sm"><Settings size={14} /> Attiva dal Profilo</Button></Link>
      </Card>
    )
  }

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><CalendarClock size={16} /></span>
        <p className="font-medium text-sm flex-1">Calendario pubblico — link da inviare ai clienti</p>
        <Link to="/profile" className="text-[11px] text-[rgb(var(--gold-700))] hover:underline inline-flex items-center gap-1"><Settings size={12} /> Disponibilità</Link>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2">
          <Link2 size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-[rgb(var(--gold-700))] hover:underline truncate flex-1">{publicUrl}</a>
          <a href={publicUrl} target="_blank" rel="noreferrer" title="Apri" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ExternalLink size={14} /></a>
          <button onClick={() => copy(publicUrl, 'Link copiato')} title="Copia il link" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><Copy size={14} /></button>
        </div>
        <div className="flex items-center gap-2 text-sm rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2">
          <Code size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
          <span className="text-[rgb(var(--fg-muted))] truncate flex-1">Codice HTML da incorporare sul tuo sito</span>
          <button onClick={() => copy(embed, 'Codice embed copiato')} title="Copia il codice HTML" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] inline-flex items-center gap-1 text-[11px]"><Copy size={13} /> Copia HTML</button>
        </div>
        {feedUrl && (
          <div className="flex items-center gap-2 text-sm rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2">
            <CalendarDays size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
            <span className="text-[rgb(var(--fg-muted))] truncate flex-1">Feed iCal (abbonati dal tuo calendario, le prenotazioni arrivano qui)</span>
            <a href={feedUrl.replace(/^https?:/, 'webcal:')} className="text-[rgb(var(--gold-700))] hover:underline text-[11px] mr-1">Abbonati</a>
            <button onClick={() => copy(feedUrl, 'Link iCal copiato')} title="Copia il feed iCal" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><Copy size={13} /></button>
          </div>
        )}
      </div>
    </Card>
  )
}
