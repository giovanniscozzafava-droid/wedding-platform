import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { CalendarSync, Loader2, Trash2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Feed = { id: string; url: string; label: string | null; last_synced_at: string | null; last_status: string | null; last_count: number | null }

// Import iCal: incolla l'URL .ics del tuo calendario (Google/Apple/Outlook…) → Planfully importa
// gli impegni come "occupato" e ripulisce i rimossi a ogni sync. Non tocca gli eventi creati a mano.
export function IcalImportPanel({ onSynced }: { onSynced?: () => void }) {
  const [open, setOpen] = useState(false)
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data } = await (supabase.from as any)('user_ical_feeds').select('id, url, label, last_synced_at, last_status, last_count').order('created_at')
    setFeeds((data ?? []) as Feed[])
  }
  useEffect(() => { if (open) void load() }, [open])

  async function runSync(feedId?: string) {
    setBusy(feedId ?? 'all')
    try {
      const { data, error } = await supabase.functions.invoke('ical-import', { body: feedId ? { feed_id: feedId } : {} })
      const d = data as { imported?: number; failed?: number; results?: { error?: string }[] } | null
      if (error) throw error
      const firstErr = d?.results?.find((r) => r.error)?.error
      if (d?.failed && firstErr) toast.error(`Sync non riuscita: ${firstErr}`)
      else toast.success(`Importati ${d?.imported ?? 0} impegni dal calendario`)
      await load(); onSynced?.()
    } catch (e) { toast.error((e as Error).message || 'Sync non riuscita') } finally { setBusy(null) }
  }

  async function addFeed() {
    const u = url.trim()
    if (!/^https?:\/\/|^webcal:\/\//i.test(u)) { toast.error('Incolla un URL iCal valido (http/https/webcal)'); return }
    const norm = u.replace(/^webcal:\/\//i, 'https://')
    setBusy('add')
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) { toast.error('Sessione scaduta'); return }
      const { data, error } = await (supabase.from as any)('user_ical_feeds')
        .insert({ user_id: uid, url: norm, label: label.trim() || null }).select('id').single()
      if (error) { toast.error(error.message.includes('duplicate') ? 'Questo calendario è già collegato' : error.message); return }
      setUrl(''); setLabel(''); await load()
      await runSync((data as { id: string }).id)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  async function removeFeed(id: string) {
    if (!confirm('Scollegare questo calendario? Gli impegni importati da qui verranno rimossi (gli eventi creati a mano restano).')) return
    setBusy(id)
    try {
      const { error } = await (supabase.from as any)('user_ical_feeds').delete().eq('id', id)
      if (error) { toast.error(error.message); return }
      await load(); onSynced?.(); toast.success('Calendario scollegato')
    } finally { setBusy(null) }
  }

  return (
    <div className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--gold-700))] hover:underline">
        <CalendarSync size={15} /> {open ? 'Nascondi' : 'Importa un calendario (iCal)'}
        {feeds.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">{feeds.length}</span>}
      </button>
      {open && (
        <Card className="p-4 mt-2 space-y-3">
          <p className="text-xs text-[rgb(var(--fg-muted))]">
            Incolla l’URL <strong>iCal (.ics)</strong> del tuo calendario (Google/Apple/Outlook): Planfully importa i tuoi impegni come <strong>date occupate</strong> e li tiene aggiornati. I tuoi eventi creati qui non vengono toccati.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/…/basic.ics" className="flex-1 text-sm" />
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome (facolt.)" className="sm:w-40 text-sm" />
            <Button variant="gold" size="sm" onClick={() => void addFeed()} disabled={busy === 'add'}>
              {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Aggiungi
            </Button>
          </div>

          {feeds.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Calendari collegati</p>
                <button onClick={() => void runSync()} disabled={!!busy} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                  {busy === 'all' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sincronizza tutti
                </button>
              </div>
              {feeds.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{f.label || f.url}</p>
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
                      {f.last_synced_at
                        ? (f.last_status === 'ok'
                            ? `${f.last_count ?? 0} impegni · aggiornato ${new Date(f.last_synced_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                            : `Errore: ${(f.last_status ?? '').replace(/^error:/, '')}`)
                        : 'Mai sincronizzato'}
                    </p>
                  </div>
                  <button onClick={() => void runSync(f.id)} disabled={!!busy} title="Sincronizza ora" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50">
                    {busy === f.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button onClick={() => void removeFeed(f.id)} disabled={!!busy} title="Scollega" className="h-8 w-8 grid place-items-center rounded-lg text-rose-500 hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
