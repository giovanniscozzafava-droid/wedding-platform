import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { Star, Mail, MessageCircle, ExternalLink } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { waReviewRequest } from '@/lib/waMessages'

// Dentro l'evento, lato professionista, SOLO a data passata: «Chiedi una recensione».
// Il DB decide se l'evento è passato e se chi guarda è davvero un pro dell'evento;
// qui si mostra e si manda (email via edge, WhatsApp dal telefono).
type Ctx = {
  ok: boolean; past: boolean; end_date: string | null; title: string | null; event_kind: string | null
  chi: string | null; recipients: string[]; phone: string | null
  google: string | null; matrimonio: string | null
  last: { channel: 'email' | 'whatsapp'; at: string } | null
  clicks: { platform: 'google' | 'matrimonio'; at: string }[]
}

const TERM: Record<string, string> = {
  matrimonio: 'il vostro matrimonio', battesimo: 'il battesimo', comunione: 'la comunione', cresima: 'la cresima',
  compleanno: 'la festa', anniversario: 'il vostro anniversario', corporate: 'il vostro evento', laurea: 'la laurea',
}
const fmt = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
const PLAT = { google: 'Google', matrimonio: 'Matrimonio.com' } as const

export function ReviewRequestCard({ entryId }: { entryId: string }) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<'email' | 'whatsapp' | null>(null)
  const q = useQuery({
    queryKey: ['review-ctx', entryId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('review_request_context', { p_entry: entryId })
      if (error) throw error
      return data as Ctx
    },
    staleTime: 60_000,
  })
  const c = q.data
  if (!c?.ok || !c.past) return null

  const links = !!(c.google || c.matrimonio)
  const studio = String((profile as { business_name?: string; full_name?: string } | null)?.business_name
    || (profile as { full_name?: string } | null)?.full_name || '')
  const term = TERM[c.event_kind ?? 'matrimonio'] ?? 'il vostro evento'

  async function viaEmail() {
    if (busy) return
    setBusy('email')
    try {
      const { data, error } = await supabase.functions.invoke('review-request', { body: { entry_id: entryId } })
      const err = (data as { error?: string } | null)?.error ?? (error ? 'network' : null)
      if (err === 'no_email') toast.error('Non ho un indirizzo email del cliente per questo evento.')
      else if (err === 'no_links') toast.error('Prima carica i link nelle Impostazioni.')
      else if (err === 'not_past') toast.error('L’evento non è ancora passato.')
      else if (err) toast.error('La mail non è partita: ' + err)
      else {
        const to = (data as { to?: string[] }).to ?? []
        toast.success(`Richiesta inviata a ${to.join(', ')}`)
        qc.invalidateQueries({ queryKey: ['review-ctx', entryId] })
      }
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(null) }
  }

  async function viaWhatsApp() {
    if (busy) return
    const text = waReviewRequest({ clientName: c!.chi, studio, term, google: c!.google, matrimonio: c!.matrimonio })
    const tel = (c!.phone ?? '').replace(/[^\d]/g, '')
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setBusy('whatsapp')
    try {
      const { error } = await (supabase as any).rpc('review_request_log', { p_entry: entryId, p_channel: 'whatsapp' })
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['review-ctx', entryId] })
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(null) }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg mb-1 flex items-center gap-2">
            <Star size={18} className="text-[rgb(var(--gold-600))]" /> Chiedi una recensione
          </h3>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {c.end_date ? `L’evento è passato dal ${fmt(c.end_date)}` : 'L’evento è passato'}: il ricordo è fresco, è il momento buono.
            {links
              ? ' Il cliente riceve i tuoi link su ' + [c.google && 'Google', c.matrimonio && 'Matrimonio.com'].filter(Boolean).join(' e ') + '.'
              : ''}
          </p>
          {!links && (
            <p className="text-sm mt-2">
              Prima carica i link del tuo profilo Google o Matrimonio.com nelle{' '}
              <Link to="/profile#recensioni" className="underline underline-offset-2">Impostazioni</Link>.
            </p>
          )}
          {c.last && (
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
              Chiesta il {fmt(c.last.at)} via {c.last.channel === 'email' ? 'email' : 'WhatsApp'}
              {c.recipients.length > 0 && c.last.channel === 'email' ? ` a ${c.recipients.join(', ')}` : ''}.
            </p>
          )}
          {c.clicks.length > 0 && (
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1 flex items-center gap-1">
              <ExternalLink size={12} />
              {c.clicks.map((k) => `${PLAT[k.platform]} aperto il ${fmt(k.at)}`).join(' · ')} — vai a vedere se la recensione è arrivata.
            </p>
          )}
        </div>
        {links && (
          <div className="flex gap-2 shrink-0">
            <Button variant="gold" size="sm" disabled={busy !== null || c.recipients.length === 0}
              title={c.recipients.length === 0 ? 'Nessuna email del cliente' : undefined}
              onClick={() => void viaEmail()}>
              <Mail size={14} className="mr-1.5" /> {busy === 'email' ? 'Invio…' : c.last ? 'Rimanda via email' : 'Manda via email'}
            </Button>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void viaWhatsApp()}>
              <MessageCircle size={14} className="mr-1.5" /> WhatsApp
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
export default ReviewRequestCard
