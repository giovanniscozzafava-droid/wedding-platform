import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Palette, Stamp, Package, Layers, ImageIcon, PenLine, Check, BookOpen } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  getOptionCatalogForEntry, getCoverPhotoCandidates, confirmAlbumOrder, getAlbumOrderStatus,
  type OptionCatalog, type OptionChoices, type CoverPhotoCandidate, type CatalogOption,
} from '@/hooks/useAlbumOrder'

// Stepper "chiudi la decisione": UNA scelta per passo, niente prezzi (beta senza money-talk).
// Passi fissi: colore copertina → logo/impressione → box → finiture → [foto in copertina, SOLO
// se il colore scelto lo prevede] → nota libera → riepilogo e conferma.
type StepKey = 'cover_color' | 'logo' | 'box' | 'finish' | 'cover_photo' | 'note' | 'review'

const STEP_META: Record<Exclude<StepKey, 'review'>, { title: string; hint: string; icon: typeof Palette }> = {
  cover_color: { title: 'Colore copertina', hint: 'Il colore della copertina del tuo album.', icon: Palette },
  logo:        { title: 'Logo o impressione', hint: 'Come vuoi personalizzare la copertina.', icon: Stamp },
  box:         { title: 'Box o cofanetto', hint: "Un contenitore per l'album, se lo vuoi.", icon: Package },
  finish:      { title: 'Finiture', hint: 'Puoi scegliere più di una finitura.', icon: Layers },
  cover_photo: { title: 'Foto in copertina', hint: 'Scegli la foto da mettere sulla copertina.', icon: ImageIcon },
  note:        { title: 'Una nota per il fotografo', hint: 'Facoltativa: scrivi qui se vuoi dire altro.', icon: PenLine },
}

