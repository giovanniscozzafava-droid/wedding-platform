import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Loader2, Sparkles, Trash2, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadPdf, renderPdfPageDataUrl } from '@/lib/pdf'

// "IL MIO STILE" (dentro l'impaginatore): il fotografo carica PIÙ album impaginati (PDF). Ogni PDF è
// una card con miniatura, eliminabile. La vision legge ogni tavola (geometria, b/n, respiro,
// VERTICALI/ORIZZONTALI) e salviamo il PROFILO = MEDIA su tutti i PDF (album_style_profiles).
// "Impagina con AI" usa QUESTO profilo medio. Base del futuro "album fantasma".

type Spread = { n: number; boxes: { x: number; y: number; w: number; h: number }[]; fullbleed: boolean; bw: boolean; white: number; vert?: number; horiz?: number }
type Profile = { perSpread: { perSpread: number; times: number }[]; fullbleedPct: number; bwPct: number; whiteAvg: number; avgPhotos: number; vertPct: number; horizPct: number; samples: number }
type StylePdf = { id: string; name: string; thumb: string | null; spreads: Spread[]; samples: number }
const BATCH = 6

function aggregate(all: Spread[]): Profile {
  const counts = new Map<number, number>()
  let full = 0, bw = 0, whiteSum = 0, vert = 0, horiz = 0
  for (const s of all) { counts.set(s.n, (counts.get(s.n) ?? 0) + 1); if (s.fullbleed) full++; if (s.bw) bw++; whiteSum += s.white ?? 0; vert += s.vert ?? 0; horiz += s.horiz ?? 0 }
  const perSpread = [...counts.entries()].map(([perSpread, times]) => ({ perSpread, times })).sort((a, b) => b.times - a.times)
  const tot = all.length || 1
  const orient = (vert + horiz) || 1
  return { perSpread, fullbleedPct: Math.round((full / tot) * 100), bwPct: Math.round((bw / tot) * 100), whiteAvg: Math.round((whiteSum / tot) * 100) / 100, avgPhotos: Math.round((all.reduce((s, x) => s + x.n, 0) / tot) * 10) / 10, vertPct: Math.round((vert / orient) * 100), horizPct: Math.round((horiz / orient) * 100), samples: all.length }
}

