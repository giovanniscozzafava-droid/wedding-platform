// URL immagine utilizzabile da WebGL e dal canvas (CORS): le foto di Google Drive (thumbnail e
// googleusercontent) non mandano le intestazioni CORS, quindi passano dal proxy img-proxy
// (edge function pubblica, solo host consentiti). Le data URL e le immagini dello stesso
// origine passano dirette. Per Drive si può chiedere una misura maggiore (sz=wNNNN).
const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/img-proxy?url=`

export function corsImageUrl(url: string | null | undefined, size?: number): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url
  let u = url
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin === window.location.origin) return url
    if (parsed.hostname === 'drive.google.com' && parsed.pathname === '/thumbnail' && size) {
      parsed.searchParams.set('sz', `w${size}`); u = parsed.toString()
    }
    // lo storage Supabase ha già CORS: diretto; così le foto d'archivio (Pexels/Unsplash, gallerie demo),
    // che il proxy non ammette e che mandano già le intestazioni CORS
    if (parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.supabase.in')) return u
    if (/(^|\.)pexels\.com$|(^|\.)unsplash\.com$/.test(parsed.hostname)) return u
  } catch { return url }
  return PROXY + encodeURIComponent(u)
}
