import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Upload, Loader2, Sparkles, Trash2, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { loadPdf, renderPdfPageDataUrl } from '@/lib/pdf'

// "IL MIO STILE": il fotografo carica i propri album impaginati (PDF). La vision legge ogni tavola,
// ne estrae la geometria (riquadri) e le regole; salviamo il PROFILO di stile (album_style_profiles).
// "Impagina con AI" userà QUESTO profilo per impaginare come lui. Base anche del futuro "album fantasma".

type Spread = { n: number; boxes: { x: number; y: number; w: number; h: number }[]; fullbleed: boolean; bw: boolean; white: number }
type Profile = { perSpread: { perSpread: number; times: number }[]; fullbleedPct: number; bwPct: number; whiteAvg: number; avgPhotos: number; samples: number }

const BATCH = 6

export default function MyStylePage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // carica il profilo già salvato
  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from as any)('album_style_profiles').select('profile, spreads, samples, updated_at').eq('owner_id', user.id).maybeSingle()
      if (data?.profile) { setProfile(data.profile as Profile); setSavedAt(data.updated_at as string) }
    })()
  }, [user])

  function aggregate(all: Spread[]): Profile {
    const counts = new Map<number, number>()
    let full = 0, bw = 0, whiteSum = 0
    for (const s of all) { counts.set(s.n, (counts.get(s.n) ?? 0) + 1); if (s.fullbleed) full++; if (s.bw) bw++; whiteSum += s.white ?? 0 }
    const perSpread = [...counts.entries()].map(([perSpread, times]) => ({ perSpread, times })).sort((a, b) => b.times - a.times)
    const tot = all.length || 1
    return { perSpread, fullbleedPct: Math.round((full / tot) * 100), bwPct: Math.round((bw / tot) * 100), whiteAvg: Math.round((whiteSum / tot) * 100) / 100, avgPhotos: Math.round((all.reduce((s, x) => s + x.n, 0) / tot) * 10) / 10, samples: all.length }
  }

  async function onFile(f: File) {
    if (!user) { toast.error('Accedi per salvare il tuo stile'); return }
    setBusy(true); setProgress(null)
    try {
      const buf = await f.arrayBuffer()
      const pdf = await loadPdf(buf)
      const pages = pdf.numPages
      setProgress({ done: 0, total: pages })
      // rende ogni pagina (tavola) in JPEG leggero
      const imgs: string[] = []
      for (let p = 1; p <= pages; p++) { imgs.push(await renderPdfPageDataUrl(pdf, p, 900, 0.62)); setProgress({ done: p, total: pages * 2 }) }
      // analizza a lotti
      const all: Spread[] = []
      for (let i = 0; i < imgs.length; i += BATCH) {
        const chunk = imgs.slice(i, i + BATCH)
        const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'learn', images: chunk } })
        const err = (data as { error?: string } | null)?.error
        if (error || err) { toast.error(err === 'missing_openai_key' ? 'Manca la chiave OpenAI sul server' : `Analisi non riuscita${err ? `: ${err}` : ''}`); break }
        all.push(...(((data as { spreads?: Spread[] }).spreads) ?? []))
        setProgress({ done: pages + Math.min(imgs.length, i + BATCH), total: pages * 2 })
      }
      if (!all.length) { toast.error('Non sono riuscito a leggere le tavole dal PDF'); return }
      const prof = aggregate(all)
      setProfile(prof)
      const { error: upErr } = await (supabase.from as any)('album_style_profiles').upsert({ owner_id: user.id, profile: prof, spreads: all, samples: all.length, updated_at: new Date().toISOString() })
      if (upErr) { toast.error('Analizzato, ma non salvato: ' + upErr.message); return }
      setSavedAt(new Date().toISOString())
      toast.success(`Ho imparato da ${all.length} tavole. "Impagina con AI" ora usa il tuo stile.`)
    } catch (e) {
      toast.error(`Errore: ${String((e as Error)?.message ?? e).slice(0, 140)}`)
    } finally { setBusy(false); setProgress(null) }
  }

  async function reset() {
    if (!user || !window.confirm('Cancellare lo stile appreso?')) return
    await (supabase.from as any)('album_style_profiles').delete().eq('owner_id', user.id)
    setProfile(null); setSavedAt(null); toast.success('Stile azzerato')
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-sunken))]">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link to="/weddings" className="mb-3 inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline"><ArrowLeft size={15} /> Torna indietro</Link>
        <h1 className="font-display text-2xl">Il mio stile</h1>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Carica un tuo album impaginato (PDF): l'AI legge le tue tavole e impara <strong>come impagini</strong> — quante foto per tavola, quanto respiro, quando vai a doppia pagina. Poi "Impagina con AI" comporrà nel <strong>tuo</strong> stile.</p>

        <Card className="mt-5 p-5">
          <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--border))] py-10 text-center transition-colors hover:border-[rgb(var(--gold-400))] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f) }} />
            {busy ? <Loader2 size={26} className="animate-spin text-[rgb(var(--gold-600))]" /> : <Upload size={26} className="text-[rgb(var(--gold-600))]" />}
            <span className="text-sm font-medium">{busy ? 'Analizzo il tuo album…' : 'Carica un album PDF'}</span>
            {progress && <span className="text-xs text-[rgb(var(--fg-muted))]">{progress.done}/{progress.total}</span>}
            {!busy && <span className="text-xs text-[rgb(var(--fg-subtle))]">Meglio un album completo e rappresentativo. L'analisi è una volta sola.</span>}
          </label>
        </Card>

        {profile && (
          <Card className="mt-5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium"><Sparkles size={16} className="text-[rgb(var(--gold-600))]" /> Stile appreso {savedAt && <span className="text-xs text-[rgb(var(--emerald-600))]">· salvato</span>}</p>
              <button onClick={() => void reset()} className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline"><Trash2 size={13} /> Azzera</button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Tavole lette', profile.samples], ['Media foto/tavola', profile.avgPhotos], ['Doppia pagina', `${profile.fullbleedPct}%`], ['Bianco e nero', `${profile.bwPct}%`]].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-[rgb(var(--bg-sunken))] p-3"><p className="text-xl font-display">{String(v)}</p><p className="text-[11px] text-[rgb(var(--fg-muted))]">{k}</p></div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[rgb(var(--fg-muted))]">Cadenza foto per tavola (dalla più usata): {profile.perSpread.slice(0, 6).map((s) => `${s.perSpread} (${s.times}×)`).join(' · ')}</p>
            <p className="mt-3 text-sm">Fatto! Vai su un album → <strong>Impagina con AI</strong>: userà questo profilo. <Link to="/weddings" className="text-[rgb(var(--gold-700))] hover:underline">Apri gli eventi</Link></p>
          </Card>
        )}

        <p className="mt-6 flex items-center gap-2 text-xs text-[rgb(var(--fg-subtle))]"><BookOpen size={13} /> Presto: "Album fantasma" — scegli un tuo album come modello, lo vedi sfumato dietro e ci ricalchi sopra le foto nuove.</p>
      </div>
    </div>
  )
}
