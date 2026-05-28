import { useEffect, useRef, useState } from 'react'
import { Camera, Check, RefreshCw, AlertCircle, Link as LinkIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

type Props = {
  /** Handle Instagram corrente (es. "@gisko.it"). Opzionale, usato per pre-fill. */
  instagramHandle?: string
  /** URL del sito web (opzionale, usato per pre-fill). */
  websiteUrl?: string
  /** URL del logo attualmente impostato. */
  currentLogoUrl?: string | null
  /** Notifica il padre quando l'utente conferma un nuovo logo. */
  onLogoChosen: (logoUrl: string) => void
  className?: string
}

/**
 * Picker che recupera automaticamente un logo da un URL pubblico.
 *
 * Strategia:
 *  1. L'utente incolla l'URL del proprio sito web (oppure pre-compilato).
 *  2. Edge function `link-preview` estrae l'og:image (= di solito il logo / foto principale).
 *  3. Per gli URL Instagram, prova anche `instagram-avatar` come fallback dedicato.
 *  4. Preview circolare, bottone "Usa come logo" che ri-hosta su Storage.
 */
export function InstagramLogoPicker({
  instagramHandle = '',
  websiteUrl = '',
  currentLogoUrl,
  onLogoChosen,
  className,
}: Props) {
  const { user } = useAuth()
  const [url, setUrl] = useState<string>(websiteUrl || (instagramHandle ? toIgUrl(instagramHandle) : ''))
  const [status, setStatus] = useState<Status>('idle')
  const [foundUrl, setFoundUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lastQuery = useRef<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Se il padre passa websiteUrl/instagramHandle dopo, sincronizza
  useEffect(() => {
    if (websiteUrl) setUrl(websiteUrl)
    else if (instagramHandle) setUrl(toIgUrl(instagramHandle))
  }, [websiteUrl, instagramHandle])

  async function fetchPreview(rawUrl: string) {
    const trimmed = rawUrl.trim()
    if (!trimmed) { setStatus('idle'); setFoundUrl(null); return }
    const target = normalizeUrl(trimmed)
    if (!target) { setStatus('error'); setErrorMsg('URL non valido'); return }
    lastQuery.current = target
    setStatus('loading')
    setErrorMsg(null)
    try {
      // 1) Instagram-specific (se l'URL è instagram.com)
      if (/instagram\.com/i.test(target)) {
        try {
          const { data, error } = await supabase.functions.invoke<{ ok: boolean; avatar_url?: string }>(
            'instagram-avatar',
            { body: { url: target } },
          )
          if (lastQuery.current !== target) return
          if (!error && data?.ok && data.avatar_url) {
            setFoundUrl(data.avatar_url)
            setStatus('found')
            return
          }
        } catch { /* fallthrough */ }
      }
      // 2) Open Graph generico (sito web — funziona quasi sempre)
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; image?: string; title?: string }>(
        'link-preview',
        { body: { url: target } },
      )
      if (lastQuery.current !== target) return
      if (error) {
        setStatus('error')
        setErrorMsg('Servizio non raggiungibile')
        return
      }
      if (data?.ok && data.image) {
        setFoundUrl(data.image)
        setStatus('found')
      } else {
        setStatus('not_found')
        setErrorMsg(
          /instagram\.com/i.test(target)
            ? 'Instagram blocca lo scraping. Prova con l\'URL del tuo sito web.'
            : 'Nessuna immagine principale trovata su questa pagina.',
        )
      }
    } catch (e) {
      if (lastQuery.current !== target) return
      setStatus('error')
      setErrorMsg((e as Error).message)
    }
  }

  async function useAsLogo() {
    if (!foundUrl || !user) return
    setSaving(true)
    try {
      const res = await fetch(foundUrl)
      if (!res.ok) throw new Error('Download fallito')
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/${Date.now()}-auto-logo.${ext}`
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, blob, { cacheControl: '604800', upsert: true, contentType: blob.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path)
      onLogoChosen(pub.publicUrl)
    } catch {
      onLogoChosen(foundUrl) // fallback: URL diretto, no re-host
    } finally {
      setSaving(false)
    }
  }

  async function uploadManual(file: File) {
    if (!user) return
    setSaving(true)
    try {
      if (!file.type.startsWith('image/')) throw new Error('Seleziona un\'immagine')
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user.id}/${Date.now()}-manual-logo.${ext}`
      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, file, { cacheControl: '604800', upsert: true, contentType: file.type })
      if (error) throw error
      const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path)
      onLogoChosen(pub.publicUrl)
      setStatus('idle')
      setFoundUrl(null)
    } catch (e) {
      setErrorMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('mt-2 space-y-3 rounded-lg border p-3', className)}
         style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
      <div>
        <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-1">Logo automatico</p>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
          Incolla l'URL del tuo sito web o profilo social: prenderemo l'immagine principale come logo.
        </p>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gisko.net  o  @gisko.it"
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" disabled={status === 'loading' || !url.trim()} onClick={() => void fetchPreview(url)}>
          {status === 'loading' ? <RefreshCw size={14} className="animate-spin" /> : 'Cerca'}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="shrink-0 h-16 w-16 rounded-lg overflow-hidden bg-[rgb(var(--bg-sunken))] flex items-center justify-center border" style={{ borderColor: 'rgb(var(--border))' }}>
          {status === 'found' && foundUrl ? (
            <img src={foundUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : currentLogoUrl ? (
            <img src={currentLogoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={18} className="text-[rgb(var(--fg-subtle))]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {status === 'idle' && !currentLogoUrl && (
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Esempio: <code className="text-[11px]">https://miosito.it</code>. Funziona col tuo sito o con un post pubblico.
            </p>
          )}
          {status === 'loading' && (
            <p className="text-sm text-[rgb(var(--fg))]">Analisi in corso…</p>
          )}
          {status === 'found' && (
            <p className="text-sm text-[rgb(var(--fg))]">Immagine trovata. Usala come logo?</p>
          )}
          {(status === 'not_found' || status === 'error') && errorMsg && (
            <p className="text-xs text-[rgb(var(--fg-muted))] flex items-center gap-1">
              <AlertCircle size={12} /> {errorMsg}
            </p>
          )}
        </div>
        {status === 'found' && (
          <Button variant="gold" size="sm" type="button" disabled={saving} onClick={() => void useAsLogo()}>
            <Check size={14} /> {saving ? 'Salvataggio…' : 'Usa come logo'}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[rgb(var(--fg-subtle))] pt-1 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <span>Nessun risultato?</span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadManual(f); if (fileRef.current) fileRef.current.value = '' }} />
        <button type="button" disabled={saving} onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 underline hover:text-[rgb(var(--fg-muted))]">
          <Upload size={11} /> {saving ? 'Caricamento…' : 'Carica manualmente'}
        </button>
      </div>
    </div>
  )
}

function toIgUrl(handle: string): string {
  const h = handle.trim().replace(/^@/, '')
  if (!h) return ''
  return `https://www.instagram.com/${h}/`
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // @handle → instagram
  if (/^@[A-Za-z0-9._]+$/.test(trimmed)) return `https://www.instagram.com/${trimmed.slice(1)}/`
  // Senza http(s) → aggiungi https
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try { new URL(withProto); return withProto } catch { return null }
}
