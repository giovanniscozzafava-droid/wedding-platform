import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Images, FolderPlus, Plus, Check, Lock, Globe, Users, ShieldCheck, Trash2, Sparkles, Upload, Download, X, ChevronLeft, ChevronRight, Play, Maximize2, Link2, Heart, FileArchive, HardDrive, Settings, BookOpen, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { guestTagLabel } from '@/lib/guestTags'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'
import { getDriveToken, ensureDriveFolder, uploadAnyToDrive } from '@/lib/driveUpload'
import { AlbumPicker, type AlbumMedia } from './AlbumPicker'
import { QRCodeSVG } from 'qrcode.react'
import { exportTableTents } from '@/lib/tableTents'
import { PhotoSocial } from './PhotoSocial'
import { GallerySettingsPanel, DEFAULT_GALLERY_SETTINGS, type GallerySettings } from './GallerySettingsPanel'

// Tab "Foto" dell'evento. Stessa superficie per tutti, ma cosa vedi/fai dipende
// dal ruolo (la spina RLS gata il contenuto): il fotografo (owner) gestisce e
// carica; gli sposi vedono tutto + danno il consenso; i fornitori vedono solo
// ciò che li riguarda. I file veri stanno sul Drive del fotografo; qui le anteprime.

type Media = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; guest_tag_name: string | null; price_cents: number | null; album_choice?: 'KEPT' | 'DISCARDED' | null; uploaded_by?: string | null; uploader_name?: string | null; guest_tags?: string[] | null; no_minors?: boolean | null }
type Folder = { id: string; name: string; level: string; shared: boolean; assigned_subrole: string | null; assigned_to: string | null; sort_order: number; drive_folder_id: string | null; is_for_sale: boolean; price_cents: number | null; gallery_media: Media[] }
type Gallery = { id: string; owner_id: string; title: string }

const LEVELS = [
  { v: 'LAVORO_INTERO', l: 'Lavoro intero (sposi)', icon: Lock },
  { v: 'LAVORAZIONE', l: 'Lavorazione (un fornitore)', icon: Users },
  { v: 'INVITATI', l: 'Invitati (ritratti)', icon: Globe },
] as const

