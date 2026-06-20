import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchUnreadByEntry, type UnreadEntry } from '@/lib/notifGuide'
import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarHeart, Trash2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchFilterBar } from '@/components/common/SearchFilterBar'
import { useWeddings } from '@/hooks/useWedding'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DirectEventButton } from '@/components/event/DirectEventButton'

export default function WeddingsPage() {
  const { data, isLoading } = useWeddings()
  const { user } = useAuth()
  const uid = user?.id ?? null
  const qc = useQueryClient()

  const [delTarget, setDelTarget] = useState<{ id: string; title: string } | null>(null)
  const [delPhrase, setDelPhrase] = useState('')
  const [delLoseAll, setDelLoseAll] = useState(false)
  const [delNoBackup, setDelNoBackup] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [unread, setUnread] = useState<Record<string, UnreadEntry>>({})
  useEffect(() => { void fetchUnreadByEntry().then(setUnread) }, [])
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter((w) => `${w.title ?? ''} ${w.client_name ?? ''}`.toLowerCase().includes(q))
  }, [data, search])

  function deleteWedding(id: string, title: string) {
    setDelPhrase(''); setDelLoseAll(false); setDelNoBackup(false); setDelTarget({ id, title })
  }

  async function leaveCircle(id: string, title: string) {
    if (!window.confirm(`Uscire dal cerchio di «${title}»?\nL'evento e i dati della coppia restano: tu non lo gestirai più.`)) return
    try {
      const { data: res, error } = await (supabase as any).rpc('leave_event_circle', { p_entry: id })
      if (error) throw error
      if (res?.error) throw new Error(res.error)
      toast.success('Sei uscito dal cerchio di questo evento.')
      qc.invalidateQueries({ queryKey: ['weddings'] }); qc.invalidateQueries({ queryKey: ['calendar'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function confirmDelete() {
    if (!delTarget) return
    setDelBusy(true)
    try {
      const { data: paths, error } = await (supabase as any).rpc('delete_event_with_consent', {
        p_entry: delTarget.id, p_phrase: delPhrase, p_lose_all: delLoseAll, p_no_backup: delNoBackup,
      })
      if (error) throw error
      const byBucket = new Map<string, string[]>()
      for (const r of (paths as Array<{ bucket: string; path: string }>) ?? []) {
        if (!r.bucket || !r.path) continue
        const arr = byBucket.get(r.bucket) ?? []; arr.push(r.path); byBucket.set(r.bucket, arr)
      }
      for (const [bucket, files] of byBucket.entries()) { try { await supabase.storage.from(bucket).remove(files) } catch { /* ignore */ } }
      toast.success('Evento eliminato definitivamente (registrato per tutela legale).')
      setDelTarget(null)
      qc.invalidateQueries({ queryKey: ['weddings'] }); qc.invalidateQueries({ queryKey: ['calendar'] })
    } catch (e) {
      const msg = (e as Error).message
      toast.error(msg.includes('signed_act') ? "Non eliminabile: c'è un atto firmato collegato." : msg.includes('phrase') ? 'Scrivi esattamente VOGLIO CANCELLARE.' : msg.includes('consent') ? 'Spunta entrambe le dichiarazioni.' : msg)
    } finally { setDelBusy(false) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Hub eventi"
          title="I tuoi matrimoni"
          description="Ogni evento ha la sua dashboard: scaletta, tavoli, invitati, budget, checklist, mood, playlist, contratti, documenti."
        />

        <div className="flex justify-end mb-4 -mt-2">
          <DirectEventButton onCreated={() => qc.invalidateQueries({ queryKey: ['weddings'] })} />
        </div>

        {delTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !delBusy && setDelTarget(null)}>
            <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--rose-100,254_226_226))] text-rose-600 mx-auto"><Trash2 size={22} /></span>
                <h3 className="font-display text-xl mt-2">Cancellare «{delTarget.title}»?</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Azione <strong>irreversibile</strong>: spariscono per sempre invitati, foto, documenti — tutto.</p>
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none"><input type="checkbox" checked={delLoseAll} onChange={(e) => setDelLoseAll(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600 shrink-0" /> Accetto di perdere tutti i dati di questo evento.</label>
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none"><input type="checkbox" checked={delNoBackup} onChange={(e) => setDelNoBackup(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600 shrink-0" /> Sono consapevole che NON esiste un backup recuperabile.</label>
              <div>
                <label className="text-xs text-[rgb(var(--fg-muted))]">Scrivi <strong>VOGLIO CANCELLARE</strong> per confermare</label>
                <input value={delPhrase} onChange={(e) => setDelPhrase(e.target.value)} placeholder="VOGLIO CANCELLARE" className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              </div>
              <p className="text-[11px] text-[rgb(var(--fg-subtle))]">La conferma (chi, quando, cosa hai accettato) viene registrata da Planfully per tutela legale.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={delBusy} onClick={() => setDelTarget(null)}>Annulla</Button>
                <Button disabled={delBusy || delPhrase.trim().toUpperCase() !== 'VOGLIO CANCELLARE' || !delLoseAll || !delNoBackup} onClick={confirmDelete} className="!bg-rose-600 !text-white hover:!bg-rose-700">{delBusy ? 'Elimino…' : 'Cancella definitivamente'}</Button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
          </div>
        )}

        {!isLoading && (data ?? []).length === 0 && (
          <Card className="p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <CalendarHeart size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Nessun matrimonio attivo</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Quando un preventivo verra` accettato, l&apos;evento associato comparira` qui pronto da gestire.
            </p>
          </Card>
        )}

        {!isLoading && (data ?? []).length > 0 && (
          <SearchFilterBar value={search} onChange={setSearch} placeholder="Cerca evento per nome o cliente…" />
        )}
        {!isLoading && (data ?? []).length > 0 && filtered.length === 0 && (
          <p className="text-sm text-[rgb(var(--fg-muted))] text-center py-8">Nessun evento corrisponde alla ricerca.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((w, idx) => (
            <motion.div key={w.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}>
              <Card className="hover:shadow-[var(--shadow-lift)] transition-shadow overflow-hidden">
                <div className="p-6 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/weddings/${w.id}`} className="min-w-0 flex-1">
                      <h3 className="font-display text-xl truncate flex items-center gap-2">
                        {w.title}
                        {unread[w.id] && <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--rose-500))] shrink-0 animate-pulse" title={`${unread[w.id]?.n ?? ''} novità da leggere`} />}
                      </h3>
                      <p className="text-sm text-[rgb(var(--fg-muted))]">
                        {w.client_name ?? '—'} ·{' '}
                        {new Date(w.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge status={w.status} />
                      {uid && w.owner_id === uid ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Elimina matrimonio + dati coppia (GDPR)"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void deleteWedding(w.id, w.title) }}
                          className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Esci dal cerchio (non sei il proprietario dell'evento)"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void leaveCircle(w.id, w.title) }}
                          className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"
                        >
                          <LogOut size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Link to={`/weddings/${w.id}`}>
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t text-xs" style={{ borderColor: 'rgb(var(--border))' }}>
                      <Stat label="Valore" value={`€ ${Number(w.value_amount ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} />
                      <Stat label="Preventivo" value={w.quote?.status ?? '—'} />
                      <Stat label="Revision" value={`v${w.quote?.revision ?? 1}`} />
                    </div>
                    <div className="flex items-center justify-end gap-1 text-sm text-[rgb(var(--fg-muted))] mt-2">
                      Apri dashboard <ArrowUpRight size={14} />
                    </div>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}
