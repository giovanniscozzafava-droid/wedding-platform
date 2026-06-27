import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Images, BookOpen, Frame, Printer, Check, ArrowRight, Loader2, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// Percorso guidato del cliente: 1) scegli foto 2) conferma impaginazione 3) scegli copertina
// 4) stampe extra. Passi "guidati ma liberi": evidenzio il prossimo, ma tutti restano apribili.
export function AlbumFunnelTab({ entryId, onTab }: { entryId: string; onTab: (k: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [photosDone, setPhotosDone] = useState(false)
  const [layoutDone, setLayoutDone] = useState(false)
  const [coverDone, setCoverDone] = useState(false)
  const [approving, setApproving] = useState(false)

  async function load() {
    const [likes, appr, pins] = await Promise.all([
      (supabase as any).rpc('gallery_like_counts', { p_entry: entryId }),
      (supabase.from as any)('album_layout_approval').select('entry_id').eq('entry_id', entryId).maybeSingle(),
      (supabase.from as any)('album_pins').select('id', { count: 'exact', head: true }).eq('entry_id', entryId).eq('status', 'CHOSEN'),
    ])
    setPhotosDone(Array.isArray(likes.data) ? likes.data.length > 0 : false)
    setLayoutDone(!!appr.data)
    setCoverDone((pins.count ?? 0) > 0)
    setLoading(false)
  }
  useEffect(() => { void load() }, [entryId])

  async function approveLayout() {
    setApproving(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      const { error } = await (supabase.from as any)('album_layout_approval').upsert({ entry_id: entryId, approved_by: me, approved_at: new Date().toISOString() }, { onConflict: 'entry_id' })
      if (error) throw error
      setLayoutDone(true)
      toast.success('Album approvato — grazie!')
    } catch (e) { toast.error((e as Error).message) } finally { setApproving(false) }
  }

  // La selezione è REVOCABILE: il cliente può rientrare e modificare finché non va in stampa.
  async function revokeApproval() {
    await (supabase.from as any)('album_layout_approval').delete().eq('entry_id', entryId)
    setLayoutDone(false)
    toast.message('Selezione riaperta: puoi modificare e ri-approvare quando vuoi.')
  }

  const doneCount = [photosDone, layoutDone, coverDone].filter(Boolean).length
  // prossimo passo = primo dei tre obbligatori non fatto
  const nextStep = !photosDone ? 1 : !layoutDone ? 2 : !coverDone ? 3 : 4

  if (loading) return <div className="py-16 grid place-items-center text-[rgb(var(--fg-muted))]"><Loader2 className="animate-spin" /></div>

  const steps = [
    { n: 1, icon: Images, title: 'Scegli le tue foto', desc: 'Metti un cuore alle foto che vuoi nel tuo album. Sono quelle che il fotografo impagina.', done: photosDone },
    { n: 2, icon: BookOpen, title: "Conferma l'impaginazione", desc: "Sfoglia l'album impaginato. Se va bene approvalo, altrimenti chiedi una modifica.", done: layoutDone },
    { n: 3, icon: Frame, title: 'Scegli la copertina', desc: 'Sul catalogo del fotografo: modello, materiale e colore. Lascia un pin e conferma.', done: coverDone },
    { n: 4, icon: Printer, title: 'Stampe extra', desc: 'Vuoi stampe delle altre foto preferite? Ordinale quando vuoi.', done: false, optional: true },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="font-display text-2xl">Il tuo album</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Quattro passi semplici per arrivare al tuo album e alle stampe.</p>
        <div className="mt-3 h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / 3) * 100}%`, background: 'rgb(var(--gold-500))' }} />
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">{doneCount} di 3 completati · Puoi tornare e modificare le tue scelte finché l'album non va in stampa.</p>
      </div>

      <div className="space-y-3">
        {steps.map((s) => {
          const isNext = s.n === nextStep
          return (
            <Card key={s.n} className={`p-4 flex gap-4 items-start transition-shadow ${isNext ? 'ring-2 ring-[rgb(var(--gold-400))] shadow-[0_8px_24px_rgba(20,18,14,.10)]' : ''}`}>
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: s.done ? 'rgb(var(--emerald-100))' : 'rgb(var(--gold-100))', color: s.done ? 'rgb(var(--emerald-700))' : 'rgb(var(--gold-700))' }}>
                {s.done ? <Check size={20} /> : <s.icon size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.n}. {s.title}</p>
                  {s.done ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))]">Fatto</span>
                    : s.optional ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]">Facoltativo</span>
                    : isNext ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">Tocca a te ora</span>
                    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]">Dopo</span>}
                </div>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-0.5">{s.desc}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {s.n === 1 && <Button variant={isNext ? 'gold' : 'outline'} size="sm" onClick={() => onTab('foto')}><Images size={14} /> Vai alle foto <ArrowRight size={13} /></Button>}
                  {s.n === 2 && (<>
                    <Link to={`/album/${entryId}`}><Button variant={isNext && !layoutDone ? 'gold' : 'outline'} size="sm"><BookOpen size={14} /> Sfoglia l'album</Button></Link>
                    {!layoutDone
                      ? <Button variant="outline" size="sm" disabled={approving} onClick={approveLayout}><Check size={14} /> Approvo l'album</Button>
                      : <Button variant="ghost" size="sm" onClick={revokeApproval}><RotateCcw size={14} /> Riapri e modifica</Button>}
                  </>)}
                  {s.n === 3 && <Link to={`/scegli-album/${entryId}`}><Button variant={isNext ? 'gold' : 'outline'} size="sm"><Frame size={14} /> {coverDone ? 'Cambia la copertina' : 'Scegli la copertina'} <ArrowRight size={13} /></Button></Link>}
                  {s.n === 4 && <Button variant="outline" size="sm" onClick={() => onTab('foto')}><Printer size={14} /> Ordina stampe</Button>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
