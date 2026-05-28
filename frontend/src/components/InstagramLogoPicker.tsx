import { useEffect, useRef, useState } from 'react'
import { Camera, Check, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

type Props = {
  /** Handle Instagram corrente (es. "@gisko.it" o "gisko.it"). */
  instagramHandle: string
  /** URL del logo attualmente impostato (preview state). */
  currentLogoUrl?: string | null
  /** Notifica il padre quando l'utente conferma un nuovo logo. */
  onLogoChosen: (logoUrl: string) => void
  className?: string
}

/**
 * Cerca la foto profilo Instagram dell'handle inserito e la propone come logo.
 * - Debounced fetch alla edge function instagram-avatar
 * - Preview circolare 64×64 con CTA "Usa come logo"
 * - Fallback UX trasparente se IG non risponde (anti-bot)
 */
export function InstagramLogoPicker({
  instagramHandle,
  currentLogoUrl,
  onLogoChosen,
  className,
}: Props) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('idle')
  const [foundUrl, setFoundUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const lastQuery = useRef<string>('')

  const handle = instagramHandle.trim().replace(/^@/, '')

  // Fetch debounced quando l'handle cambia
  useEffect(() => {
    if (!handle || handle.length < 2) {
      setStatus('idle')
      setFoundUrl(null)
      return
    }
    const t = setTimeout(() => void fetchAvatar(handle), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  async function fetchAvatar(h: string) {
    lastQuery.current = h
    setStatus('loading')
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; avatar_url?: string; error?: string }>(
        'instagram-avatar',
        { body: { handle: h } },
      )
      if (lastQuery.current !== h) return // race protection
      if (error) {
        setStatus('error')
        setErrorMsg('Servizio non raggiungibile')
        return
      }
      if (data?.ok && data.avatar_url) {
        setFoundUrl(data.avatar_url)
        setStatus('found')
      } else {
        setStatus('not_found')
        setErrorMsg(data?.error === 'invalid_handle' ? 'Handle non valido' : 'Instagram non risponde')
      }
    } catch (e) {
      if (lastQuery.current !== h) return
      setStatus('error')
      setErrorMsg((e as Error).message)
    }
  }

  async function useAsLogo() {
    if (!foundUrl || !user) return
    try {
      // Re-host della foto profilo IG su Storage, così non scade né dipende da fbcdn.
      const res = await fetch(foundUrl)
      if (!res.ok) throw new Error('Download IG fallito')
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : 'jpg'
      const path = `${user.id}/${Date.now()}-ig-logo.${ext}`
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, blob, { cacheControl: '604800', upsert: true, contentType: blob.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path)
      onLogoChosen(pub.publicUrl)
    } catch {
      // Se Storage RLS o policy bloccano, ripiega all'URL diretto (con risk di scadenza).
      onLogoChosen(foundUrl)
    }
  }

  if (!handle) return null

  return (
    <div className={cn('mt-2 flex items-center gap-3 rounded-lg border p-3', className)}
         style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
      <div className="shrink-0 h-14 w-14 rounded-full overflow-hidden bg-[rgb(var(--bg-sunken))] flex items-center justify-center">
        {status === 'found' && foundUrl ? (
          <img src={foundUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : currentLogoUrl ? (
          <img src={currentLogoUrl} alt="" className="h-full w-full object-cover" />
        ) : status === 'loading' ? (
          <RefreshCw size={16} className="animate-spin text-[rgb(var(--fg-subtle))]" />
        ) : (
          <Camera size={18} className="text-[rgb(var(--fg-subtle))]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Foto profilo Instagram</p>
        {status === 'loading' && (
          <p className="text-sm text-[rgb(var(--fg))]">Cerco @{handle}…</p>
        )}
        {status === 'found' && (
          <p className="text-sm text-[rgb(var(--fg))]">Trovata. Usala come logo del tuo profilo?</p>
        )}
        {status === 'not_found' && (
          <p className="text-xs text-[rgb(var(--fg-muted))]">{errorMsg}. Puoi caricare il logo manualmente.</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-[rgb(var(--fg-muted))] flex items-center gap-1">
            <AlertCircle size={12} /> {errorMsg}
          </p>
        )}
      </div>
      {status === 'found' && (
        <Button variant="gold" size="sm" type="button" onClick={() => void useAsLogo()}>
          <Check size={14} /> Usa come logo
        </Button>
      )}
    </div>
  )
}
