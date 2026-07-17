import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, MapPin, Shuffle, X, ChevronDown, UserPlus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  type Maestranza, type Skill, type Provincia, RAGGIO_LABEL, DISCLAIMER,
  signedPhotos, sessionSeed, loadSkills, loadProvince, groupByFamiglia,
} from '@/lib/maestranze'

const PAGE = 24

export default function MaestranzePage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Maestranza[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<Skill[]>([])
  const [province, setProvince] = useState<Provincia[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  const [provincia, setProvincia] = useState<string>('')
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [minEsp, setMinEsp] = useState<number | ''>('')
  const [skillQuery, setSkillQuery] = useState('')
  const [openFamiglia, setOpenFamiglia] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [sk, pr] = await Promise.all([loadSkills(), loadProvince()])
        setSkills(sk); setProvince(pr)
      } catch (e) { toast.error((e as Error).message) }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.rpc('search_maestranze', {
          p_provincia: provincia || undefined,
          p_skill_ids: skillIds.length ? skillIds : undefined,
          p_min_esperienza: minEsp === '' ? undefined : minEsp,
          p_seed: sessionSeed(),
          p_limit: PAGE,
          p_offset: page * PAGE,
        })
        if (error) throw error
        const list = (data ?? []) as Maestranza[]
        setRows(list)
        setTotal(list[0]?.total_count ? Number(list[0].total_count) : 0)
        setPhotos(await signedPhotos(list))
      } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
    })()
  }, [provincia, skillIds, minEsp, page])

  const famiglie = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    const filtered = q ? skills.filter((s) => s.name.toLowerCase().includes(q)) : skills
    return groupByFamiglia(filtered)
  }, [skills, skillQuery])

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])

  function toggleSkill(id: string) {
    setPage(0)
    setSkillIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Rete"
          title="Maestranze"
          description="Le persone che fanno funzionare gli eventi: camerieri, secondi fotografi, musicisti, truccatori, fonici. Cerca per zona e mestiere."
          actions={
            <Button variant="outline" asChild>
              <Link to="/maestranze/iscriviti"><UserPlus /> Iscriviti alla bacheca</Link>
            </Button>
          }
        />

        {/* Disclaimer strutturale: sta in pagina, non nei T&C. */}
        <div className="flex gap-2.5 rounded-lg border p-3 mb-6"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
          <Info className="size-4 shrink-0 mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>{DISCLAIMER}</p>
        </div>

        {/* ------------------------------------------------------------ filtri */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Zona</div>
              <select value={provincia} onChange={(e) => { setProvincia(e.target.value); setPage(0) }}
                className="w-full h-10 px-3 rounded-lg border text-sm bg-transparent"
                style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                <option value="">Tutta Italia</option>
                {province.map((p) => (
                  <option key={p.provincia} value={p.provincia}>{p.nome} ({p.provincia})</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Esperienza minima</div>
              <select value={minEsp} onChange={(e) => { setMinEsp(e.target.value === '' ? '' : Number(e.target.value)); setPage(0) }}
                className="w-full h-10 px-3 rounded-lg border text-sm bg-transparent"
                style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                <option value="">Indifferente</option>
                <option value="1">Almeno 1 anno</option>
                <option value="3">Almeno 3 anni</option>
                <option value="5">Almeno 5 anni</option>
                <option value="10">Almeno 10 anni</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Cerca un mestiere</div>
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgb(var(--fg-subtle))' }} />
                <Input value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="es. cameriere, organetto, fonico" className="pl-9" />
              </div>
            </div>
          </div>

          {/* mestieri selezionati */}
          {skillIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {skillIds.map((id) => (
                <button key={id} onClick={() => toggleSkill(id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
                  {skillById.get(id)?.name ?? '—'} <X className="size-3" />
                </button>
              ))}
              <button onClick={() => { setSkillIds([]); setPage(0) }}
                className="text-xs underline underline-offset-2 px-2"
                style={{ color: 'rgb(var(--fg-muted))' }}>Pulisci</button>
            </div>
          )}

          {/* vocabolario per famiglia */}
          <div className="mt-4 space-y-1">
            {famiglie.map(([fam, list]) => {
              const open = openFamiglia === fam || !!skillQuery
              const sel = list.filter((s) => skillIds.includes(s.id)).length
              return (
                <div key={fam} className="rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                  <button onClick={() => setOpenFamiglia(open && !skillQuery ? null : fam)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left">
                    <span className="text-sm" style={{ color: 'rgb(var(--fg))' }}>
                      {fam}
                      <span className="ml-2 text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>
                        {list.length}{sel > 0 && ` · ${sel} scelti`}
                      </span>
                    </span>
                    <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                      style={{ color: 'rgb(var(--fg-subtle))' }} />
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                      {list.map((s) => {
                        const active = skillIds.includes(s.id)
                        return (
                          <button key={s.id} onClick={() => toggleSkill(s.id)}
                            className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                            style={active
                              ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' }
                              : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* --------------------------------------------------------- risultati */}
        <div className="flex items-center gap-2 mb-3">
          <Shuffle className="size-3.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
          <p className="text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>
            {loading ? 'Cerco…' : `${total} ${total === 1 ? 'persona' : 'persone'}`} · Risultati in ordine casuale:
            Planfully non decide chi viene prima.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm mb-1" style={{ color: 'rgb(var(--fg))' }}>Nessuno in bacheca con questi filtri.</p>
            <p className="text-xs mb-4" style={{ color: 'rgb(var(--fg-muted))' }}>
              Prova ad allargare la zona, o invita tu le persone con cui lavori.
            </p>
            <Button variant="outline" asChild>
              <Link to="/maestranze/iscriviti"><UserPlus /> Link per iscriversi</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((m) => (
              <Link key={m.id} to={`/maestranze/${m.id}`}>
                <Card className="p-4 h-full hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    {photos[m.id]
                      ? <img src={photos[m.id]} alt="" className="size-14 rounded-full object-cover shrink-0" />
                      : <div className="size-14 rounded-full shrink-0" style={{ background: 'rgb(var(--bg-sunken))' }} />}
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'rgb(var(--fg))' }}>{m.display_name}</p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'rgb(var(--fg-muted))' }}>
                        <MapPin className="size-3" />{m.provincia_nome} · {RAGGIO_LABEL[m.raggio_disponibilita]}
                      </p>
                      {m.anni_esperienza != null && (
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }}>
                          {m.anni_esperienza} {m.anni_esperienza === 1 ? 'anno' : 'anni'} dichiarati
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.skills.slice(0, 4).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-full text-[11px] border"
                        style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>{s}</span>
                    ))}
                    {m.skills.length > 4 && (
                      <span className="px-2 py-0.5 text-[11px]" style={{ color: 'rgb(var(--fg-subtle))' }}>
                        +{m.skills.length - 4}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {total > PAGE && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" size="sm" disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}>Indietro</Button>
            <span className="text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>
              {page + 1} / {Math.max(1, Math.ceil(total / PAGE))}
            </span>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total}
              onClick={() => setPage((p) => p + 1)}>Avanti</Button>
          </div>
        )}

        {profile?.role === 'MAESTRANZA' && (
          <p className="text-center text-xs mt-8" style={{ color: 'rgb(var(--fg-subtle))' }}>
            <Link to="/maestranze/profilo" className="underline underline-offset-2">Gestisci il tuo profilo</Link>
          </p>
        )}
      </div>
    </div>
  )
}
