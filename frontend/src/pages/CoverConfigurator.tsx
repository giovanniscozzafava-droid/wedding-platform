import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Send, ImagePlus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlbumMockup, FABRICS, MODELS, type Cover } from '@/components/album/AlbumMockup'
import { sendAlbumToPrint } from '@/hooks/useAlbumLab'

// Configuratore copertina/box con mockup 3D: il fotografo (o la coppia) sceglie modello, tessuto,
// colore, foto in copertina e titolo, vede il 3D, e invia l'album in stampa alla stamperia partner.
export default function CoverConfigurator() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [cover, setCover] = useState<Cover>({ model: 'classic', fabric: 'lino', color: '#d9cdb8', photo_url: null, title: 'Marco & Anna' })
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Cover>) => setCover((c) => ({ ...c, ...patch }))

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    set({ photo_url: URL.createObjectURL(f) }) // anteprima locale (per la stampa vale la selezione album)
  }
  async function send() {
    setBusy(true)
    try { await sendAlbumToPrint(entryId, cover, copies); toast.success('Album inviato in stampa! Lo trovi nella coda della stamperia.') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4"><ChevronLeft size={16} /> Indietro</button>
        <h1 className="font-display text-3xl mb-1">Copertina & stampa</h1>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Componi la copertina, guarda il mockup 3D (trascina per girarlo) e invia in stampa.</p>
        <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
          <Card className="p-6 grid place-items-center bg-gradient-to-br from-[rgb(var(--bg-sunken))] to-transparent">
            <AlbumMockup cover={cover} width={320} />
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-3">Trascina per ruotare</p>
          </Card>
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Modello</p>
              <div className="flex flex-wrap gap-2">
                {MODELS.map((m) => <button key={m.key} onClick={() => set({ model: m.key })} className={`px-3 py-1.5 rounded-lg text-sm border ${cover.model === m.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>{m.label}</button>)}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Tessuto</p>
              <div className="flex flex-wrap gap-2">
                {FABRICS.map((f) => (
                  <button key={f.key} onClick={() => set({ fabric: f.key, color: f.swatch })} title={f.label} className={`w-10 h-10 rounded-full border-2 ${cover.fabric === f.key ? 'border-[rgb(var(--gold-600))] scale-110' : 'border-white shadow'}`} style={{ background: f.swatch }} />
                ))}
              </div>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{FABRICS.find((f) => f.key === cover.fabric)?.label}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[rgb(var(--fg-muted))]">Colore<input type="color" value={cover.color} onChange={(e) => set({ color: e.target.value })} className="block mt-1 h-9 w-16 rounded border border-[rgb(var(--border))]" /></label>
              <label className="text-xs text-[rgb(var(--fg-muted))] flex-1">Titolo in copertina<Input value={cover.title ?? ''} onChange={(e) => set({ title: e.target.value })} className="mt-1" /></label>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Foto in copertina</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[rgb(var(--border))] cursor-pointer"><ImagePlus size={15} /> Carica<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
                {cover.photo_url && <button onClick={() => set({ photo_url: null })} className="text-xs text-[rgb(var(--rose-600))]">togli</button>}
              </div>
            </div>
            <label className="text-xs text-[rgb(var(--fg-muted))] block">Copie<Input type="number" min={1} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-24" /></label>
            <Button className="w-full" disabled={busy} onClick={send}><Send size={16} /> {busy ? 'Invio…' : 'Invia in stampa'}</Button>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Per la stampa la stamperia usa la selezione album e il layout; qui definisci la copertina e le copie.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
