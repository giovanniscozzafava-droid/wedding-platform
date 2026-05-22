import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function GenericOnboardingForm() {
  const { user, profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const [form, setForm] = useState({ full_name: '', phone: '' })

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' })
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null); setBusy(true)
    try {
      const { error: err } = await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone || null,
        onboarding_complete: true,
      }).eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-lg overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
              <Sparkles size={16} strokeWidth={2.5} />
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Benvenut*</span>
          </div>
          <h1 className="font-display text-3xl">Completa il tuo profilo</h1>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="full_name">Nome e cognome</Label>
            <Input id="full_name" required value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Telefono</Label>
            <Input id="phone" type="tel" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert">{error}</p>}
          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy ? 'Salvataggio...' : 'Salva e prosegui'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