export default function AlbumOrderStepperPage() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<OptionCatalog>({ COVER_COLOR: [], LOGO: [], BOX: [], FINISH: [] })
  const [candidates, setCandidates] = useState<CoverPhotoCandidate[]>([])
  const [layoutApproved, setLayoutApproved] = useState(false)
  const [alreadyConfirmedAt, setAlreadyConfirmedAt] = useState<string | null>(null)

  const [coverColor, setCoverColor] = useState<CatalogOption | null>(null)
  const [logo, setLogo] = useState<CatalogOption | null>(null)
  const [box, setBox] = useState<CatalogOption | null>(null)
  const [finishes, setFinishes] = useState<Set<string>>(new Set())
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null)
  const [coverPhotoNote, setCoverPhotoNote] = useState('')
  const [note, setNote] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [cat, st] = await Promise.all([getOptionCatalogForEntry(entryId), getAlbumOrderStatus(entryId)])
        setCatalog(cat)
        setLayoutApproved(st.layoutApproved)
        if (st.confirmed) {
          setAlreadyConfirmedAt(st.confirmedAt ?? null)
          const oc = st.optionChoices ?? {}
          if (oc.cover_color) setCoverColor({ id: oc.cover_color.key, key: oc.cover_color.key, label: oc.cover_color.label, description: null, allows_cover_photo: false })
          if (oc.logo) setLogo({ id: oc.logo.key, key: oc.logo.key, label: oc.logo.label, description: null, allows_cover_photo: false })
          if (oc.box) setBox({ id: oc.box.key, key: oc.box.key, label: oc.box.label, description: null, allows_cover_photo: false })
          if (oc.finishes?.length) setFinishes(new Set(oc.finishes.map((f) => f.key)))
          if (st.notes) setNote(st.notes)
          if (st.coverPhotoNote) setCoverPhotoNote(st.coverPhotoNote)
        }
      } catch { /* pagina resta con i default */ }
      finally { setLoading(false) }
    })()
  }, [entryId])

  // Ricarico la lista foto SOLO quando serve (il colore scelto prevede la foto in copertina).
  useEffect(() => {
    if (!coverColor?.allows_cover_photo) return
    if (candidates.length) return
    void getCoverPhotoCandidates(entryId).then(setCandidates).catch(() => {})
  }, [coverColor, entryId, candidates.length])

  // Riallinea la selezione del colore quando il catalogo arriva (per pre-selezionare
  // l'opzione già confermata in precedenza, che potrebbe non avere ancora "allows_cover_photo").
  useEffect(() => {
    if (!coverColor) return
    const full = catalog.COVER_COLOR.find((o) => o.key === coverColor.key)
    if (full && full.allows_cover_photo !== coverColor.allows_cover_photo) setCoverColor(full)
  }, [catalog, coverColor])

  const steps: StepKey[] = useMemo(() => {
    const base: StepKey[] = ['cover_color', 'logo', 'box', 'finish']
    if (coverColor?.allows_cover_photo) base.push('cover_photo')
    base.push('note', 'review')
    return base
  }, [coverColor?.allows_cover_photo])

  const cur = steps[step] ?? 'review'
  const toggleFinish = (key: string) => setFinishes((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const finishLabels = (keys: Set<string>) => catalog.FINISH.filter((f) => keys.has(f.key)).map((f) => ({ key: f.key, label: f.label }))

  function next() { setStep((s) => Math.min(steps.length - 1, s + 1)) }
  function back() { setStep((s) => Math.max(0, s - 1)) }

  async function confirm() {
    setBusy(true)
    try {
      const optionChoices: OptionChoices = {
        cover_color: coverColor ? { key: coverColor.key, label: coverColor.label } : undefined,
        logo: logo ? { key: logo.key, label: logo.label } : undefined,
        box: box ? { key: box.key, label: box.label } : undefined,
        finishes: finishLabels(finishes),
      }
      await confirmAlbumOrder(entryId, {
        optionChoices, note, coverPhotoMediaId: coverColor?.allows_cover_photo ? coverPhotoId : null,
        coverPhotoNote: coverColor?.allows_cover_photo ? coverPhotoNote : null,
      })
      setDone(true)
      toast.success('Album confermato — il tuo fotografo è stato avvisato.')
    } catch (e) { toast.error((e as Error).message || 'Conferma non riuscita') } finally { setBusy(false) }
  }

  if (loading) return <div className="grid place-items-center min-h-[60vh] text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>

  if (done) return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <CheckCircle2 size={48} className="mx-auto text-[rgb(var(--gold-600))] mb-3" />
      <h1 className="font-display text-2xl mb-2">Scelte confermate</h1>
      <p className="text-[rgb(var(--fg-muted))] mb-6">Il tuo fotografo ha ricevuto colore, logo, box, finiture{coverColor?.allows_cover_photo ? ' e la foto di copertina' : ''} che hai scelto. Puoi tornare qui e cambiare idea finché l'album non va in stampa.</p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => setDone(false)}>Rivedi le scelte</Button>
        <Button onClick={() => navigate(-1)}>Fine</Button>
      </div>
    </div>
  )

  const meta = cur !== 'review' ? STEP_META[cur] : null

  return (
    <div className="min-h-full">
      <div className="max-w-xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]">
          <ChevronLeft size={16} /> Indietro
        </button>

        <div className="mb-5">
          <h1 className="font-display text-3xl">Le opzioni del tuo album</h1>
          <p className="text-[rgb(var(--fg-muted))] mt-1">Un passo alla volta: colore, logo, box, finiture{alreadyConfirmedAt ? ' — puoi cambiare idea finché non va in stampa' : ''}.</p>
        </div>

        {!layoutApproved && (
          <Card className="p-4 mb-5 border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))]">
            <p className="text-sm flex items-start gap-2"><BookOpen size={16} className="mt-0.5 shrink-0 text-[rgb(var(--gold-600))]" />
              Non hai ancora approvato l'impaginazione dell'album. Puoi comunque scegliere le opzioni qui, ma prima di stamparlo il fotografo aspetterà la tua approvazione sull'album.
            </p>
          </Card>
        )}

        {/* barra di avanzamento */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-[rgb(var(--gold-500))]' : 'bg-[rgb(var(--bg-sunken))]'}`} />
          ))}
        </div>

        {cur !== 'review' && meta && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <meta.icon size={18} className="text-[rgb(var(--gold-600))]" />
              <h2 className="font-display text-xl">{meta.title}</h2>
            </div>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">{meta.hint}</p>

            {cur === 'cover_color' && (
              <OptionGrid options={catalog.COVER_COLOR} selected={coverColor} onSelect={setCoverColor} />
            )}
            {cur === 'logo' && (
              <OptionGrid options={catalog.LOGO} selected={logo} onSelect={setLogo} />
            )}
            {cur === 'box' && (
              <OptionGrid options={catalog.BOX} selected={box} onSelect={setBox} />
            )}
            {cur === 'finish' && (
              <div className="grid grid-cols-2 gap-2">
                {catalog.FINISH.map((f) => {
                  const on = finishes.has(f.key)
                  return (
                    <button key={f.key} onClick={() => toggleFinish(f.key)}
                      className={`text-left rounded-xl border px-3 py-2.5 text-sm transition ${on ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]'}`}>
                      <span className="flex items-center gap-1.5">{on && <Check size={14} className="text-[rgb(var(--gold-700))]" />} {f.label}</span>
                    </button>
                  )
                })}
                {catalog.FINISH.length === 0 && <p className="text-sm text-[rgb(var(--fg-muted))] col-span-2">Nessuna finitura disponibile.</p>}
              </div>
            )}
            {cur === 'cover_photo' && (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-auto">
                  {candidates.map((c) => (
                    <button key={c.id} onClick={() => setCoverPhotoId((v) => (v === c.id ? null : c.id))}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-square ${coverPhotoId === c.id ? 'border-[rgb(var(--gold-500))]' : 'border-transparent'}`}>
                      <img src={c.thumb} alt="" className="w-full h-full object-cover" />
                      {coverPhotoId === c.id && <span className="absolute top-1 right-1 rounded-full bg-[rgb(var(--gold-500))] text-white p-0.5"><Check size={12} /></span>}
                    </button>
                  ))}
                </div>
                {candidates.length === 0 && <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna foto scelta per l'album ancora. Vai prima a scegliere le tue foto preferite.</p>}
                <div className="mt-3">
                  <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Nota sulla foto (facoltativa: es. ritaglio, dettaglio)</label>
                  <Textarea value={coverPhotoNote} onChange={(e) => setCoverPhotoNote(e.target.value)} rows={2} placeholder="Es. taglia orizzontale, vorrei il primo piano…" className="mt-1" />
                </div>
              </div>
            )}
            {cur === 'note' && (
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Scrivi qui se vuoi dire altro al tuo fotografo…" />
            )}

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={back} disabled={step === 0}><ChevronLeft size={16} /> Indietro</Button>
              <Button onClick={next}>Avanti <ChevronRight size={16} /></Button>
            </div>
          </Card>
        )}

        {cur === 'review' && (
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-xl mb-4">Riepilogo</h2>
            <div className="space-y-2.5 text-sm">
              <ReviewRow label="Colore copertina" value={coverColor?.label} />
              <ReviewRow label="Logo / impressione" value={logo?.label} />
              <ReviewRow label="Box / cofanetto" value={box?.label} />
              <ReviewRow label="Finiture" value={finishLabels(finishes).map((f) => f.label).join(', ') || undefined} />
              {coverColor?.allows_cover_photo && (
                <ReviewRow label="Foto in copertina" value={coverPhotoId ? (candidates.find((c) => c.id === coverPhotoId)?.label ?? 'Selezionata') : 'Non scelta'} />
              )}
              {note.trim() && <ReviewRow label="Nota" value={note.trim()} />}
            </div>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-4">Confermando, il fotografo riceve subito la tua scelta.</p>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={back}><ChevronLeft size={16} /> Indietro</Button>
              <Button variant="gold" disabled={busy} onClick={confirm}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confermo queste scelte
              </Button>
            </div>
          </Card>
        )}

        <p className="text-center mt-6">
          <Link to={`/album/${entryId}`} className="text-[12px] text-[rgb(var(--gold-700))] hover:underline">Torna a sfogliare l'album</Link>
        </p>
      </div>
    </div>
  )
}

function OptionGrid({ options, selected, onSelect }: { options: CatalogOption[]; selected: CatalogOption | null; onSelect: (o: CatalogOption) => void }) {
  if (options.length === 0) return <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna opzione disponibile.</p>
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const on = selected?.key === o.key
        return (
          <button key={o.key} onClick={() => onSelect(o)}
            className={`text-left rounded-xl border px-3 py-2.5 transition ${on ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))]'}`}>
            <span className="text-sm font-medium flex items-center gap-1.5">{on && <Check size={14} className="text-[rgb(var(--gold-700))]" />} {o.label}</span>
            {o.description && <span className="block text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">{o.description}</span>}
          </button>
        )
      })}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[rgb(var(--border))] last:border-0">
      <span className="text-[rgb(var(--fg-muted))]">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  )
}
