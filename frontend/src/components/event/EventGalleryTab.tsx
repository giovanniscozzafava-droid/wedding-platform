import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Images, FolderPlus, Plus, Check, Lock, Globe, Users, ShieldCheck, Trash2, Sparkles, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'
import { getDriveToken, ensureDriveFolder, uploadFileToDrive } from '@/lib/driveUpload'

// Tab "Foto" dell'evento. Stessa superficie per tutti, ma cosa vedi/fai dipende
// dal ruolo (la spina RLS gata il contenuto): il fotografo (owner) gestisce e
// carica; gli sposi vedono tutto + danno il consenso; i fornitori vedono solo
// ciò che li riguarda. I file veri stanno sul Drive del fotografo; qui le anteprime.

type Media = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; guest_tag_name: string | null; price_cents: number | null }
type Folder = { id: string; name: string; level: string; shared: boolean; assigned_subrole: string | null; assigned_to: string | null; sort_order: number; drive_folder_id: string | null; gallery_media: Media[] }
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
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploadFolder, setUploadFolder] = useState<Folder | null>(null)
  // nuova cartella
  const [nf, setNf] = useState<{ open: boolean; name: string; level: string; subrole: string }>({ open: false, name: '', level: 'LAVORO_INTERO', subrole: '' })

  const isOwner = !!gallery && gallery.owner_id === me

  const load = useCallback(async () => {
    setLoading(true)
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    setMe(uid)
    const { data: gal } = await (supabase.from as any)('event_galleries').select('id, owner_id, title').eq('entry_id', entryId).maybeSingle()
    setGallery((gal as Gallery) ?? null)
    const { data: f } = await (supabase.from as any)('gallery_folders')
      .select('id, name, level, shared, assigned_subrole, assigned_to, sort_order, drive_folder_id, gallery_media(id, thumbnail_link, drive_file_id, media_type, guest_tag_name, price_cents)')
      .eq('entry_id', entryId).order('sort_order')
    setFolders((f as Folder[]) ?? [])
    const { data: c } = await (supabase.from as any)('gallery_consents').select('granted_at, revoked_at').eq('entry_id', entryId).eq('scope', 'LAVORO_INTERO').maybeSingle()
    setConsentOn(!!c && c.granted_at && !c.revoked_at)
    setLoading(false)
  }, [entryId])

  useEffect(() => { void load() }, [load])

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
  async function uploadPhotos(f: Folder, files: FileList) {
    if (!gallery || files.length === 0) return
    setBusy(true)
    try {
      const token = await getDriveToken()
      const driveFolder = await ensureDriveFolder(token, `Planfully · ${f.name}`, f.drive_folder_id)
      if (driveFolder !== f.drive_folder_id) await (supabase.from as any)('gallery_folders').update({ drive_folder_id: driveFolder }).eq('id', f.id)
      const rows: Record<string, unknown>[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
        const { id, thumbnail } = await uploadFileToDrive(token, driveFolder, file)
        rows.push({ folder_id: f.id, gallery_id: gallery.id, entry_id: entryId, drive_file_id: id, thumbnail_link: thumbnail, media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO' })
      }
      if (rows.length) { const { error } = await (supabase.from as any)('gallery_media').insert(rows); if (error) throw error }
      toast.success(`${rows.length} file caricati sul tuo Drive`)
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false); setUploadFolder(null) }
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
        {role === 'fornitore' && <Button variant="gold" disabled={busy} onClick={createGallery}><Plus size={14} /> Crea la mia galleria</Button>}
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* input file nascosto per l'upload su Drive */}
      <input ref={uploadRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={(e) => { const fs = e.target.files; if (fs && uploadFolder) void uploadPhotos(uploadFolder, fs); e.target.value = '' }} />

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

      {/* Plancia owner: nuova cartella */}
      {isOwner && (
        <Card className="p-4">
          {!nf.open ? (
            <Button variant="outline" size="sm" onClick={() => setNf((s) => ({ ...s, open: true }))}><FolderPlus size={14} /> Nuova cartella</Button>
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
        return (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                {lvl && <lvl.icon size={16} className="text-[rgb(var(--gold-700))]" />}
                <h3 className="font-medium">{f.name}</h3>
                <Badge className="bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))] text-[10px]">{lvl?.l ?? f.level}</Badge>
                {f.level === 'LAVORO_INTERO' && (f.shared
                  ? <Badge className="bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))] text-[10px]"><Check size={10} /> condivisa</Badge>
                  : <Badge className="bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))] text-[10px]">non condivisa</Badge>)}
              </div>
              {isOwner && (
                <div className="flex items-center gap-1.5">
                  {f.level === 'LAVORO_INTERO' && <Button variant="outline" size="sm" disabled={busy} onClick={() => toggleShared(f)}>{f.shared ? 'Non condividere' : 'Condividi al cerchio'}</Button>}
                  <Button variant="gold" size="sm" disabled={busy} onClick={() => { setUploadFolder(f); uploadRef.current?.click() }}><Upload size={12} /> Carica foto</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => addDemoPhotos(f)}><Sparkles size={12} /> Foto demo</Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteFolder(f)}><Trash2 size={13} /></Button>
                </div>
              )}
            </div>
            {f.gallery_media.length === 0 ? (
              <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna foto. {isOwner && 'Usa “Carica foto” (vanno sul tuo Drive) o “Foto demo”.'}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {f.gallery_media.map((m) => (
                  <div key={m.id} className="relative rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))]" style={{ aspectRatio: '4/3' }}>
                    {m.thumbnail_link && <img src={m.thumbnail_link} alt={m.guest_tag_name ?? ''} className="w-full h-full object-cover" loading="lazy" />}
                    {m.guest_tag_name && <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1 py-0.5 truncate">{m.guest_tag_name}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
