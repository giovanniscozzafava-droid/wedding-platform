import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, X, ChevronLeft, ChevronRight, Loader2, Upload, Play, QrCode, Heart, Mic, Camera, BookHeart, Image as ImageIcon, ArrowLeft, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PhotoSocial } from '@/components/event/PhotoSocial'
import { AudioWishes } from '@/components/event/AudioWishes'
import { Guestbook } from '@/components/event/Guestbook'
import { GUEST_TAG_GROUPS } from '@/lib/guestTags'

type GuestView = 'home' | 'upload' | 'audio' | 'guestbook' | 'gallery'

// Pagina ospite: link dedicato (?t=token), accesso SOLO previa registrazione.
// L'ospite vede le foto/video INVITATI e può CARICARE le proprie (consenso al riutilizzo
// promozionale OBBLIGATORIO). I fornitori del cerchio possono usarli. UX semplice e allegra.

type Media = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; guest_tag_name: string | null; uploader_name: string | null; uploaded_by: string | null }
type Folder = { id: string; name: string; gallery_media: Media[] }

const isDrive = (m: Media) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
const isVideo = (m: Media) => m.media_type === 'VIDEO'
const fullSrc = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2000` : (m.thumbnail_link ?? ''))
const origUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/uc?export=download&id=${m.drive_file_id}` : (m.thumbnail_link ?? ''))
const webUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

// UUID robusto: crypto.randomUUID() non esiste su Safari iOS più vecchi → senza fallback
// l'upload andava in errore silenzioso su quei telefoni.
function safeUuid(): string {
  try { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as Crypto).randomUUID() } catch { /* */ }
  return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

// Immagine → JPEG ridimensionato (lato lungo max 2200px). Risolve in un colpo:
// HEIC iPhone (Safari lo decodifica → esce JPEG visibile a tutti), foto da 12MP troppo
// pesanti (upload che falliva) e miniature che non si vedevano. Se la decodifica fallisce,
// si carica il file originale (non blocchiamo mai l'ospite).
async function imageToJpeg(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url })
    const max = 2200
    const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale)), h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('ctx')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h) // evita sfondo nero su PNG/screenshot trasparenti
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob || blob.size < 100) throw new Error('encode')
    return { blob, ext: 'jpg', type: 'image/jpeg' }
  } finally { URL.revokeObjectURL(url) }
}

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

