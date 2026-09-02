import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { Star } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Profilo → "Recensioni": i link Google e Matrimonio.com del professionista.
// Sono quelli che finiscono nel pulsante «Chiedi una recensione» a evento passato
// e nella scheda che il cliente vede nel suo evento. Senza link, niente pulsante.
type Links = { review_url_google: string; review_url_matrimonio: string }

const ok = (s: string) => s === '' || /^https:\/\/[^\s]+$/i.test(s)

export function ReviewLinksCard() {
  const { user, profile, refreshProfile } = useAuth()
  const p = profile as (Partial<Links> | null)
  const [v, setV] = useState<Links>({ review_url_google: '', review_url_matrimonio: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setV({ review_url_google: p?.review_url_google ?? '', review_url_matrimonio: p?.review_url_matrimonio ?? '' })
  }, [p?.review_url_google, p?.review_url_matrimonio])

  const dirty = v.review_url_google !== (p?.review_url_google ?? '') || v.review_url_matrimonio !== (p?.review_url_matrimonio ?? '')
  const valid = ok(v.review_url_google.trim()) && ok(v.review_url_matrimonio.trim())

  async function save() {
    if (!user || busy || !valid) return
    setBusy(true)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ review_url_google: v.review_url_google.trim() || null, review_url_matrimonio: v.review_url_matrimonio.trim() || null })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Link salvati')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-5" id="recensioni">
      <h3 className="font-display text-lg mb-1 flex items-center gap-2">
        <Star size={18} className="text-[rgb(var(--gold-600))]" /> Recensioni
      </h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        A evento passato compare il pulsante <strong>«Chiedi una recensione»</strong>: il cliente riceve questi link
        e li ritrova anche dentro il suo evento. Carica almeno uno dei due.
      </p>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="rev-google">Link recensioni Google</Label>
          <Input id="rev-google" type="url" placeholder="https://g.page/r/…/review" value={v.review_url_google}
            onChange={(e) => setV({ ...v, review_url_google: e.target.value })} />
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
            Dal Profilo dell’attività Google: «Chiedi recensioni» → copia il link (di solito inizia con g.page/r/).
          </p>
          {!ok(v.review_url_google.trim()) && <p className="text-xs text-[rgb(var(--danger))] mt-1">Deve iniziare con https://</p>}
        </div>
        <div>
          <Label htmlFor="rev-matr">Link profilo Matrimonio.com</Label>
          <Input id="rev-matr" type="url" placeholder="https://www.matrimonio.com/…" value={v.review_url_matrimonio}
            onChange={(e) => setV({ ...v, review_url_matrimonio: e.target.value })} />
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
            L’indirizzo della tua pagina su Matrimonio.com (o la pagina «Scrivi una recensione» del tuo profilo).
          </p>
          {!ok(v.review_url_matrimonio.trim()) && <p className="text-xs text-[rgb(var(--danger))] mt-1">Deve iniziare con https://</p>}
        </div>
        <div className="flex justify-end">
          <Button variant="gold" size="sm" disabled={busy || !dirty || !valid} onClick={() => void save()}>
            {busy ? 'Salvo…' : 'Salva link'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
export default ReviewLinksCard
