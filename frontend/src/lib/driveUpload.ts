import { supabase } from '@/lib/supabase'

// Upload diretto browser→Google Drive. I file NON passano da Planfully: vanno dal
// computer del fotografo a Drive. Planfully dà solo un access_token a breve durata
// (via edge drive-token) e salva i riferimenti (id + miniatura pubblica).

function driveErrMsg(reason?: string): string {
  switch (reason) {
    case 'not_connected': return 'Per caricare le tue foto collega prima Google Drive dal tuo profilo.'
    case 'auth_required': return 'Sessione scaduta: esci e rientra, poi riprova.'
    case 'refresh_failed': return 'Google Drive si è scollegato: ricollegalo dal profilo (Scollega → Ricollega).'
    default: return reason || 'Google Drive non disponibile: collegalo dal tuo profilo.'
  }
}

export async function getDriveToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('drive-token', { body: {} })
  if (error) {
    // l'errore generico "non-2xx" nasconde il motivo: leggo il corpo della risposta
    let reason = ''
    try { const b = await (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); reason = b?.error ?? '' } catch { /* ignore */ }
    throw Object.assign(new Error(driveErrMsg(reason)), { driveReason: reason || 'unknown' })
  }
  const r = data as { access_token?: string; error?: string }
  if (r?.error || !r?.access_token) throw Object.assign(new Error(driveErrMsg(r?.error)), { driveReason: r?.error || 'unknown' })
  return r.access_token
}

// Crea (o riusa) una cartella su Drive condivisa "chiunque con il link" → le
// miniature sono pubbliche e visibili anche a sposi/fornitori (modo leggero beta).
export async function ensureDriveFolder(token: string, name: string, existingId: string | null): Promise<string> {
  if (existingId) return existingId
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!res.ok) throw new Error('Creazione cartella Drive fallita: ' + (await res.text()).slice(0, 140))
  const { id } = await res.json()
  await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  return id
}

// Elenca i file già presenti in una cartella Drive (paginato). Serve a riconoscere i file
// GIÀ caricati ed evitare doppioni: Drive conserva il nome originale di ogni file caricato.
export type DriveFile = { id: string; name: string; size: string | null; mimeType: string }
export async function listDriveFolderFiles(token: string, folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, size, mimeType)',
      pageSize: '1000', orderBy: 'name',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Lettura cartella Drive fallita: ' + (await res.text()).slice(0, 140))
    const j = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string }
    out.push(...(j.files ?? []))
    pageToken = j.nextPageToken
  } while (pageToken)
  return out
}

export async function uploadFileToDrive(token: string, folderId: string, file: File): Promise<{ id: string; thumbnail: string }> {
  const metadata = { name: file.name, parents: [folderId] }
  const body = new FormData()
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  body.append('file', file)
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
  })
  if (!res.ok) throw new Error('Upload Drive fallito: ' + (await res.text()).slice(0, 140))
  const { id } = await res.json()
  return { id, thumbnail: `https://drive.google.com/thumbnail?id=${id}&sz=w800` }
}

// Chiave di ripresa per un file: stessa firma (cartella+nome+dimensione+data) → stessa sessione.
const resumeKey = (folderId: string, file: File) => `drvup:${folderId}:${file.name}:${file.size}:${file.lastModified}`
const finished = (id: string): { id: string; thumbnail: string } => ({ id, thumbnail: `https://drive.google.com/thumbnail?id=${id}&sz=w800` })

// Upload RESUMABLE a chunk: per file GRANDI. Sopravvive alle INTERRUZIONI (chiusura tab, reload,
// rete giù): la sessione Drive viene salvata in localStorage e al tentativo successivo l'upload
// RIPRENDE dall'ultimo byte già caricato, invece di ripartire da zero.
export async function uploadFileToDriveResumable(token: string, folderId: string, file: File, onProgress?: (frac: number) => void): Promise<{ id: string; thumbnail: string }> {
  const key = resumeKey(folderId, file)
  let session = (() => { try { return localStorage.getItem(key) } catch { return null } })()
  let offset = 0

  // C'è una sessione salvata? Chiedo a Drive quanti byte ha già ricevuto e riprendo da lì.
  if (session) {
    try {
      const probe = await fetch(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` } })
      if (probe.status === 308) {
        const range = probe.headers.get('range') // es. "bytes=0-1048575" → ricevuti fino a 1048575
        offset = range && range.includes('-') ? parseInt(range.split('-')[1] || '-1', 10) + 1 : 0
      } else if (probe.ok) {
        const j = await probe.json().catch(() => ({})); const id = (j as { id?: string }).id
        try { localStorage.removeItem(key) } catch { /* ignore */ }
        if (id) { onProgress?.(1); return finished(id) }
        session = null
      } else { session = null } // sessione scaduta/persa → reinizializzo
    } catch { session = null }
  }

  // Nessuna sessione valida → ne apro una nuova e la salvo (per poter riprendere)
  if (!session) {
    offset = 0
    const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, 'content-type': 'application/json',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [folderId] }),
    })
    if (!init.ok) throw new Error('Init upload Drive fallito: ' + (await init.text()).slice(0, 140))
    session = init.headers.get('location')
    if (!session) throw new Error('Sessione upload Drive mancante (CORS Location)')
    try { localStorage.setItem(key, session) } catch { /* quota piena: pazienza, niente ripresa */ }
  }

  const CHUNK = 16 * 1024 * 1024 // 16MB, multiplo di 256KB
  let id = ''
  if (offset > 0) onProgress?.(offset / file.size) // mostra subito la progressione ripresa
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size)
    const chunk = file.slice(offset, end)
    let attempt = 0
    for (;;) {
      attempt++
      try {
        const res = await fetch(session, { method: 'PUT', headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${file.size}` }, body: chunk })
        if (res.status === 308) { offset = end; onProgress?.(offset / file.size); break }
        if (res.ok) { const j = await res.json().catch(() => ({})); id = (j as { id?: string }).id ?? ''; offset = end; onProgress?.(1); break }
        if (res.status === 404 || res.status === 410) { try { localStorage.removeItem(key) } catch { /* */ } throw new Error('Sessione Drive scaduta: riavvia l\'upload') }
        if (attempt >= 4) throw new Error('chunk ' + res.status)
      } catch (e) {
        const msg = (e as Error).message
        if (msg.startsWith('Sessione Drive scaduta')) throw e
        // Esauriti i retry del chunk: NON cancello la sessione → al prossimo tentativo riprende da qui.
        if (attempt >= 4) throw new Error('Upload interrotto — riprenderà da dove si è fermato al prossimo tentativo (' + msg + ')')
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  try { localStorage.removeItem(key) } catch { /* ignore */ }
  if (!id) throw new Error('Upload completato ma id mancante')
  return finished(id)
}

// Sceglie il metodo: file piccoli (<8MB) multipart (1 richiesta, veloce); grandi → resumable.
export async function uploadAnyToDrive(token: string, folderId: string, file: File, onProgress?: (frac: number) => void): Promise<{ id: string; thumbnail: string }> {
  if (file.size <= 8 * 1024 * 1024) { onProgress?.(0); const r = await uploadFileToDrive(token, folderId, file); onProgress?.(1); return r }
  return uploadFileToDriveResumable(token, folderId, file, onProgress)
}
