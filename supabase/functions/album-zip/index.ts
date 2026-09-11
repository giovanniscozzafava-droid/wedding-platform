// Scarica in ZIP le foto/video di una galleria: tutta la galleria, la selezione per l'album
// (album_choice='KEPT') o una singola cartella. Lo possono fare il fotografo (owner) E gli sposi:
// il server usa il token Drive dell'owner per scaricare i file Drive (gli sposi non hanno il token).
//
// PERCHÉ ERA ROTTO sulle gallerie grandi (Danila e Antonio, 1.304 foto): si scaricavano fino a 500
// file tenendoli TUTTI in memoria e poi JSZip ne faceva una seconda copia. In formato web pesano
// ~370 KB l'uno: 500 file = ~185 MB × 2, oltre il limite di memoria della edge, e il worker moriva
// senza risposta — la coppia vedeva solo «Download .zip non riuscito». In più il limite di 500 era
// senza ordinamento: ci si portava a casa 500 foto a caso su 1.304, senza saperlo.
//
// Ora: ordine deterministico, archivio scritto A FLUSSO (in memoria resta un pugno di file) e
// galleria divisa in PARTI numerate. Con `probe: true` si sa quante sono prima di cominciare.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from '../_shared/drive-crypto.ts'
import { ZipWriter } from '../_shared/zip-stream.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Zip-Part, X-Zip-Parts, X-Zip-Files, Content-Disposition',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:')

// Quanti file per parte: in formato web ci stanno larghi, gli originali (6–10 MB l'uno) molto meno.
// Il tetto in byte chiude la parte prima, se le foto sono pesanti.
// Misurato sulla galleria vera (Danila e Antonio): ~360 KB e ~0,5 s a foto con 6 richieste in
// volo. Con 150 foto per parte e 10 in volo una parte sta abbondantemente dentro il tempo massimo
// della edge, e 1.300 foto escono in 9 archivi.
const PER_PART = { web: 150, original: 30 }
const BUDGET = 220 * 1024 * 1024

