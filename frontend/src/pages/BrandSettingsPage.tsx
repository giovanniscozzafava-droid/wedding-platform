import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function BrandSettingsPage() {
  const { profile, user, refreshProfile } = useAuth()
  const isPremium = profile?.subscription_tier === 'PREMIUM'
  const [primary, setPrimary] = useState(profile?.brand_primary_color ?? '#1A2E4F')
  const [secondary, setSecondary] = useState(profile?.brand_secondary_color ?? '#D4AF37')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function upgrade() {
    if (!user) return
    setBusy(true); setErr(null)
    try {
      const { error } = await supabase.from('profiles').update({ subscription_tier: 'PREMIUM' }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setMsg('Piano aggiornato a PREMIUM')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setBusy(false) }
  }

  async function saveColors(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      const { error } = await supabase.from('profiles').update({
        brand_primary_color: primary,
        brand_secondary_color: secondary,
      }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setMsg('Colori brand salvati')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setBusy(false) }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setErr(null)
    try {
      const path = `${user.id}/logo-${Date.now()}.${f.name.split('.').pop()}`
      const up = await supabase.storage.from('brand-assets').upload(path, f, { upsert: true })
      if (up.error) throw up.error
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const { error } = await supabase.from('profiles').update({ brand_logo_url: data.publicUrl }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setMsg('Logo caricato')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setBusy(false); e.target.value = '' }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link to="/" className="text-sm text-slate-500 hover:underline">← Home</Link>
          <h1 className="text-2xl font-semibold">Brand</h1>
          <p className="text-sm text-slate-500">Piano: <strong>{profile?.subscription_tier}</strong></p>
        </div>

        {!isPremium && (
          <Card>
            <CardHeader>
              <CardTitle>Passa a PREMIUM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">PREMIUM sblocca PDF brandizzati e preventivi illimitati.</p>
              <Button onClick={upgrade} disabled={busy} data-testid="upgrade-btn">{busy ? 'Aggiornamento...' : 'Diventa PREMIUM (demo)'}</Button>
              {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
              {msg && <p className="text-sm text-green-700">{msg}</p>}
            </CardContent>
          </Card>
        )}

        {isPremium && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile?.brand_logo_url && (
                  <img src={profile.brand_logo_url} alt="logo" className="h-16 w-auto object-contain" />
                )}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={uploadLogo} data-testid="logo-upload" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Colori</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveColors} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="p1">Primario</Label>
                    <Input id="p1" type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} />
                    <div className="h-8 rounded" style={{ background: primary }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2">Secondario</Label>
                    <Input id="p2" type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                    <div className="h-8 rounded" style={{ background: secondary }} />
                  </div>
                  <div className="col-span-2">
                    <Button type="submit" disabled={busy}>Salva colori</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
            {msg && <p className="text-sm text-green-700">{msg}</p>}
          </>
        )}
      </div>
    </div>
  )
}
