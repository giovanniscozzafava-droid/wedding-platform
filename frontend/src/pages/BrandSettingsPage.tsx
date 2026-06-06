import { type FormEvent, useState } from 'react'
import { Upload, Move } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { LogoCropper } from '@/components/brand/LogoCropper'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function BrandSettingsPage() {
  const { profile, user, refreshProfile } = useAuth()
  const [primary, setPrimary] = useState(profile?.brand_primary_color ?? '#1A2E4F')
  const [secondary, setSecondary] = useState(profile?.brand_secondary_color ?? '#D4AF37')
  const [busy, setBusy] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  async function saveColors(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').update({
        brand_primary_color: primary,
        brand_secondary_color: secondary,
      }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Brand aggiornato')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  // Selezione file → apre il cropper circolare (no upload diretto).
  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setCropSrc(URL.createObjectURL(f))
    e.target.value = ''
  }

  // Riceve il PNG già fittato nel cerchio dal cropper e lo carica.
  async function saveCroppedLogo(blob: Blob) {
    if (!user) return
    setBusy(true)
    try {
      const path = `${user.id}/logo-${Date.now()}.png`
      const up = await supabase.storage.from('brand-assets').upload(path, blob, { upsert: true, contentType: 'image/png' })
      if (up.error) throw up.error
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const { error } = await supabase.from('profiles').update({ brand_logo_url: data.publicUrl }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setCropSrc(null)
      toast.success('Logo aggiornato')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-full">
      {cropSrc && (
        <LogoCropper src={cropSrc} onCancel={() => setCropSrc(null)} onSave={saveCroppedLogo} />
      )}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Brand"
          title="Identità del tuo studio"
          description="Logo e colori finiscono sui PDF e nelle email dei tuoi preventivi. In beta è incluso per tutti."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Card className="p-6 space-y-3">
              <h3 className="font-display text-lg">Logo</h3>
              {profile?.brand_logo_url ? (
                <div className="flex items-center gap-4">
                  {/* Anteprima nel cerchio: come appare negli avatar dell'app */}
                  <img src={profile.brand_logo_url} alt="Logo" className="w-20 h-20 rounded-full object-cover border" style={{ borderColor: 'rgb(var(--border-strong))' }} />
                  <img src={profile.brand_logo_url} alt="Logo" className="h-20 w-auto object-contain bg-[rgb(var(--bg-sunken))] rounded-lg p-2" />
                </div>
              ) : (
                <div className="h-20 rounded-lg border border-dashed flex items-center justify-center text-[rgb(var(--fg-subtle))]" style={{ borderColor: 'rgb(var(--border-strong))' }}>
                  Nessun logo caricato
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border hover:bg-[rgb(var(--bg-sunken))]"
                  style={{ borderColor: 'rgb(var(--border-strong))' }}>
                  <Upload size={14} /> Carica logo
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={pickFile} data-testid="logo-upload" />
                </label>
                {profile?.brand_logo_url && (
                  <button type="button" onClick={() => setCropSrc(profile.brand_logo_url!)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border-strong))' }}>
                    <Move size={14} /> Riposiziona nel cerchio
                  </button>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-lg mb-3">Colori brand</h3>
              <form onSubmit={saveColors} className="space-y-4">
                <ColorPicker label="Primario" value={primary} onChange={setPrimary} />
                <ColorPicker label="Secondario" value={secondary} onChange={setSecondary} />
                <Button type="submit" variant="gold" disabled={busy}>Salva colori</Button>
              </form>
            </Card>

            <Card className="p-6 md:col-span-2">
              <h3 className="font-display text-lg mb-3">Anteprima PDF</h3>
              <div className="surface rounded-xl overflow-hidden max-w-md mx-auto">
                <div className="h-4" style={{ background: primary }} />
                <div className="p-6 space-y-2">
                  {profile?.brand_logo_url && <img src={profile.brand_logo_url} alt="" className="h-10 mb-2 object-contain" />}
                  <p className="font-display text-2xl" style={{ color: primary }}>{profile?.business_name ?? 'Il tuo studio'}</p>
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">Preventivo v1</p>
                  <hr style={{ borderColor: 'rgb(var(--border))' }} />
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>Voce esempio</span><span>€ 1.500</span></div>
                    <div className="flex justify-between"><span>Voce esempio</span><span>€ 2.400</span></div>
                  </div>
                  <hr style={{ borderColor: 'rgb(var(--border))' }} />
                  <p className="text-right font-display text-xl">TOTALE € 4.485</p>
                </div>
                <div className="h-4" style={{ background: secondary }} />
              </div>
            </Card>
          </div>
      </div>
    </div>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg cursor-pointer border" style={{ borderColor: 'rgb(var(--border-strong))' }} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  )
}