// Frame a livello MODULO: se fosse dentro il componente, ogni render lo ricrea e
// React ri-monta gli input → su mobile si perde il focus a ogni lettera. Estratto = fluido.
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'rgb(var(--bg))' }}>
      <header className="border-b border-[rgb(var(--border))] px-5 py-3 flex items-center justify-between">
        <a href="https://planfully.it" target="_blank" rel="noreferrer" className="flex items-center gap-2">
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-6 w-6" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <span className="font-display text-lg">Planfully</span>
        </a>
        <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Foto & video dell'evento</span>
      </header>
      <main className="max-w-5xl mx-auto w-full p-5 flex-1">{children}</main>
      <footer className="text-center py-6 text-[11px] text-[rgb(var(--fg-subtle))]">
        Le foto del tuo matrimonio, organizzate con <a href="https://planfully.it" target="_blank" rel="noreferrer" className="underline">planfully.it</a>
      </footer>
    </div>
  )
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
  const [eventName, setEventName] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [box, setBox] = useState<{ list: Media[]; i: number } | null>(null)
  const [promo, setPromo] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProg, setUploadProg] = useState<{ done: number; total: number } | null>(null)
  const [view, setView] = useState<GuestView>('home')
  const [gtags, setGtags] = useState<string[]>([])
  const [noMinors, setNoMinors] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // registrazione ospite semplice (nome + email → dentro subito)
  const [gname, setGname] = useState('')
  const [gemail, setGemail] = useState('')
  const [gprivacy, setGprivacy] = useState(false)   // consenso OBBLIGATORIO al trattamento dati
  const [gmarketing, setGmarketing] = useState(false)
  const [signingUp, setSigningUp] = useState(false)

  const loadFolders = useCallback(async (entry: string) => {
    // Cartelle visibili all'ospite: le INVITATI (dove carica) + quelle che il fotografo ha aperto agli
    // ospiti (guest_visible, sola lettura). La RLS gm_read/gf_read gata comunque il contenuto.
    const { data: f } = await (supabase.from as any)('gallery_folders')
      .select('id, name, level, gallery_media(id, thumbnail_link, drive_file_id, media_type, guest_tag_name, uploader_name, uploaded_by)')
      .eq('entry_id', entry).or('level.eq.INVITATI,guest_visible.eq.true').order('sort_order')
    setFolders((f as Folder[]) ?? [])
  }, [])

  const join = useCallback(async () => {
    if (!galleryId) return
    setState('joining')
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; entry_id?: string; event_name?: string; error?: string } }> })
      .rpc('join_event_as_guest', { p_gallery_id: galleryId, p_token: token })
    if (!data?.ok || !data.entry_id) {
      setErrMsg(data?.error === 'bad_token' ? 'Link non valido o scaduto.' : data?.error === 'gallery_not_found' ? 'Galleria inesistente.' : 'Accesso non riuscito.')
      setState('error'); return
    }
    setEntryId(data.entry_id)
    setEventName(data.event_name ?? null)
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
    if (!promo) { toast.error('Spunta prima il consenso per caricare.'); return }
    if (!noMinors) { toast.error('Conferma che nella foto non ci sono minori.'); return }
    setUploading(true); setUploadProg({ done: 0, total: files.length })
    let ok = 0; let fail = 0; let lastErr = ''
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const isImg = file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)
      const isVid = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name)
      if (!isImg && !isVid) { fail++; setUploadProg({ done: i + 1, total: files.length }); continue }
      // immagini → JPEG ridimensionato (risolve HEIC iPhone + peso + visibilità). Video as-is.
      let blob: Blob = file
      let ext = (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase()
      let ctype = file.type || (isVid ? 'video/mp4' : 'image/jpeg')
      if (isImg) { try { const j = await imageToJpeg(file); blob = j.blob; ext = j.ext; ctype = j.type } catch { /* uso l'originale */ } }
      let done = false
      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        try {
          const path = `${entryId}/${user.id}/${safeUuid()}.${ext}`
          const up = await supabase.storage.from('event-guest-uploads').upload(path, blob, { upsert: false, contentType: ctype })
          if (up.error) throw up.error
          const pub = supabase.storage.from('event-guest-uploads').getPublicUrl(path).data.publicUrl
          const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; error?: string } }> })
            .rpc('guest_add_media', { p_entry: entryId, p_storage_path: path, p_thumb: pub, p_media_type: isVid ? 'VIDEO' : 'PHOTO', p_promo: true, p_tags: gtags, p_no_minors: noMinors })
          if (data?.error) throw new Error(data.error)
          ok++; done = true
        } catch (e) {
          lastErr = (e as Error).message || 'errore'
          if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt))
          else fail++
        }
      }
      setUploadProg({ done: i + 1, total: files.length })
    }
    setUploading(false); setUploadProg(null)
    await loadFolders(entryId)
    if (ok) {
      setGtags([])
      setView('gallery')   // l'ospite atterra in galleria e VEDE subito le sue foto (in cima)
      toast.success(fail ? `${ok} caricate, ${fail} non riuscite — riprova quelle.` : `Caricate ${ok}! Le trovi qui sotto nella galleria.`)
    } else {
      toast.error(`Caricamento non riuscito${lastErr ? ' (' + lastErr.slice(0, 60) + ')' : ''}. Controlla la rete e riprova.`)
    }
  }

  function toggleTag(key: string) {
    setGtags((s) => (s.includes(key) ? s.filter((t) => t !== key) : [...s, key]))
  }

  async function guestEnter(e: React.FormEvent) {
    e.preventDefault()
    if (gname.trim().length < 2 || !gemail.includes('@')) { toast.error('Inserisci nome e email'); return }
    if (!gprivacy) { toast.error('Per entrare devi acconsentire al trattamento dei dati'); return }
    setSigningUp(true)
    try {
      const { data, error } = await supabase.functions.invoke('guest-signup', { body: { email: gemail.trim(), name: gname.trim(), gallery_id: galleryId, token, commercial: gmarketing } })
      if (error) throw error
      const d = data as { token_hash?: string; error?: string; returning?: boolean; name?: string }
      if (d?.error || !d?.token_hash) throw new Error(d?.error === 'bad_token' ? 'Link non valido o scaduto.' : 'Registrazione non riuscita. Riprova.')
      let v = await supabase.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' })
      // alcune versioni di Supabase verificano il token_hash del magic-link come type 'email'
      if (v.error) v = await supabase.auth.verifyOtp({ token_hash: d.token_hash, type: 'email' })
      if (v.error) throw v.error
      const who = (d.name ?? gname.trim()).split(' ')[0]
      toast.success(d.returning ? `Bentornato, ${who}!` : `Benvenuto, ${who}!`)
      // sessione impostata → l'effetto su [session] fa partire join() e carica le foto
    } catch (err) { toast.error((err as Error).message) } finally { setSigningUp(false) }
  }

  if (authLoading || state === 'joining') {
    return <Frame><div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Carico…</div></Frame>
  }

  if (!session) {
    return (
      <Frame>
        <div className="max-w-sm mx-auto py-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]"><Heart size={26} className="fill-[rgb(var(--gold-500))]" /></span>
            <h1 className="font-display text-2xl">Le foto dell’evento</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Scrivi nome ed email ed entri subito: <strong>carichi le tue foto e i tuoi video</strong> e li condividi con tutti. Se gli organizzatori lo attivano, qui trovi anche le <strong>foto ufficiali</strong> da rivedere e scaricare.</p>
          </div>
          <form onSubmit={guestEnter} className="space-y-3">
            <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Nome e cognome" autoComplete="name"
              className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-base" />
            <input type="email" value={gemail} onChange={(e) => setGemail(e.target.value)} placeholder="La tua email" autoComplete="email"
              className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-4 py-3 text-base" />
            {/* Consenso OBBLIGATORIO: senza, non si entra a caricare/vedere nulla */}
            <label className="flex items-start gap-2 text-left cursor-pointer select-none px-1">
              <input type="checkbox" checked={gprivacy} onChange={(e) => setGprivacy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--gold-600))] shrink-0" />
              <span className="text-[11px] text-[rgb(var(--fg-muted))]">Acconsento al <strong>trattamento dei miei dati</strong> per accedere alla galleria e caricare/vedere foto, video e messaggi dell'evento. <Link to="/privacy" target="_blank" className="underline">Privacy</Link> <span className="text-[rgb(var(--rose-500))]">*obbligatorio</span></span>
            </label>
            <label className="flex items-start gap-2 text-left cursor-pointer select-none px-1">
              <input type="checkbox" checked={gmarketing} onChange={(e) => setGmarketing(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--gold-600))] shrink-0" />
              <span className="text-[11px] text-[rgb(var(--fg-muted))]">Acconsento a essere ricontattato/a anche per finalità commerciali da Planfully e dai fornitori. <span className="text-[rgb(var(--fg-subtle))]">(facoltativo)</span></span>
            </label>
            <Button type="submit" variant="gold" className="w-full !py-3 !text-base" disabled={signingUp || !gprivacy}>
              {signingUp ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} className="fill-current" />} Entra e guarda le foto
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
      {/* Hero: nome degli sposi + QR a scomparsa */}
      <div className="mb-6 text-center space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl flex items-center justify-center gap-2">
          <Heart size={20} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]" /> Le foto di {eventName ?? 'questo matrimonio'}
        </h1>
        <button onClick={() => setShowQr((s) => !s)} className="text-xs text-[rgb(var(--gold-700))] underline inline-flex items-center gap-1">
          <QrCode size={13} /> {showQr ? 'Nascondi QR' : 'Mostra QR per far entrare gli altri invitati'}
        </button>
        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-[rgb(var(--border))]">
              <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : ''} size={176} level="M" fgColor="#1A1714" bgColor="#ffffff" />
            </div>
            <p className="text-xs text-[rgb(var(--fg-muted))] max-w-xs">Mostralo agli altri invitati: lo inquadrano ed entrano.</p>
          </div>
        )}
      </div>

      {/* Menu "Cosa vuoi fare?" oppure la vista scelta */}
      {view !== 'home' && (
        <button onClick={() => setView('home')} className="mb-4 text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]"><ArrowLeft size={15} /> Torna al menu</button>
      )}

      {view === 'home' && (
        <>
          <p className="text-center text-sm text-[rgb(var(--fg-muted))] mb-3">Cosa vuoi fare?</p>
          <div className="grid grid-cols-2 gap-3 mb-8 max-w-xl mx-auto">
            <HubCard icon={<Camera size={24} />} title="Carica foto / video" desc="Condividi i tuoi scatti" onClick={() => setView('upload')} />
            <HubCard icon={<Mic size={24} />} title="Messaggio audio" desc="Un augurio a voce" onClick={() => setView('audio')} />
            <HubCard icon={<BookHeart size={24} />} title="Firma il guestbook" desc="Un pensiero e la tua firma" onClick={() => setView('guestbook')} />
            <HubCard icon={<ImageIcon size={24} />} title="Guarda la galleria" desc="Le foto dell'evento" onClick={() => setView('gallery')} />
          </div>
        </>
      )}

      {/* UPLOAD: consenso + tag + nessun minore */}
      {view === 'upload' && (
        <div className="mb-6 rounded-2xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Carica le tue foto e i tuoi video</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Le condividi con gli sposi e con i fornitori dell'evento.</p>
          </div>

          {/* tag: cosa hai fotografato (aiuta i professionisti a ritrovarle) */}
          <div className="rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] p-3 space-y-2">
            <p className="text-xs font-medium">Cosa hai fotografato? <span className="text-[rgb(var(--fg-subtle))]">(tocca i tag, anche più di uno)</span></p>
            {GUEST_TAG_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-1">{g.emoji} {g.group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => {
                    const on = gtags.includes(o.key)
                    return (
                      <button key={o.key} type="button" onClick={() => toggleTag(o.key)}
                        className={`text-[11px] px-2 py-1 rounded-full border transition ${on ? 'bg-[rgb(var(--gold-500))] text-white border-[rgb(var(--gold-500))]' : 'bg-[rgb(var(--bg))] border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'}`}>
                        {on && <Check size={11} className="inline mr-0.5" />}{o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* dichiarazione: nessun minore */}
          <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] p-3">
            <input type="checkbox" checked={noMinors} onChange={(e) => setNoMinors(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--gold-600))] shrink-0" />
            <span className="text-[13px] leading-snug">Confermo che <strong>nella foto non ci sono minori</strong> (o che ho il consenso di chi ne esercita la responsabilità). <span className="text-[rgb(var(--fg-subtle))]">Obbligatorio.</span></span>
          </label>

          {/* consenso promozionale */}
          <div className="rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--gold-600))] shrink-0" />
              <span className="text-[13px] leading-snug">
                {promo ? <span className="text-[rgb(var(--emerald-700))] font-medium">Autorizzazione accettata.</span> : <>Acconsento al <strong>riutilizzo anche promozionale</strong> delle foto/video che carico (liberatoria immagini). <span className="text-[rgb(var(--fg-subtle))]">Obbligatorio.</span></>}{' '}
                <button type="button" onClick={() => setLibOpen((o) => !o)} className="underline text-[rgb(var(--gold-700))]">{libOpen ? 'nascondi testo' : 'leggi il testo'}</button>
              </span>
            </label>
            {libOpen && (
              <p className="mt-2 text-[11px] text-[rgb(var(--fg-muted))] leading-snug border-t border-[rgb(var(--border))] pt-2">
                Carico volontariamente queste foto/video e dichiaro di esserne l'autore o di averne i diritti. Autorizzo a titolo <strong>gratuito</strong>, senza limiti di tempo né di territorio, gli sposi e i fornitori dell'evento (es. fotografo, videomaker, wedding planner) a conservare, riprodurre, pubblicare, esporre e diffondere il materiale caricato — compresa la mia immagine — anche per <strong>finalità promozionali, pubblicitarie e di marketing</strong>, su siti web, social, portfolio, fiere e stampa. Vale come liberatoria ai sensi degli artt. 10 e 320 c.c., degli artt. 96-97 L. 633/1941 e come consenso ex Reg. UE 2016/679 (GDPR). Dichiaro che le persone ritratte hanno prestato il loro consenso.
              </p>
            )}
          </div>

          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e) => { const snap = e.target.files ? Array.from(e.target.files) : []; e.target.value = ''; if (snap.length) void uploadGuestMedia(snap) }} />
          <Button variant="gold" className="w-full !py-3 !text-base" disabled={!promo || !noMinors || uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {uploading ? (uploadProg ? `Carico ${uploadProg.done}/${uploadProg.total}…` : 'Carico…') : 'Carica foto / video'}
          </Button>
          {!uploading && (!promo || !noMinors) && <p className="text-[11px] text-[rgb(var(--rose-500))] text-center">Spunta i due consensi qui sopra per attivare il caricamento.</p>}
          {uploading && uploadProg && <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden"><div className="h-full bg-[rgb(var(--gold-500))] transition-all" style={{ width: `${Math.round((uploadProg.done / Math.max(1, uploadProg.total)) * 100)}%` }} /></div>}
          {uploading && <p className="text-[11px] text-[rgb(var(--fg-subtle))] text-center">Tieni aperta questa pagina fino a fine caricamento.</p>}
        </div>
      )}

      {view === 'audio' && entryId && <AudioWishes entryId={entryId} />}
      {view === 'guestbook' && entryId && <Guestbook entryId={entryId} />}

      {view === 'gallery' && (
        folders.length === 0 || allEmpty ? (
          <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">Ancora nessuna foto. Sii il primo a caricare i tuoi scatti!</p>
        ) : (
          folders.map((f) => {
            const mine = (m: Media) => !!user && m.uploaded_by === user.id
            const list = [...f.gallery_media].sort((a, b) => Number(mine(b)) - Number(mine(a))) // le tue prima
            return (
            <section key={f.id} className="mb-8">
              <h2 className="font-medium mb-3">{f.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {list.map((m, idx) => (
                  <button key={m.id} type="button" onClick={() => setBox({ list, i: idx })}
                    className={`group relative rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))] cursor-zoom-in ${mine(m) ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`} style={{ aspectRatio: '4/3' }}>
                    {isVideo(m) && !isDrive(m)
                      ? <video src={m.thumbnail_link ?? ''} muted preload="metadata" className="w-full h-full object-cover" />
                      : m.thumbnail_link && <img src={m.thumbnail_link} alt={m.guest_tag_name ?? ''} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />}
                    {isVideo(m) && <span className="absolute inset-0 flex items-center justify-center"><Play size={20} className="text-white fill-white opacity-90 drop-shadow" /></span>}
                    {mine(m)
                      ? <span className="absolute top-1 left-1 bg-[rgb(var(--gold-500))] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">Tua</span>
                      : m.uploader_name && <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded-full">da {m.uploader_name}</span>}
                    {m.guest_tag_name && <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1 py-0.5 truncate text-left">{m.guest_tag_name}</span>}
                  </button>
                ))}
              </div>
            </section>
            )
          })
        )
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
            <div className="px-4 pb-4 max-w-xl mx-auto w-full" onClick={(e) => e.stopPropagation()}>
              <PhotoSocial mediaId={m.id} />
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

// Card grande e amichevole del menu "Cosa vuoi fare?"
function HubCard({ icon, title, desc, onClick }: { icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4 text-left hover:shadow-[var(--shadow-lift)] hover:border-[rgb(var(--gold-300))] transition flex flex-col gap-2 min-h-[112px]">
      <span className="h-11 w-11 rounded-xl bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] flex items-center justify-center">{icon}</span>
      <span className="font-medium text-sm leading-tight">{title}</span>
      <span className="text-[11px] text-[rgb(var(--fg-muted))] leading-tight">{desc}</span>
    </button>
  )
}
