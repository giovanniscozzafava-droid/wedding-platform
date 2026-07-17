import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Pencil, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { RAGGIO_LABEL, signedPhoto } from '@/lib/maestranze'

type Row = {
  id: string; display_name: string; photo_path: string | null; provincia: string
  raggio_disponibilita: 'PROVINCIA' | 'REGIONE' | 'NAZIONALE'
  is_published: boolean; published_at: string | null
}

export default function MaestranzaMePage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [row, setRow] = useState<Row | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [skills, setSkills] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!session?.user?.id) return
    setLoading(true)
    try {
      const { data } = await supabase.from('maestranze_profiles')
        .select('id, display_name, photo_path, provincia, raggio_disponibilita, is_published, published_at')
        .eq('id', session.user.id).maybeSingle()
      if (!data) { nav('/maestranze/iscriviti'); return }
      setRow(data as Row)
      setPhoto(await signedPhoto(data.photo_path))
      const { data: ps } = await supabase.from('maestranze_profile_skills')
        .select('maestranze_skills(name)').eq('profile_id', session.user.id)
      setSkills((ps ?? []).map((r: { maestranze_skills: { name: string } | null }) => r.maestranze_skills?.name ?? '').filter(Boolean))
    } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session?.user?.id])

  /** Consenso revocabile con effetto immediato: il profilo esce dalla ricerca
   *  e la foto smette di essere leggibile (la policy storage guarda is_published). */
  async function toggle() {
    if (!row) return
    setSaving(true)
    try {
      const { error } = await supabase.from('maestranze_profiles')
        .update({ is_published: !row.is_published }).eq('id', row.id)
      if (error) throw error
      toast.success(row.is_published
        ? 'Profilo tolto dalla bacheca. Non ti vede più nessuno.'
        : 'Sei di nuovo in bacheca.')
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-10"><div className="skeleton h-48 rounded-xl" /></div>
  if (!row) return null

  return (
    <div className="min-h-full">
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader title="Il mio profilo"
          description="Sei tu a decidere quando farti vedere. Puoi uscire dalla bacheca in qualsiasi momento." />

        <Card className="p-6">
          <div className="flex items-center gap-4">
            {photo
              ? <img src={photo} alt="" className="size-16 rounded-full object-cover" />
              : <div className="size-16 rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }} />}
            <div className="min-w-0">
              <p className="font-medium" style={{ color: 'rgb(var(--fg))' }}>{row.display_name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--fg-muted))' }}>
                {row.provincia} · {RAGGIO_LABEL[row.raggio_disponibilita]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5 p-3 rounded-lg"
            style={{ background: 'rgb(var(--bg-sunken))' }}>
            {row.is_published
              ? <><Eye className="size-4" style={{ color: 'rgb(var(--gold-500))' }} />
                  <p className="text-sm" style={{ color: 'rgb(var(--fg))' }}>
                    Il tuo profilo è in bacheca: i professionisti della tua zona possono trovarti.
                  </p></>
              : <><EyeOff className="size-4" style={{ color: 'rgb(var(--fg-subtle))' }} />
                  <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>
                    Il tuo profilo non è visibile a nessuno.
                  </p></>}
          </div>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {skills.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs border"
                  style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>{s}</span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-6">
            <Button variant="outline" asChild>
              <Link to="/maestranze/iscriviti"><Pencil /> Modifica</Link>
            </Button>
            {row.is_published && (
              <Button variant="ghost" asChild>
                <Link to={`/maestranze/${row.id}`}><ExternalLink /> Come ti vedono</Link>
              </Button>
            )}
            <Button variant={row.is_published ? 'ghost' : 'gold'} disabled={saving} onClick={() => void toggle()}>
              {row.is_published ? <><EyeOff /> Togli dalla bacheca</> : <><Eye /> Rimettimi in bacheca</>}
            </Button>
          </div>
        </Card>

        <div className="flex gap-2.5 mt-6 px-1">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
            Planfully non prende commissioni su quello che guadagni, non ti mette in classifica e non decide
            chi ti vede prima: i risultati della bacheca escono in ordine casuale.
          </p>
        </div>
      </div>
    </div>
  )
}
