import { supabase } from './supabase'

// Upload su Supabase Storage con PROGRESSO REALE in byte: il client supabase-js usa
// fetch e non espone l'avanzamento, quindi facciamo la POST con XMLHttpRequest e
// leggiamo xhr.upload.onprogress. RLS invariata: usiamo il JWT dell'utente.
const URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export async function uploadWithProgress(
  bucket: string,
  path: string,
  body: Blob,
  opts: { contentType?: string; upsert?: boolean; cacheControl?: string; onProgress?: (pct: number) => void } = {},
): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ANON
  const endpoint = `${URL}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint, true)
    xhr.setRequestHeader('authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', ANON)
    if (opts.contentType) xhr.setRequestHeader('content-type', opts.contentType)
    xhr.setRequestHeader('x-upsert', opts.upsert ? 'true' : 'false')
    xhr.setRequestHeader('cache-control', `max-age=${opts.cacheControl ?? '3600'}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100))) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { opts.onProgress?.(100); resolve() }
      else reject(new Error(`Upload non riuscito (${xhr.status})${xhr.responseText ? ': ' + xhr.responseText.slice(0, 140) : ''}`))
    }
    xhr.onerror = () => reject(new Error('Errore di rete durante il caricamento'))
    xhr.send(body)
  })
}
