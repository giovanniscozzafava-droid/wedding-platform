import { useState, useEffect, useRef } from 'react'
import { Globe, ExternalLink, Eye, EyeOff, Plane, Sparkles, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useUpdateWedding } from '@/hooks/useWedding'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function WebsiteTab({ wedding }: { wedding: any }) {
  const update = useUpdateWedding(wedding.id)
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [slug, setSlug] = useState(wedding.wedding_website_slug ?? '')
  const [published, setPublished] = useState(wedding.wedding_website_published ?? false)
  const [isDest, setIsDest] = useState(wedding.is_destination ?? false)
  const [destLoc, setDestLoc] = useState(wedding.destination_location ?? '')
  const [destCountry, setDestCountry] = useState(wedding.destination_country ?? '')
  const [destLang, setDestLang] = useState(wedding.destination_language ?? '')
  const [data, setData] = useState<any>(wedding.wedding_website_data ?? {})
  const [honeyDest, setHoneyDest] = useState(wedding.honeymoon_destination ?? '')
  const [honeyStart, setHoneyStart] = useState(wedding.honeymoon_start ?? '')
  const [honeyEnd, setHoneyEnd] = useState(wedding.honeymoon_end ?? '')
  const [honeyNotes, setHoneyNotes] = useState(wedding.honeymoon_notes ?? '')

  useEffect(() => {
    setSlug(wedding.wedding_website_slug ?? '')
    setPublished(wedding.wedding_website_published ?? false)
    setIsDest(wedding.is_destination ?? false)
    setDestLoc(wedding.destination_location ?? '')
    setDestCountry(wedding.destination_country ?? '')
    setDestLang(wedding.destination_language ?? '')
    setData(wedding.wedding_website_data ?? {})
    setHoneyDest(wedding.honeymoon_destination ?? '')
    setHoneyStart(wedding.honeymoon_start ?? '')
    setHoneyEnd(wedding.honeymoon_end ?? '')
    setHoneyNotes(wedding.honeymoon_notes ?? '')
  }, [wedding])

  async function save() {
    try {
      await update.mutateAsync({
        wedding_website_slug: slug || null,
        wedding_website_published: published,
        wedding_website_data: data,
        is_destination: isDest,
        destination_location: destLoc || null,
        destination_country: destCountry || null,
        destination_language: destLang || null,
        honeymoon_destination: honeyDest || null,
        honeymoon_start: honeyStart || null,
        honeymoon_end: honeyEnd || null,
        honeymoon_notes: honeyNotes || null,
      } as any)
      toast.success('Sito evento salvato')
    } catch (e) { toast.error((e as Error).message) }
  }

  const publicUrl = slug && published ? `${window.location.origin}/w/${slug}` : null

  async function uploadCouplePhoto(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user.id}/couple-${wedding.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true, cacheControl: '3600' })
      if (error) throw error
      const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path)
      setData({ ...data, couple_photo_url: pub.publicUrl, couple_photo_focal_y: data.couple_photo_focal_y ?? 30 })
      toast.success('Foto caricata. Ricordati di salvare.')
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Sito evento</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Sito pubblico dedicato ai tuoi ospiti: data, programma, mappa, alloggi consigliati, trasporti, gift registry, RSVP web.</p>
        </div>
        <div className="flex items-center gap-2">
          {published
            ? <Badge tone="emerald"><Eye size={10} /> Pubblicato</Badge>
            : <Badge tone="neutral"><EyeOff size={10} /> Bozza</Badge>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-4">
          <h3 className="font-display text-lg">Configurazione</h3>
          <div className="space-y-1">
            <Label>Slug URL pubblico</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[rgb(var(--fg-muted))] whitespace-nowrap">{window.location.host}/w/</span>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="andrea-e-giulia" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                checked={isDest} onChange={(e) => setIsDest(e.target.checked)} />
              <Plane size={14} /> Destination wedding
            </label>
            {isDest && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <Input placeholder="Località (es. Costiera Amalfitana)" value={destLoc} onChange={(e) => setDestLoc(e.target.value)} />
                <Input placeholder="Paese" value={destCountry} onChange={(e) => setDestCountry(e.target.value)} />
                <Input placeholder="Lingua principale (it/en)" value={destLang} onChange={(e) => setDestLang(e.target.value)} />
              </div>
            )}
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <h4 className="font-medium mb-2 flex items-center gap-1"><ImagePlus size={14} /> Foto protagonisti (hero)</h4>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCouplePhoto(f); e.target.value = '' }} />
            {data.couple_photo_url ? (
              <div className="space-y-2">
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                  <img src={data.couple_photo_url} alt="Foto protagonisti"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `center ${data.couple_photo_focal_y ?? 30}%` }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Centratura verticale ({data.couple_photo_focal_y ?? 30}%) — sposta per centrare i visi</Label>
                  <input type="range" min={0} max={100} step={5}
                    value={data.couple_photo_focal_y ?? 30}
                    onChange={(e) => setData({ ...data, couple_photo_focal_y: Number(e.target.value) })}
                    className="w-full accent-[rgb(var(--gold-500))]" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Caricamento...' : 'Sostituisci foto'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setData({ ...data, couple_photo_url: null, couple_photo_focal_y: null })}>
                    <Trash2 size={14} /> Rimuovi
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus size={14} /> {uploading ? 'Caricamento...' : 'Carica foto protagonisti'}
              </Button>
            )}
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <h4 className="font-medium mb-2">Contenuti pubblici</h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Hashtag</Label>
                <Input value={data.hashtag ?? ''} onChange={(e) => setData({ ...data, hashtag: e.target.value })} placeholder="#nomecognome2026" />
              </div>
              <div className="space-y-1">
                <Label>La nostra storia</Label>
                <Textarea rows={3} value={data.story ?? ''} onChange={(e) => setData({ ...data, story: e.target.value })} placeholder="Come ci siamo conosciuti..." />
              </div>
              <div className="space-y-1">
                <Label>Dress code</Label>
                <Input value={data.dress_code ?? ''} onChange={(e) => setData({ ...data, dress_code: e.target.value })} placeholder="Formale · colori chiari · niente bianco" />
              </div>
              <div className="space-y-1">
                <Label>Lista nozze (URL gift registry)</Label>
                <Input value={data.gift_registry_url ?? ''} onChange={(e) => setData({ ...data, gift_registry_url: e.target.value })} placeholder="https://amazon.it/wedding-registry/..." />
              </div>
              <div className="space-y-1">
                <Label>Mappa cerimonia (URL Google Maps embed)</Label>
                <Input value={data.map_url ?? ''} onChange={(e) => setData({ ...data, map_url: e.target.value })} placeholder="https://maps.google.com/..." />
              </div>
              <div className="space-y-1">
                <Label>Info viaggio & visti</Label>
                <Textarea rows={3} value={data.travel_info ?? ''} onChange={(e) => setData({ ...data, travel_info: e.target.value })} placeholder="Aeroporto consigliato: Napoli Capodichino. Per cittadini extra-EU..." />
              </div>
              <div className="space-y-1">
                <Label>Cose da vedere/fare nella zona</Label>
                <Textarea rows={3} value={data.things_to_do ?? ''} onChange={(e) => setData({ ...data, things_to_do: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <h4 className="font-medium mb-2 flex items-center gap-1"><Sparkles size={14} /> Luna di miele</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Destinazione" value={honeyDest} onChange={(e) => setHoneyDest(e.target.value)} />
              <Input type="date" value={honeyStart} onChange={(e) => setHoneyStart(e.target.value)} />
              <Input type="date" value={honeyEnd} onChange={(e) => setHoneyEnd(e.target.value)} />
            </div>
            <Textarea rows={2} className="mt-2" value={honeyNotes} onChange={(e) => setHoneyNotes(e.target.value)} placeholder="Note interne (volo, hotel, link prenotazione...)" />
          </div>

          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Pubblica online
            </label>
            <Button variant="gold" onClick={save}>Salva sito</Button>
          </div>
        </Card>

        <Card className="p-6 space-y-3 self-start">
          <h3 className="font-display text-lg flex items-center gap-1"><Globe size={16} /> Link pubblico</h3>
          {publicUrl ? (
            <>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="block text-sm text-[rgb(var(--fg))] hover:underline break-all">
                {publicUrl} <ExternalLink size={12} className="inline" />
              </a>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(publicUrl)}>Copia URL</Button>
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              {!slug ? 'Imposta uno slug e pubblica per generare il link.' : 'Il sito è in bozza. Abilita "Pubblica online" e salva.'}
            </p>
          )}
          <div className="pt-3 border-t text-xs text-[rgb(var(--fg-subtle))]" style={{ borderColor: 'rgb(var(--border))' }}>
            <p className="font-medium text-[rgb(var(--fg-muted))] mb-1">Cosa vedranno gli ospiti:</p>
            <ul className="space-y-0.5">
              <li>• Hero con foto, data, hashtag</li>
              <li>• La vostra storia, dress code</li>
              <li>• Lista alloggi consigliati (da tab Alloggi)</li>
              <li>• Trasporti pubblicati (da tab Trasporti)</li>
              <li>• Sub-eventi (welcome dinner, brunch post)</li>
              <li>• Form RSVP web → arrivano in tab Invitati</li>
              <li>• Mappa, gift registry, travel info</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
