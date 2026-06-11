import { supabase } from '@/lib/supabase'

// Upload diretto browser→Google Drive. I file NON passano da Planfully: vanno dal
// computer del fotografo a Drive. Planfully dà solo un access_token a breve durata
// (via edge drive-token) e salva i riferimenti (id + miniatura pubblica).

export async function getDriveToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('drive-token', { body: {} })
  if (error) throw error
  const r = data as { access_token?: string; error?: string }
  if (r?.error || !r?.access_token) {
    throw new Error(r?.error === 'not_connected' ? 'Collega prima Google Drive dal tuo profilo.' : (r?.error ?? 'Token Drive non disponibile'))
  }
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