type Media = {
  id: string
  drive_file_id: string
  thumbnail_link: string | null
  media_type: string | null
  guest_tag_name: string | null
  source_name: string | null
  edited_url: string | null
  folder_id: string | null
  created_at: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'auth_required' }, 401)

  const body = (await req.json().catch(() => ({}))) as
    { entry_id?: string; size?: string; scope?: string; folder_id?: string; part?: number; probe?: boolean }
  const entry_id = body.entry_id
  const size: 'web' | 'original' = body.size === 'web' ? 'web' : 'original'
  const scope: 'selection' | 'all' = body.scope === 'all' ? 'all' : 'selection'
  const folderId = body.folder_id
  const part = Math.max(1, Math.floor(Number(body.part) || 1))
  if (!entry_id) return json({ error: 'no_entry' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: gal } = await admin.from('event_galleries').select('owner_id').eq('entry_id', entry_id).maybeSingle()
  if (!gal) return json({ error: 'no_gallery' }, 404)

  // autorizzazione: owner della galleria, membro coppia, admin, o stamperia (FotoLab service)
  const isOwner = gal.owner_id === user.id
  const { data: cm } = await admin.from('wedding_couple_members').select('id').eq('entry_id', entry_id).eq('user_id', user.id).maybeSingle()
  const { data: prof } = await admin.from('profiles').select('role, is_album_lab').eq('id', user.id).maybeSingle()
  const isLab = !!prof?.is_album_lab || prof?.role === 'FOTOLAB'
  if (!isOwner && !cm && prof?.role !== 'ADMIN' && !isLab) return json({ error: 'forbidden' }, 403)

  // Una stamperia può scaricare gli originali SOLO se per quell'evento esiste un ordine album.
  if (isLab && !isOwner && !cm && prof?.role !== 'ADMIN') {
    const { data: ord } = await admin.from('album_orders').select('id').eq('entry_id', entry_id).limit(1).maybeSingle()
    if (!ord) return json({ error: 'no_order' }, 403)
  }

  // ORDINE DETERMINISTICO: senza, le parti si sovrappongono e qualche file non arriva mai.
  let mq = admin.from('gallery_media')
    .select('id, drive_file_id, thumbnail_link, media_type, guest_tag_name, source_name, edited_url, folder_id, created_at')
    .eq('entry_id', entry_id)
    .order('created_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
  if (scope === 'selection') mq = mq.eq('album_choice', 'KEPT')
  if (folderId) mq = mq.eq('folder_id', folderId)
  const { data: tutte } = await mq.limit(5000)
  let media = (tutte ?? []) as Media[]
  if (media.length === 0) return json({ error: scope === 'all' ? 'empty' : 'no_selection', detail: 'nessuna foto da scaricare' }, 400)

  // Enforcement per-cartella: l'owner scarica sempre tutto; sposi/ospiti solo dalle cartelle in cui
  // il fotografo ha abilitato QUEL formato. Se qualcosa resta fuori si dice quale e perché.
  const escluse: string[] = []
  if (!isOwner) {
    const { data: folders } = await admin.from('gallery_folders')
      .select('id, name, allow_dl_web, allow_dl_full').eq('entry_id', entry_id)
    const ok = new Set<string>()
    for (const f of (folders ?? []) as { id: string; name: string | null; allow_dl_web?: boolean; allow_dl_full?: boolean }[]) {
      const consentito = size === 'web' ? f.allow_dl_web !== false : f.allow_dl_full !== false
      if (consentito) ok.add(f.id)
      else escluse.push(f.name || 'una cartella')
    }
    media = media.filter((m) => !!m.folder_id && ok.has(m.folder_id))
    if (media.length === 0) {
      const dove = escluse.length ? ` (${escluse.join(', ')})` : ''
      return json({
        error: 'download_disabled',
        detail: size === 'original'
          ? `Il fotografo non ha abilitato il download a piena risoluzione${dove}. Il formato web resta disponibile.`
          : `Il fotografo non ha abilitato questo download${dove}.`,
      }, 403)
    }
  }

  // LE PARTI: quante ne servono per questa galleria e questo formato.
  const per = PER_PART[size]
  const parti = Math.max(1, Math.ceil(media.length / per))
  if (body.probe) {
    return json({ files: media.length, parts: parti, per, size, scope, excluded: escluse, total: (tutte ?? []).length })
  }
  if (part > parti) return json({ error: 'no_part', detail: `Questa galleria è divisa in ${parti} parti.` }, 400)
  const fetta = media.slice((part - 1) * per, part * per)

  // token Drive dell'owner (per i file su Drive)
  let token: string | null = null
  if (fetta.some((m) => isDrive(m.drive_file_id))) {
    const { data: conn } = await admin.from('drive_connections').select('refresh_token_enc').eq('professional_id', gal.owner_id).maybeSingle()
    if (conn?.refresh_token_enc) {
      try {
        const refresh = await decryptToken(Uint8Array.from(atob(conn.refresh_token_enc as string), (c) => c.charCodeAt(0)))
        const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
        const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
        token = (await tr.json()).access_token ?? null
      } catch { token = null }
    }
  }
  if (size === 'original' && !token && fetta.some((m) => isDrive(m.drive_file_id) && !m.edited_url)) {
    return json({ error: 'no_drive', detail: 'Il fotografo deve ricollegare Google Drive: senza, gli originali non sono scaricabili.' }, 502)
  }

  // In formato web il lato lungo scende se la galleria è enorme: meno byte da spostare.
  const webPx = media.length > 600 ? 1200 : 1600
  const prendi = async (m: Media): Promise<Uint8Array | null> => {
    try {
      const wantWeb = size === 'web' && m.media_type !== 'VIDEO'
      if (m.edited_url) {
        const r = await fetch(m.edited_url); if (!r.ok) return null
        return new Uint8Array(await r.arrayBuffer())
      }
      if (isDrive(m.drive_file_id)) {
        if (wantWeb) {
          const r = await fetch(`https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w${webPx}`)
          if (!r.ok) return null
          return new Uint8Array(await r.arrayBuffer())
        }
        if (!token) return null
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) return null
        return new Uint8Array(await r.arrayBuffer())
      }
      if (!m.thumbnail_link) return null
      const r = await fetch(m.thumbnail_link); if (!r.ok) return null
      return new Uint8Array(await r.arrayBuffer())
    } catch { return null }
  }
  // Drive ogni tanto rifiuta una richiesta su cinquanta: un secondo tentativo e il file c'è.
  const scarica = async (m: Media): Promise<Uint8Array | null> => {
    const a = await prendi(m)
    if (a) return a
    await new Promise((r) => setTimeout(r, 400))
    return prendi(m)
  }

  // A FLUSSO: si scaricano pochi file in anticipo (per non aspettare la rete uno alla volta) ma si
  // scrive in ordine, e ogni file esce subito. In memoria resta solo il pugno di file in volo.
  const AVANTI = 10
  const zip = new ZipWriter()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let byte = 0
        const coda: Promise<Uint8Array | null>[] = []
        for (let i = 0; i < Math.min(AVANTI, fetta.length); i++) coda.push(scarica(fetta[i]!))
        for (let i = 0; i < fetta.length; i++) {
          const bytes = await coda[i]!
          if (i + AVANTI < fetta.length) coda.push(scarica(fetta[i + AVANTI]!))
          if (!bytes) continue
          const m = fetta[i]!
          const ext = m.media_type === 'VIDEO' ? 'mp4' : 'jpg'
          const nome = (m.source_name || m.guest_tag_name || 'foto').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w\- ]+/g, '').trim() || 'foto'
          const n = (part - 1) * per + i + 1
          controller.enqueue(zip.file(`${String(n).padStart(4, '0')}-${nome}.${ext}`, bytes))
          byte += bytes.length
          if (byte > BUDGET) break         // parte già piena: si chiude qui
        }
        controller.enqueue(zip.end())
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  const stem = scope === 'all' ? 'galleria' : folderId ? 'cartella' : 'album-selezione'
  const suffisso = parti > 1 ? `-parte-${part}-di-${parti}` : ''
  const fname = `${stem}${size === 'web' ? '-web' : '-originali'}${suffisso}.zip`
  return new Response(stream, {
    headers: {
      ...cors,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'X-Zip-Part': String(part),
      'X-Zip-Parts': String(parti),
      'X-Zip-Files': String(fetta.length),
    },
  })
})
