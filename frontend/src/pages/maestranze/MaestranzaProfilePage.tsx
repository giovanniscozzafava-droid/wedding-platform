import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Clock, ShieldAlert, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { type Maestranza, RAGGIO_LABEL, DISCLAIMER, signedPhoto } from '@/lib/maestranze'

export default function MaestranzaProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [m, setM] = useState<Maestranza | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.rpc('get_maestranza', { p_id: id })
        if (error) throw error
        const row = (data ?? [])[0] as Maestranza | undefined
        setM(row ?? null)
        if (row) setPhoto(await signedPhoto(row.photo_path))
      } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
    })()
  }, [id])

  if (loading) {
    return <div className="max-w-2xl mx-auto px-6 py-10 space-y-3">
      <div className="skeleton h-32 rounded-xl" /><div className="skeleton h-40 rounded-xl" />
    </div>
  }

  if (!m) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Card className="p-10 text-center">
          <p className="text-sm mb-4" style={{ color: 'rgb(var(--fg-muted))' }}>
            Questo profilo non è in bacheca.
          </p>
          <Button variant="outline" asChild><Link to="/maestranze"><ChevronLeft /> Torna alla bacheca</Link></Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
        <Link to="/maestranze"
          className="inline-flex items-center gap-1 text-sm mb-6"
          style={{ color: 'rgb(var(--fg-muted))' }}>
          <ChevronLeft className="size-4" /> Bacheca
        </Link>

        <Card className="p-6">
          <div className="flex gap-4">
            {photo
              ? <img src={photo} alt="" className="size-20 rounded-full object-cover shrink-0" />
              : <div className="size-20 rounded-full shrink-0" style={{ background: 'rgb(var(--bg-sunken))' }} />}
            <div className="min-w-0 pt-1">
              <h1 className="text-xl font-medium" style={{ color: 'rgb(var(--fg))' }}>{m.display_name}</h1>
              <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'rgb(var(--fg-muted))' }}>
                <MapPin className="size-3.5" />{m.provincia_nome} ({m.provincia}) · {m.regione}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--fg-muted))' }}>
                Si sposta: {RAGGIO_LABEL[m.raggio_disponibilita].toLowerCase()}
              </p>
            </div>
          </div>

          {/* Banner permanente: strato legale 1. Sta SOPRA il contenuto, non a piè pagina. */}
          <div className="flex gap-2.5 rounded-lg border p-3 mt-5"
            style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
            <ShieldAlert className="size-4 shrink-0 mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
              <strong style={{ color: 'rgb(var(--fg))' }}>Profilo autodichiarato, non verificato da Planfully.</strong>{' '}
              Esperienza, competenze e disponibilità sono dichiarate dalla persona. La regolarizzazione
              del rapporto di lavoro è responsabilità delle parti.
            </p>
          </div>

          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider mb-2"
              style={{ color: 'rgb(var(--fg-subtle))' }}>Cosa sa fare</div>
            <div className="flex flex-wrap gap-1.5">
              {m.skills.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs border"
                  style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg))' }}>{s}</span>
              ))}
            </div>
          </div>

          {m.anni_esperienza != null && (
            <div className="mt-5 flex items-center gap-2">
              <Briefcase className="size-4" style={{ color: 'rgb(var(--fg-subtle))' }} />
              <p className="text-sm" style={{ color: 'rgb(var(--fg))' }}>
                {m.anni_esperienza} {m.anni_esperienza === 1 ? 'anno' : 'anni'} di esperienza dichiarati
              </p>
            </div>
          )}

          {m.bio && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Si presenta così</div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'rgb(var(--fg))' }}>{m.bio}</p>
            </div>
          )}

          {m.disponibilita_note && (
            <div className="mt-5 flex items-start gap-2">
              <Clock className="size-4 mt-0.5 shrink-0" style={{ color: 'rgb(var(--fg-subtle))' }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Quando è disponibile</div>
                <p className="text-sm" style={{ color: 'rgb(var(--fg))' }}>{m.disponibilita_note}</p>
              </div>
            </div>
          )}

          {m.fascia_prezzo && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wider mb-0.5"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Fascia indicata dalla persona</div>
              <p className="text-sm" style={{ color: 'rgb(var(--fg))' }}>{m.fascia_prezzo}</p>
              <p className="text-[11px] mt-1" style={{ color: 'rgb(var(--fg-subtle))' }}>
                Indicativa e dichiarata: il compenso lo concordate voi, Planfully non c’entra.
              </p>
            </div>
          )}
        </Card>

        <p className="text-[11px] leading-relaxed mt-6 text-center" style={{ color: 'rgb(var(--fg-subtle))' }}>
          {DISCLAIMER}
        </p>
      </div>
    </div>
  )
}
