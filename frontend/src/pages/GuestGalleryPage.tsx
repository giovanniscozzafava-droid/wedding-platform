import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Images, Download, X, ChevronLeft, ChevronRight, Loader2, Upload, Play } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

// Pagina ospite: link dedicato (?t=token), accesso SOLO previa registrazione.
// L'ospite vede le foto/video INVITATI e può CARICARE le proprie foto e video
// dell'evento (consenso al riutilizzo promozionale OBBLIGATORIO). I fornitori del
// cerchio (fotografo/videomaker) potranno usarli. Nessuna dashboard, niente sensibili.

type Media = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; guest_tag_name: string | null }
type Folder = { id: string; name: string; gallery_media: Media[] }

const isDrive = (m: Media) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
const isVideo = (m: Media) => m.media_type === 'VIDEO'
const fullSrc = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2000` : (m.thumbnail_link ?? ''))
const origUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/uc?export=download&id=${m.drive_file_id}` : (m.thumbnail_link ?? ''))
const webUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

async function downloadUrl(url: string, name: string) {
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  } catch { window.open(url, '_blank') }
}

export default function GuestGalleryPage() {
  const { galleryId } = useParams<{ galleryId: string }>()
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''
  const location = useLocation()
  const { loading: authLoading, session, user } = useAuth()

  const [state, setState] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [entryId, setEntryId] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [box, setBox] = useState<{ list: Media[]; i: number } | null>(null)
  const [promo, setPromo] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // registrazione ospite semplice (nome + email → dentro subito)
  const [gname, setGname] = useState('')
  const [gemail, setGemail] = useState('')
  const [signingUp, setSigningUp] = useState(false)

  const loadFolders = useCallback(async (entry: string) => {
    const { data: f } = await (supabase.from as any)('gallery_folders')
      .select('id, name, level, gallery_media(id, thumbnail_link, drive_file_id, media_type, guest_tag_name)')
      .eq('entry_id', entry).eq('level', 'INVITATI').order('sort_order')
    setFolders((f as Folder[]) ?? [])
  }, [])

  const join = useCallback(async () => {
    if (!galleryId) return
    setState('joining')
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; entry_id?: string; error?: string } }> })
      .rpc('join_event_as_guest', { p_gallery_id: galleryId, p_token: token })
    if (!data?.ok || !data.entry_id) {
      setErrMsg(data?.error === 'bad_token' ? 'Link non valido o scaduto.' : data?.error === 'gallery_not_found' ? 'Galleria inesistente.' : 'Accesso non riuscito.')
      setState('error'); return
    }
    setEntryId(data.entry_id)
    await loadFolders(data.entry_id)
    setState('ready')
  }, [galleryId, token, loadFolders])

  useEffect(() => {
    if (authLoading || !session) return
    void join()
  }, [authLoading, session, join])

  useEffect(() => {
    if (!box) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBox(null)
      else if (e.key === 'ArrowRight') setBox((b) => (b ? { ...b, i: (b.i + 1) % b.list.length } : b))
      else if (e.key === 'ArrowLeft') setBox((b) => (b ? { ...b, i: (b.i - 1 + b.list.length) % b.list.length } : b))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [box])

  async function uploadGuestMedia(files: File[]) {
    if (!entryId || !user || files.length === 0) return
    if (!promo) { toast.error('Devi accettare il consenso per caricare.'); return }
    setUploading(true)
    let ok = 0; let fail = 0
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { fail++; continue }
      try {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
        const path = `${entryId}/${user.id}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('event-guest-uploads').upload(path, file, { upsert: false, contentType: file.type })
        if (up.error) throw up.error
        const pub = supabase.storage.from('event-guest-uploads').getPublicUrl(path).data.publicUrl
        const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; error?: string } }> })
          .rpc('guest_add_media', { p_entry: entryId, p_storage_path: path, p_thumb: pub, p_media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO', p_promo: true })
        if (data?.error) throw new Error(data.error)
        ok++
      } catch (e) { fail++; if (fail === 1) toast.error((e as Error).message) }
    }
    setUploading(false)
    if (ok) toast.success(`${ok} file caricati. Grazie!`)
    await loadFolders(entryId)
  }

  async function guestEnter(e: React.FormEvent) {
    e.preventDefault()
    if (gname.trim().length < 2 || !gemail.includes('@')) { toast.error('Inserisci nome e email'); return }
    setSigningUp(true)
    try {
      const { data, error } = await supabase.functions.invoke('guest-signup', { body: { email: gemail.trim(), name: gname.trim(), gallery_id: galleryId, token } })
      if (error) throw error
      const d = data as { token_hash?: string; error?: string }
      if (d?.error || !d?.token_hash) throw new Error(d?.error === 'bad_token' ? 'Link non valido o scaduto.' : 'Registrazione non riuscita. Riprova.')
      const v = await supabase.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' })
      if (v.error) throw v.error
      // sessione impostata → l'effetto su [session] fa partire join() e carica le foto
    } catch (err) { toast.error((err as Error).message) } finally { setSigningUp(false) }
  }

  const Frame = ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <header className="border-b border-[rgb(var(--border))] px-5 py-3 flex items-center gap-2">
        <Images size={18} className="text-[rgb(var(--gold-600))]" />
        <span className="font-display text-lg">Foto e video dell'evento</span>
      </header>
      <main className="max-w-5xl mx-auto p-5">{children}</main>
    </div>
  )

  if (authLoading || state === 'joining') {
    return <Frame><div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Carico…</div></Frame>
  }

  if (!session) {
    return (
      <Frame>
        <div className="max-w-sm mx-auto py-10 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]"><Images size={26} /></span>
            <h1 className="font-display text-2xl">Le foto del matrimonio</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Scrivi nome ed email: entri subito, vedi le foto di tutti gli invitati e carichi le tue.</p>
          </div>
          <form onSubmit={guestEnter} className="space-y-3">
            <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Nome e cognome" autoComplete="name"
              className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-base" />
            <input type="email" value={gemail} onChange={(e) => setGemail(e.target.value)} placeholder="La tua email" autoComplete="email"
              className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-base" />
            <Button type="submit" variant="gold" className="w-full !py-3 !text-base" disabled={signingUp}>
              {signingUp ? <Loader2 size={18} className="animate-spin" /> : <Images size={18} />} Entra e guarda le foto
            </Button>
          </form>
          <p className="text-center text-xs text-[rgb(var(--fg-subtle))]">Hai già un account o sei un professionista? <Link to="/login" state={{ from: location }} className="underline">Accedi</Link></p>
        </div>
      </Frame>
    )
  }

  if (state === 'error') {
    return <Frame><div className="text-center py-16 space-y-2"><p className="text-sm text-[rgb(var(--fg-muted))]">{errMsg}</p></div></Frame>
  }

  const allEmpty = folders.every((f) => f.gallery_media.length === 0)
  return (
    <Frame>
      {/* QR hero: mostralo agli altri invitati, lo scansionano ed entrano */}
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-[rgb(var(--border))]">
          <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : ''} size={188} level="M" fgColor="#1A1714" bgColor="#ffffff" />
        </div>
        <p className="text-sm font-medium">Inquadra per entrare nelle foto</p>
        <p className="text-xs text-[rgb(var(--fg-muted))] max-w-xs">Mostra questo QR agli altri invitati: lo scansionano e accedono subito a foto e video dell'evento.</p>
      </div>

      {/* Upload ospiti: foto e video, con consenso promozionale OBBLIGATORIO */}
      <div className="mb-6 rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Carica le tue foto e i tuoi video dell'evento</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Le condividi con gli sposi e con i fornitori (es. il fotografo/videomaker possono usarle).</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] p-3">
          <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--gold-600))] shrink-0" />
          <span className="text-[13px] leading-snug">
            <strong>Autorizzazione all'uso delle immagini.</strong> Carico volontariamente queste foto/video e dichiaro di esserne l'autore o di averne comunque i diritti.
            Autorizzo a titolo <strong>gratuito</strong>, senza limiti di tempo né di territorio, gli sposi e i fornitori dell'evento (es. fotografo, videomaker, wedding planner)
            a conservare, riprodurre, pubblicare, esporre e diffondere il materiale caricato — compresa la mia immagine ivi presente — anche per <strong>finalità promozionali, pubblicitarie e di marketing</strong>,
            su siti web, social network, portfolio, fiere e materiali stampati. La presente vale come liberatoria ai sensi degli artt. 10 e 320 c.c., degli artt. 96-97 della L. 633/1941
            e come consenso al trattamento dei dati ai sensi del Reg. UE 2016/679 (GDPR). Dichiaro che le persone eventualmente ritratte hanno prestato il loro consenso.
            <span className="block mt-1 text-[rgb(var(--gold-700))] font-medium">Senza questa autorizzazione non è possibile caricare.</span>
          </span>
        </label>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => { const snap = e.target.files ? Array.from(e.target.files) : []; e.target.value = ''; if (snap.length) void uploadGuestMedia(snap) }} />
        <Button variant="gold" size="sm" disabled={!promo || uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Carica foto / video
        </Button>
      </div>

      {folders.length === 0 || allEmpty ? (
        <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">Ancora nessuna foto. Sii il primo a caricare i tuoi scatti!</p>
      ) : (
        folders.map((f) => (
          <section key={f.id} className="mb-8">
            <h2 className="font-medium mb-3">{f.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {f.gallery_media.map((m, idx) => (
                <button key={m.id} type="button" onClick={() => setBox({ list: f.gallery_media, i: idx })}
                  className="group relative rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))] cursor-zoom-in" style={{ aspectRatio: '4/3' }}>
                  {isVideo(m) && !isDrive(m)
                    ? <video src={m.thumbnail_link ?? ''} muted preload="metadata" className="w-full h-full object-cover" />
                    : m.thumbnail_link && <img src={m.thumbnail_link} alt={m.guest_tag_name ?? ''} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />}
                  {isVideo(m) && <span className="absolute inset-0 flex items-center justify-center"><Play size={20} className="text-white fill-white opacity-90 drop-shadow" /></span>}
                  {m.guest_tag_name && <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1 py-0.5 truncate text-left">{m.guest_tag_name}</span>}
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {box && (() => {
        const m = box.list[box.i]
        if (!m) return null
        const ext = isVideo(m) ? 'mp4' : 'jpg'
        const base = (m.guest_tag_name || 'foto-evento').replace(/[^\w\- ]+/g, '').trim() || 'foto-evento'
        return (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={() => setBox(null)}>
            <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-white/70">{box.i + 1} / {box.list.length}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="!text-white !border-white/30 hover:!bg-white/10" onClick={() => downloadUrl(webUrl(m), `${base}-web.${ext}`)}><Download size={14} /> Web</Button>
                <Button variant="gold" size="sm" onClick={() => downloadUrl(origUrl(m), `${base}.${ext}`)}><Download size={14} /> Originale</Button>
                <button className="p-1.5 rounded hover:bg-white/10" onClick={() => setBox(null)} aria-label="Chiudi"><X size={18} className="text-white" /></button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center px-4 pb-6 min-h-0" onClick={(e) => e.stopPropagation()}>
              {isVideo(m)
                ? (isDrive(m)
                    ? <iframe src={`https://drive.google.com/file/d/${m.drive_file_id}/preview`} className="w-full max-w-4xl aspect-video rounded-lg" allow="autoplay" title={base} />
                    : <video src={m.thumbnail_link ?? ''} controls autoPlay className="max-w-full max-h-full rounded-lg" />)
                : <img src={fullSrc(m)} alt={m.guest_tag_name ?? ''} className="max-w-full max-h-full object-contain rounded-lg select-none" />}
            </div>
            {box.list.length > 1 && (
              <>
                <button className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setBox((b) => (b ? { ...b, i: (b.i - 1 + b.list.length) % b.list.length } : b)) }} aria-label="Precedente"><ChevronLeft size={22} className="text-white" /></button>
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setBox((b) => (b ? { ...b, i: (b.i + 1) % b.list.length } : b)) }} aria-label="Successiva"><ChevronRight size={22} className="text-white" /></button>
              </>
            )}
          </div>
        )
      })()}
    </Frame>
  )
}