export function EventGalleryTab({ entryId, role }: { entryId: string; role: 'capostipite' | 'fornitore' | 'sposi' }) {
  const [me, setMe] = useState<string | null>(null)
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [consentOn, setConsentOn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [galleryProg, setGalleryProg] = useState<{ done: number; total: number; name?: string; frac?: number } | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploadFolder, setUploadFolder] = useState<Folder | null>(null)
  const [salesEnabled, setSalesEnabled] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [guestLinkUrl, setGuestLinkUrl] = useState<string | null>(null)
  const [driveModal, setDriveModal] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gsettings, setGsettings] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS)
  // nuova cartella
  const [nf, setNf] = useState<{ open: boolean; name: string; level: string; subrole: string }>({ open: false, name: '', level: 'LAVORO_INTERO', subrole: '' })
  // lightbox: lista di foto della cartella aperta + indice corrente
  const [box, setBox] = useState<{ list: Media[]; i: number } | null>(null)

  const isOwner = !!gallery && gallery.owner_id === me

  const load = useCallback(async () => {
    setLoading(true)
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    setMe(uid)
    const { data: gal } = await (supabase.from as any)('event_galleries').select('id, owner_id, title').eq('entry_id', entryId).maybeSingle()
    setGallery((gal as Gallery) ?? null)
    if (gal) {
      const { data: gs } = await (supabase.from as any)('gallery_settings').select('*').eq('gallery_id', (gal as Gallery).id).maybeSingle()
      if (gs) setGsettings({ ...DEFAULT_GALLERY_SETTINGS, ...gs })
    }
    const { data: f } = await (supabase.from as any)('gallery_folders')
      .select('id, name, level, shared, assigned_subrole, assigned_to, sort_order, drive_folder_id, is_for_sale, price_cents, gallery_media(id, thumbnail_link, drive_file_id, media_type, guest_tag_name, price_cents, album_choice, uploaded_by, uploader_name, guest_tags, no_minors)')
      .eq('entry_id', entryId).order('sort_order')
    setFolders((f as Folder[]) ?? [])
    const { data: flag } = await (supabase.from as any)('feature_flags').select('enabled').eq('key', 'photo_sales_enabled').maybeSingle()
    setSalesEnabled(!!flag?.enabled)
    const { data: c } = await (supabase.from as any)('gallery_consents').select('granted_at, revoked_at').eq('entry_id', entryId).eq('scope', 'LAVORO_INTERO').maybeSingle()
    setConsentOn(!!c && c.granted_at && !c.revoked_at)
    setLoading(false)
  }, [entryId])

  useEffect(() => { void load() }, [load])

  // navigazione lightbox da tastiera (Esc chiude, frecce scorrono)
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

  // un media è su Drive vero (non demo Pexels) → URL pubblici per anteprima/intero/download
  const isDrive = (m: Media) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
  const fullSrc = (m: Media) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w2000` : (m.thumbnail_link ?? ''))
  const origUrl = (m: Media) => (isDrive(m) ? `https://drive.google.com/uc?export=download&id=${m.drive_file_id}` : (m.thumbnail_link ?? ''))

  // scarica: prova blob (per forzare il download), fallback ad aprire l'URL (Drive
  // serve l'originale come allegato comunque). I byte NON passano da Planfully.
  async function downloadUrl(url: string, name: string) {
    if (!url) return
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch { window.open(url, '_blank') }
  }

  async function createGallery() {
    setBusy(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      const { error } = await (supabase.from as any)('event_galleries').insert({ entry_id: entryId, owner_id: uid, title: 'Le mie foto' })
      if (error) throw error
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  async function createFolder() {
    if (!gallery || !nf.name.trim()) { toast.error('Nome cartella richiesto'); return }
    setBusy(true)
    try {
      const { error } = await (supabase.from as any)('gallery_folders').insert({
        gallery_id: gallery.id, entry_id: entryId, name: nf.name.trim(), level: nf.level,
        assigned_subrole: nf.level === 'LAVORAZIONE' ? (nf.subrole || null) : null,
        shared: false, sort_order: folders.length,
      })
      if (error) throw error
      setNf({ open: false, name: '', level: 'LAVORO_INTERO', subrole: '' })
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  async function toggleShared(f: Folder) {
    const { error } = await (supabase.from as any)('gallery_folders').update({ shared: !f.shared }).eq('id', f.id)
    if (error) { toast.error(error.message); return }
    await load()
  }

  async function deleteFolder(f: Folder) {
    if (!confirm(`Eliminare la cartella "${f.name}" e le sue foto?`)) return
    const { error } = await (supabase.from as any)('gallery_folders').delete().eq('id', f.id)
    if (error) { toast.error(error.message); return }
    await load()
  }

  // Link ospiti: genera/recupera il token e copia il link dedicato (accesso solo
  // previa registrazione, mostra SOLO le foto INVITATI).
  async function shareGuestLink() {
    if (!gallery) return
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { token?: string; error?: string } }> })
      .rpc('gallery_enable_guest_link', { p_gallery_id: gallery.id })
    if (!data?.token) { toast.error(data?.error === 'forbidden' ? 'Solo il proprietario della galleria.' : 'Link non generato'); return }
    const url = `${window.location.origin}/galleria/${gallery.id}?t=${data.token}`
    setGuestLinkUrl(url)
    try { await navigator.clipboard.writeText(url); toast.success('Link ospiti copiato — mostra il QR agli invitati') }
    catch { /* il QR resta comunque visibile */ }
  }

  // Clausola a pagamento per CARTELLA (gated dal flag photo_sales_enabled). La
  // riscossione vera (Stripe) e il gating del download sono pendenti.
  async function setFolderPrice(f: Folder) {
    const cur = f.is_for_sale && f.price_cents ? (f.price_cents / 100).toString() : ''
    const v = prompt(`Prezzo della cartella «${f.name}» in € (vuoto = non in vendita):`, cur)
    if (v === null) return
    const euros = parseFloat(v.replace(',', '.'))
    const onSale = !isNaN(euros) && euros > 0
    const { error } = await (supabase.from as any)('gallery_folders').update({ is_for_sale: onSale, price_cents: onSale ? Math.round(euros * 100) : null }).eq('id', f.id)
    if (error) { toast.error(error.message); return }
    toast.success(onSale ? `Cartella in vendita a €${euros.toFixed(2)}` : 'Cartella non più in vendita')
    await load()
  }

  // Scarica in ZIP SOLO le foto/video selezionati per l'album (album_choice='KEPT').
  // Lato server (edge album-zip) col token Drive dell'owner → lo possono fare anche gli sposi.
  async function downloadSelectedZip(size: 'web' | 'original' = 'original') {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('album-zip', { body: { entry_id: entryId, size } })
      if (error) {
        let msg = (error as Error).message
        try { const b = await (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) msg = b.error === 'empty' || b.error === 'no_selection' ? 'Nessun file scaricabile (Drive collegato?)' : b.error } catch { /* ignore */ }
        throw new Error(msg)
      }
      if (!(data instanceof Blob)) throw new Error('ZIP non riuscito')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(data); a.download = size === 'web' ? 'album-selezione-web.zip' : 'album-selezione-originale.zip'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      toast.success(size === 'web' ? 'ZIP web pronto' : 'ZIP originale pronto')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  // Elimina una singola foto/video caricato da un ospite (owner della galleria o sposi).
  async function deleteGuestMedia(m: Media) {
    if (!confirm('Eliminare questo file caricato da un invitato?')) return
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; error?: string; path?: string } }> })
      .rpc('delete_guest_media', { p_media: m.id })
    if (data?.error) {
      toast.error(data.error === 'forbidden' ? 'Non puoi eliminare questo file.' : data.error === 'not_guest_media' ? 'Qui si eliminano solo i file caricati dagli ospiti.' : data.error)
      return
    }
    if (data?.path) { try { await supabase.storage.from('event-guest-uploads').remove([data.path]) } catch { /* riga già eliminata */ } }
    toast.success('File eliminato')
    setBox(null)
    await load()
  }

  // Carica foto demo (Pexels) per dimostrare la galleria viva (l'upload vero va su Drive).
  async function addDemoPhotos(f: Folder) {
    if (!gallery) return
    setBusy(true)
    try {
      const q = f.level === 'INVITATI' ? 'wedding guests portrait' : 'wedding celebration photography'
      const { data } = await supabase.functions.invoke('pexels-search', { body: { query: q, per_page: 8, orientation: 'landscape' } })
      const photos = (data as any)?.photos ?? []
      const rows = photos.map((p: any, i: number) => ({
        folder_id: f.id, gallery_id: gallery.id, entry_id: entryId,
        drive_file_id: `demo-${p.id}`, thumbnail_link: p.src?.medium ?? null, media_type: 'PHOTO',
        guest_tag_name: f.level === 'INVITATI' ? ['Giuseppe Esposito', 'Anna Russo', 'Marco Bianchi'][i % 3] : null,
      }))
      if (rows.length) {
        const { error } = await (supabase.from as any)('gallery_media').insert(rows)
        if (error) throw error
      }
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  // Upload reale browser→Drive: token effimero, cartella Drive condivisa, file
  // diretti a Drive (non passano da Planfully), poi salvo id + miniatura pubblica.
  async function uploadPhotos(f: Folder, files: File[]) {
    if (!gallery || files.length === 0) return
    setBusy(true); setGalleryProg({ done: 0, total: files.length, name: files[0]?.name, frac: 0 })
    try {
      const token = await getDriveToken()
      const driveFolder = await ensureDriveFolder(token, `Planfully · ${f.name}`, f.drive_folder_id)
      if (driveFolder !== f.drive_folder_id) await (supabase.from as any)('gallery_folders').update({ drive_folder_id: driveFolder }).eq('id', f.id)
      const rows: Record<string, unknown>[] = []
      const fails: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        setGalleryProg({ done: i, total: files.length, name: file.name, frac: 0 })
        try {
          const { id, thumbnail } = await uploadAnyToDrive(token, driveFolder, file, (frac) => setGalleryProg((p) => (p ? { ...p, frac } : p)))
          rows.push({ folder_id: f.id, gallery_id: gallery.id, entry_id: entryId, drive_file_id: id, thumbnail_link: thumbnail, media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO' })
        } catch (e) { fails.push(`${file.name}: ${(e as Error).message}`) }
      }
      if (rows.length) { const { error } = await (supabase.from as any)('gallery_media').insert(rows); if (error) throw error }
      if (fails.length) toast.error(`${rows.length} caricati, ${fails.length} falliti — ${fails[0]}`)
      else toast.success(`${rows.length} file caricati sul tuo Drive`)
      await load()
    } catch (e) {
      if ((e as { driveReason?: string }).driveReason) setDriveModal(true)
      else toast.error((e as Error).message)
    } finally { setBusy(false); setUploadFolder(null); setGalleryProg(null) }
  }

  async function setConsent(on: boolean) {
    setBusy(true)
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (on) {
        const { error } = await (supabase.from as any)('gallery_consents')
          .upsert({ entry_id: entryId, scope: 'LAVORO_INTERO', granted_by: uid, granted_at: new Date().toISOString(), revoked_at: null }, { onConflict: 'entry_id,scope' })
        if (error) throw error
      } else {
        const { error } = await (supabase.from as any)('gallery_consents').update({ revoked_at: new Date().toISOString(), revoked_by: uid }).eq('entry_id', entryId).eq('scope', 'LAVORO_INTERO')
        if (error) throw error
      }
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  if (loading) return <div className="text-sm text-[rgb(var(--fg-subtle))] py-8">Carico le foto…</div>

  // Nessuna galleria: il fornitore (fotografo) può crearla; gli altri vedono lo stato vuoto.
  if (!gallery) {
    return (
      <Card className="p-8 text-center">
        <Images size={28} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
        <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Ancora nessuna galleria per questo evento.</p>
        {role !== 'sposi' && <Button variant="gold" disabled={busy} onClick={createGallery}><Plus size={14} /> Crea la mia galleria</Button>}
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* input file nascosto per l'upload su Drive */}
      <input ref={uploadRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={(e) => { const snap = e.target.files ? Array.from(e.target.files) : []; e.target.value = ''; if (snap.length && uploadFolder) void uploadPhotos(uploadFolder, snap) }} />

      {/* BARRA DI AVANZAMENTO TOTALE del batch (foto/video sull'intera cartella) */}
      {galleryProg && (() => {
        const overall = Math.min(100, Math.round(((galleryProg.done + (galleryProg.frac ?? 0)) / galleryProg.total) * 100))
        return (
          <Card className="p-3 sticky top-2 z-20 shadow-[var(--shadow-lift)]">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-medium inline-flex items-center gap-1.5"><Upload size={13} className="text-[rgb(var(--gold-600))]" /> Caricamento foto — {Math.min(galleryProg.done + 1, galleryProg.total)} di {galleryProg.total}</span>
              <span className="tabular-nums font-semibold">{overall}%</span>
            </div>
            {galleryProg.name && <p className="text-[11px] text-[rgb(var(--fg-muted))] truncate mb-1.5">{galleryProg.name}</p>}
            <div className="h-2.5 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
              <div className="h-full bg-[rgb(var(--gold-500))] transition-all duration-150" style={{ width: `${overall}%` }} />
            </div>
          </Card>
        )
      })()}


      {/* Consenso sposi al lavoro intero */}
      {role === 'sposi' && (
        <Card className="p-4 flex items-start gap-3">
          <ShieldCheck size={20} className="shrink-0 mt-0.5" style={{ color: consentOn ? 'rgb(var(--emerald-600))' : 'rgb(var(--fg-subtle))' }} />
          <div className="flex-1">
            <p className="text-sm font-medium">Condivisione del servizio completo con i fornitori del cerchio</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{consentOn ? 'Hai acconsentito: i fornitori del cerchio possono vedere il lavoro intero (revocabile).' : 'Senza il tuo consenso, i fornitori NON vedono le foto con i vostri primi piani.'}</p>
          </div>
          <Button variant={consentOn ? 'outline' : 'gold'} size="sm" disabled={busy} onClick={() => setConsent(!consentOn)}>
            {consentOn ? 'Revoca' : 'Acconsento'}
          </Button>
        </Card>
      )}

      {/* Sposi: selezione foto/video per l'album (stile Tinder) */}
      {role === 'sposi' && folders.some((f) => f.gallery_media.length > 0) && (
        <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">Scegli le foto per l'album</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Una alla volta: tieni o scarta. Gli scarti li puoi sempre recuperare.</p>
          </div>
          <Button variant="gold" size="sm" onClick={() => setAlbumOpen(true)}><Images size={14} /> Inizia la selezione</Button>
        </Card>
      )}

      {/* Album: il fotografo impagina/esporta; gli sposi visualizzano e chiedono modifiche.
          Per gli sposi la card è SEMPRE visibile (anche prima che ci siano foto), così possono entrare. */}
      {(isOwner || role === 'sposi') && (role === 'sposi' || folders.some((f) => f.gallery_media.length > 0)) && (
        <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium flex items-center gap-2"><BookOpen size={16} className="text-[rgb(var(--gold-600))]" /> {role === 'sposi' ? 'Visualizza album e richiedi modifiche' : 'Impaginatore album'}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{role === 'sposi' ? 'Sfoglia l’album impaginato dal fotografo: dove vuoi cambiare qualcosa (foto, posizione, ritaglio) chiedi una modifica.' : 'Impagina e rifinisci in tutti i formati, poi esporta PDF / JPG.'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/album/${entryId}`} target="_blank" rel="noreferrer"><Button variant="gold" size="sm"><BookOpen size={14} /> {role === 'sposi' ? 'Visualizza album' : 'Apri impaginatore'}</Button></Link>
            {isOwner && <Link to={`/album-copertina/${entryId}`}><Button variant="outline" size="sm" title="Configura la copertina con il mockup 3D e invia in stampa a FotoLab"><Printer size={14} /> Copertina 3D & stampa</Button></Link>}
          </div>
        </Card>
      )}

      {/* Selezione album → scarica solo le selezionate in ZIP (fotografo e sposi) */}
      {(isOwner || role === 'sposi') && folders.some((f) => f.gallery_media.some((m) => m.album_choice === 'KEPT')) && (
        <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Heart size={16} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))]" />
            <p className="text-sm">{role === 'sposi' ? 'Hai selezionato' : 'Gli sposi hanno selezionato'} <strong>{folders.reduce((n, f) => n + f.gallery_media.filter((m) => m.album_choice === 'KEPT').length, 0)}</strong> file per l'album.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {role === 'sposi' && (
              <Button variant="gold" size="sm" disabled={busy} onClick={async () => {
                setBusy(true)
                const { data, error } = await (supabase.rpc as any)('album_request_layout', { p_entry: entryId })
                setBusy(false)
                if (error || (data as any)?.error) { toast.error('Non riuscito: ' + (error?.message ?? (data as any)?.error)); return }
                toast.success('Perfetto! Selezione confermata: il fotografo può impaginare la bozza.')
              }}><Check size={14} /> Ok, puoi impaginare la bozza</Button>
            )}
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void downloadSelectedZip('web')} title="ZIP leggero ~1600px"><FileArchive size={14} /> ZIP Web</Button>
            {role === 'sposi' && <Button variant="outline" size="sm" disabled={busy} onClick={() => void downloadSelectedZip('original')} title="ZIP a piena risoluzione — riservato agli sposi"><FileArchive size={14} /> ZIP Originale</Button>}
            {isOwner && <Link to={`/album-copertina/${entryId}`}><Button variant="outline" size="sm" title="Configura la copertina 3D e invia in stampa"><Printer size={14} /> Copertina & stampa</Button></Link>}
          </div>
        </Card>
      )}

      {/* Plancia owner: nuova cartella */}
      {isOwner && (
        <Card className="p-4">
          {!nf.open ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setNf((s) => ({ ...s, open: true }))}><FolderPlus size={14} /> Nuova cartella</Button>
              <Button variant="ghost" size="sm" onClick={shareGuestLink}><Link2 size={14} /> Link ospiti</Button>
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}><Settings size={14} /> Impostazioni galleria</Button>
              <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Il link mostra agli invitati SOLO le cartelle «Invitati» (accesso con registrazione).</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Nome</Label><Input value={nf.name} onChange={(e) => setNf((s) => ({ ...s, name: e.target.value }))} placeholder="Es. Servizio completo" /></div>
                <div className="space-y-1"><Label>Livello</Label>
                  <Select value={nf.level} onChange={(e) => setNf((s) => ({ ...s, level: e.target.value }))}>
                    {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
                  </Select></div>
                {nf.level === 'LAVORAZIONE' && (
                  <div className="space-y-1"><Label>Per il ruolo</Label>
                    <Select value={nf.subrole} onChange={(e) => setNf((s) => ({ ...s, subrole: e.target.value }))}>
                      <option value="">— scegli —</option>
                      {SUPPLIER_SUBROLES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </Select></div>
                )}
              </div>
              {nf.level === 'LAVORAZIONE' && <p className="text-[11px] text-[rgb(var(--gold-700))]">Visibile solo al fornitore di quel ruolo nel cerchio. Niente primi piani degli sposi qui.</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNf({ open: false, name: '', level: 'LAVORO_INTERO', subrole: '' })}>Annulla</Button>
                <Button variant="gold" size="sm" disabled={busy} onClick={createFolder}>Crea cartella</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {folders.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessuna cartella ancora.</p>}

      {folders.map((f) => {
        const lvl = LEVELS.find((l) => l.v === f.level)
        const isGuestFolder = f.level === 'INVITATI'
        // Catalogo: tag presenti tra le foto degli ospiti, per filtrare/distribuire ai professionisti.
        const availTags = isGuestFolder ? Array.from(new Set(f.gallery_media.flatMap((m) => m.guest_tags ?? []))) : []
        const fMedia = isGuestFolder && tagFilter.length
          ? f.gallery_media.filter((m) => (m.guest_tags ?? []).some((t) => tagFilter.includes(t)))
          : f.gallery_media
        return (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                {lvl && <lvl.icon size={16} className="text-[rgb(var(--gold-700))]" />}
                <h3 className="font-medium">{f.name} <span className="text-xs font-normal text-[rgb(var(--fg-subtle))]">({f.gallery_media.length} foto)</span></h3>
                <Badge className="bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))] text-[10px]">{lvl?.l ?? f.level}</Badge>
                {f.level === 'LAVORO_INTERO' && (f.shared
                  ? <Badge className="bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))] text-[10px]"><Check size={10} /> condivisa</Badge>
                  : <Badge className="bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))] text-[10px]">non condivisa</Badge>)}
                {salesEnabled && f.is_for_sale && <Badge className="bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] text-[10px]">€{((f.price_cents ?? 0) / 100).toFixed(0)} a pagamento</Badge>}
              </div>
              {isOwner && (
                <div className="flex items-center gap-1.5">
                  {f.level === 'LAVORO_INTERO' && <Button variant="outline" size="sm" disabled={busy} onClick={() => toggleShared(f)}>{f.shared ? 'Non condividere' : 'Condividi al cerchio'}</Button>}
                  <Button variant="gold" size="sm" disabled={busy} onClick={() => { setUploadFolder(f); uploadRef.current?.click() }}><Upload size={12} /> Carica foto</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => addDemoPhotos(f)}><Sparkles size={12} /> Foto demo</Button>
                  {salesEnabled && <Button variant="outline" size="sm" onClick={() => setFolderPrice(f)}>{f.is_for_sale ? `€${((f.price_cents ?? 0) / 100).toFixed(0)}` : 'Prezzo'}</Button>}
                  <Button variant="ghost" size="icon" onClick={() => deleteFolder(f)}><Trash2 size={13} /></Button>
                </div>
              )}
            </div>
            {/* Catalogo foto ospiti: filtro per tag (per ritrovarle e distribuirle) */}
            {isGuestFolder && availTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Filtra:</span>
                {availTags.map((t) => {
                  const on = tagFilter.includes(t)
                  return (
                    <button key={t} type="button" onClick={() => setTagFilter((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${on ? 'bg-[rgb(var(--gold-500))] text-white border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'}`}>{guestTagLabel(t)}</button>
                  )
                })}
                {tagFilter.length > 0 && <button type="button" onClick={() => setTagFilter([])} className="text-[11px] text-[rgb(var(--fg-subtle))] underline">azzera</button>}
              </div>
            )}
            {fMedia.length === 0 ? (
              <p className="text-xs text-[rgb(var(--fg-subtle))]">{isGuestFolder && tagFilter.length ? 'Nessuna foto con questi tag.' : <>Nessuna foto. {isOwner && 'Usa “Carica foto” (vanno sul tuo Drive) o “Foto demo”.'}</>}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {fMedia.map((m, idx) => (
                  <button key={m.id} type="button" onClick={() => setBox({ list: fMedia, i: idx })}
                    className="group relative rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))] cursor-zoom-in" style={{ aspectRatio: '4/3' }}>
                    {m.media_type === 'VIDEO' && !isDrive(m)
                      ? <video src={m.thumbnail_link ?? ''} muted preload="metadata" className="w-full h-full object-cover" />
                      : m.thumbnail_link && <img src={m.thumbnail_link} alt={m.guest_tag_name ?? ''} className="w-full h-full object-cover transition group-hover:scale-105" loading="lazy" />}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition">
                      {m.media_type === 'VIDEO'
                        ? <Play size={20} className="text-white opacity-80 fill-white" />
                        : <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-90 transition" />}
                    </span>
                    {m.uploader_name && <span className="absolute top-1 left-1 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded-full">da {m.uploader_name}</span>}
                    {m.no_minors && <span className="absolute top-1 right-1" title="L'invitato dichiara: nessun minore"><ShieldCheck size={13} className="text-emerald-300 drop-shadow" /></span>}
                    {(m.guest_tags && m.guest_tags.length > 0)
                      ? <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate text-left">{m.guest_tags.map(guestTagLabel).join(' · ')}</span>
                      : m.guest_tag_name && <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1 py-0.5 truncate text-left">{m.guest_tag_name}</span>}
                    {m.album_choice === 'KEPT' && <span className="absolute top-1 right-5"><Heart size={12} className="fill-[rgb(var(--gold-500))] text-[rgb(var(--gold-500))] drop-shadow" /></span>}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {/* Pannello impostazioni galleria (fotografo) */}
      {settingsOpen && gallery && (
        <GallerySettingsPanel galleryId={gallery.id} onClose={() => setSettingsOpen(false)} onSaved={(s) => setGsettings(s)} />
      )}

      {/* Popup: serve collegare Google Drive per caricare le proprie foto */}
      {driveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDriveModal(false)}>
          <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-xl p-6 text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] mx-auto"><HardDrive size={24} /></span>
            <h4 className="font-display text-lg">Collega Google Drive per caricare</h4>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Le tue foto e i tuoi video restano sul <strong>tuo</strong> Google Drive — Planfully ne mostra solo le anteprime e gestisce chi-vede-cosa. Si collega una volta sola, in pochi secondi.</p>
            <div className="flex gap-2 justify-center pt-1">
              <Button variant="gold" onClick={() => { window.location.href = '/profile' }}>Vai al profilo e collega</Button>
              <Button variant="ghost" onClick={() => setDriveModal(false)}>Più tardi</Button>
            </div>
          </div>
        </div>
      )}

      {/* QR del link ospiti: da mostrare/stampare all'evento */}
      {guestLinkUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setGuestLinkUrl(null)}>
          <div className="bg-[rgb(var(--bg))] rounded-2xl p-6 max-w-sm w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display text-lg">QR per gli invitati</h4>
            <div className="rounded-2xl bg-white p-4 inline-block border border-[rgb(var(--border))]"><QRCodeSVG value={guestLinkUrl} size={220} level="M" fgColor="#1A1714" bgColor="#ffffff" /></div>
            <p className="text-xs text-[rgb(var(--fg-muted))]">Stampalo o mostralo all'evento: gli invitati lo inquadrano, si registrano e vedono/caricano le foto.</p>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Oppure stampa il <strong>cavaliere da tavolo</strong>: un A4 da ritagliare e piegare, con base a incastro che lo tiene in piedi e QR su entrambe le facce. Stampane uno per tavolo.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(guestLinkUrl); toast.success('Link copiato') }}>Copia link</Button>
              <Button variant="outline" size="sm" onClick={async () => {
                let cn: string | undefined
                try {
                  // client_name è PII (RLS): un fornitore collaboratore può non leggerlo → uso il TITOLO
                  // dell'evento come ripiego (di norma = nome coppia, leggibile dai partecipanti).
                  const { data } = await (supabase.from as any)('calendar_entries').select('title, calendar_entries_private(client_name)').eq('id', entryId).maybeSingle()
                  const priv = (data as any)?.calendar_entries_private
                  cn = (Array.isArray(priv) ? priv[0]?.client_name : priv?.client_name) || (data as any)?.title || undefined
                } catch { /* copy generica se nemmeno il titolo è leggibile */ }
                void exportTableTents({ url: guestLinkUrl, coupleNames: cn }).catch((e) => toast.error('PDF non riuscito: ' + ((e as Error).message || 'errore')))
              }}>Cavaliere da tavolo (PDF)</Button>
              <Button variant="gold" size="sm" onClick={() => setGuestLinkUrl(null)}>Chiudi</Button>
            </div>
          </div>
        </div>
      )}

      {/* Selezione album (sposi) */}
      {albumOpen && (
        <AlbumPicker
          media={folders.flatMap((f) => f.gallery_media) as AlbumMedia[]}
          onClose={() => { setAlbumOpen(false); void load() }}
          onChanged={() => { /* salvataggio già persistito via RPC */ }}
        />
      )}

      {/* Lightbox: ingrandisci, vedi intera, scarica (originale o web) */}
      {box && (() => {
        const m = box.list[box.i]
        if (!m) return null
        const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
        const base = (m.guest_tag_name || 'planfully-foto').replace(/[^\w\- ]+/g, '').trim() || 'planfully-foto'
        return (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={() => setBox(null)}>
            <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-white/70">{box.i + 1} / {box.list.length}</span>
              <div className="flex items-center gap-2">
                <a href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/photo-web?m=${m.id}&apikey=${import.meta.env.VITE_SUPABASE_ANON_KEY}`} download><Button variant="outline" size="sm" className="!bg-white/10 !text-white !border-white/40 hover:!bg-white/20 backdrop-blur" title="Scarica JPEG web (~2048px), file reale"><Download size={14} /> Web</Button></a>
                {role === 'sposi' && <Button variant="gold" size="sm" onClick={() => downloadUrl(origUrl(m), `${base}.${ext}`)} title="File originale a piena risoluzione — riservato agli sposi"><Download size={14} /> Originale</Button>}
                {m.uploaded_by && (isOwner || role === 'sposi') && (
                  <Button variant="outline" size="sm" className="!bg-rose-500/20 !text-white !border-rose-300/50 hover:!bg-rose-500/40 backdrop-blur" onClick={() => deleteGuestMedia(m)} title="Elimina questo file caricato da un invitato"><Trash2 size={14} /> Elimina</Button>
                )}
                <button className="p-1.5 rounded hover:bg-white/10" onClick={() => setBox(null)} aria-label="Chiudi"><X size={18} className="text-white" /></button>
              </div>
            </div>
            <div className="relative flex-1 flex items-center justify-center px-4 pb-6 min-h-0" onClick={(e) => e.stopPropagation()}>
              {m.media_type === 'VIDEO'
                ? (isDrive(m)
                    ? <iframe src={`https://drive.google.com/file/d/${m.drive_file_id}/preview`} className="w-full max-w-4xl aspect-video rounded-lg" allow="autoplay" title={base} />
                    : <video src={m.thumbnail_link ?? ''} controls autoPlay className="max-w-full max-h-full rounded-lg" />)
                : <img src={fullSrc(m)} alt={m.guest_tag_name ?? ''} className="max-w-full max-h-full object-contain rounded-lg select-none" />}
              {gsettings.watermark_enabled && gsettings.watermark_text && m.media_type !== 'VIDEO' && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white/30 text-2xl sm:text-4xl font-bold -rotate-12 select-none">{gsettings.watermark_text}</span>
                </span>
              )}
              {gsettings.show_filename && m.guest_tag_name && (
                <span className="absolute top-2 left-2 text-[11px] text-white/70 bg-black/40 px-2 py-0.5 rounded">{m.guest_tag_name}</span>
              )}
            </div>
            <div className="px-4 pb-4 max-w-xl mx-auto w-full" onClick={(e) => e.stopPropagation()}>
              <PhotoSocial mediaId={m.id} comments={gsettings.allow_comments} social={gsettings.allow_social} />
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
    </div>
  )
}