export function MyStylePanel({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth()
  const [pdfs, setPdfs] = useState<StylePdf[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from as any)('album_style_pdfs').select('id, name, thumb, spreads, samples').eq('owner_id', user.id).order('created_at', { ascending: true })
      if (Array.isArray(data)) setPdfs(data as StylePdf[])
    })()
  }, [user])

  // profilo MEDIO su TUTTI i pdf → salvato in album_style_profiles (lo legge "Impagina con AI")
  async function syncProfile(list: StylePdf[]) {
    if (!user) return
    const all = list.flatMap((p) => p.spreads ?? [])
    if (!all.length) { await (supabase.from as any)('album_style_profiles').delete().eq('owner_id', user.id); return }
    const prof = aggregate(all)
    await (supabase.from as any)('album_style_profiles').upsert({ owner_id: user.id, profile: prof, spreads: all, samples: all.length, updated_at: new Date().toISOString() })
  }

  async function onFile(f: File) {
    if (!user) { toast.error('Accedi per salvare il tuo stile'); return }
    setBusy(true); setProgress(null)
    try {
      const buf = await f.arrayBuffer()
      const pdf = await loadPdf(buf)
      const pages = pdf.numPages
      const imgs: string[] = []
      let thumb: string | null = null
      for (let p = 1; p <= pages; p++) {
        imgs.push(await renderPdfPageDataUrl(pdf, p, 900, 0.62))
        if (p === 1) { try { thumb = await renderPdfPageDataUrl(pdf, 1, 260, 0.6) } catch { thumb = null } }
        setProgress({ done: p, total: pages * 2 })
      }
      const all: Spread[] = []
      let reason = ''
      for (let i = 0; i < imgs.length; i += BATCH) {
        const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'learn', images: imgs.slice(i, i + BATCH) } })
        const err = (data as { error?: string } | null)?.error
        const r = (data as { reason?: string } | null)?.reason
        if (error || (err && err !== 'vision_failed')) { toast.error(err === 'missing_openai_key' ? 'Manca la chiave OpenAI sul server' : `Analisi non riuscita${err ? `: ${err}` : ''}`); break }
        if (r && !reason) reason = r
        all.push(...(((data as { spreads?: Spread[] }).spreads) ?? []))
        setProgress({ done: pages + Math.min(imgs.length, i + BATCH), total: pages * 2 })
      }
      if (!all.length) { toast.error(`Non sono riuscito a leggere le tavole${reason ? `: ${reason}` : ''}`.slice(0, 160)); return }
      const name = f.name.replace(/\.pdf$/i, '').slice(0, 60) || 'Album'
      const { data: ins, error: insErr } = await (supabase.from as any)('album_style_pdfs').insert({ owner_id: user.id, name, thumb, spreads: all, samples: all.length }).select('id, name, thumb, spreads, samples').single()
      if (insErr || !ins) { toast.error('Analizzato, ma non salvato: ' + (insErr?.message ?? '')); return }
      const list = [...pdfs, ins as StylePdf]
      setPdfs(list)
      await syncProfile(list)
      toast.success(`Imparato da "${name}" (${all.length} tavole). Ora l'AI media su ${list.length} album.`)
    } catch (e) {
      toast.error(`Errore: ${String((e as Error)?.message ?? e).slice(0, 140)}`)
    } finally { setBusy(false); setProgress(null) }
  }

  async function removePdf(id: string) {
    if (!user) return
    const list = pdfs.filter((p) => p.id !== id)
    setPdfs(list)
    await (supabase.from as any)('album_style_pdfs').delete().eq('owner_id', user.id).eq('id', id)
    await syncProfile(list)
    toast.success(list.length ? `Rimosso. L'AI media su ${list.length} album.` : 'Rimosso. Nessuno stile appreso.')
  }

  const profile = pdfs.length ? aggregate(pdfs.flatMap((p) => p.spreads ?? [])) : null

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">Il mio stile</p>
          <p className="mt-0.5 text-sm text-[rgb(var(--fg-muted))]">Carica <strong>più album PDF</strong>: l'AI legge le tue tavole (foto per tavola, respiro, doppia pagina, verticali/orizzontali) e <strong>fa la media</strong>. "Impagina con AI" comporrà nel <strong>tuo</strong> stile.</p>
        </div>
        {onClose && <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>}
      </div>

      {/* griglia dei PDF caricati (miniatura + nome + elimina) + tile "aggiungi" */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pdfs.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))]">
            <div className="aspect-[4/3] w-full overflow-hidden bg-white">
              {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-[rgb(var(--fg-subtle))]"><Sparkles size={20} /></div>}
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <div className="min-w-0"><p className="truncate text-xs font-medium">{p.name}</p><p className="text-[10px] text-[rgb(var(--fg-muted))]">{p.samples} tavole</p></div>
              <button onClick={() => void removePdf(p.id)} title="Elimina questo album" className="shrink-0 rounded-full p-1 text-rose-500 opacity-0 transition-opacity hover:bg-rose-500/10 group-hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {/* tile aggiungi */}
        <label className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[rgb(var(--border))] text-center transition-colors hover:border-[rgb(var(--gold-400))] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f) }} />
          {busy ? <Loader2 size={22} className="animate-spin text-[rgb(var(--gold-600))]" /> : <Plus size={22} className="text-[rgb(var(--gold-600))]" />}
          <span className="px-2 text-xs font-medium">{busy ? 'Analizzo…' : 'Aggiungi album PDF'}</span>
          {progress && <span className="text-[10px] text-[rgb(var(--fg-muted))]">{progress.done}/{progress.total}</span>}
        </label>
      </div>
      {!busy && !pdfs.length && <p className="mt-2 flex items-center gap-1.5 text-xs text-[rgb(var(--fg-subtle))]"><Upload size={12} /> Meglio album completi e rappresentativi. Puoi caricarne quanti vuoi.</p>}

      {profile && (
        <Card className="mt-4 p-4">
          <p className="mb-3 flex items-center gap-2 font-medium"><Sparkles size={16} className="text-[rgb(var(--gold-600))]" /> Stile medio su {pdfs.length} album <span className="text-xs text-[rgb(var(--emerald-600))]">· salvato</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Tavole lette', profile.samples], ['Media foto/tavola', profile.avgPhotos], ['Doppia pagina', `${profile.fullbleedPct}%`], ['Bianco e nero', `${profile.bwPct}%`]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-[rgb(var(--bg-sunken))] p-3"><p className="font-display text-xl">{String(v)}</p><p className="text-[11px] text-[rgb(var(--fg-muted))]">{k}</p></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[rgb(var(--fg-muted))]">Orientamento: <strong>{profile.vertPct}%</strong> verticali · <strong>{profile.horizPct}%</strong> orizzontali</p>
          <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">Cadenza foto per tavola: {profile.perSpread.slice(0, 6).map((s) => `${s.perSpread} (${s.times}×)`).join(' · ')}</p>
          <p className="mt-3 text-sm">Fatto! <strong>Impagina con AI</strong> userà questa media.</p>
        </Card>
      )}
      {onClose && <div className="mt-4 text-right"><Button variant="outline" size="sm" onClick={onClose}>Chiudi</Button></div>}
    </div>
  )
}
