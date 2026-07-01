import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Trash2, Pencil, Calculator, Save, X as XIcon, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// Pacchetti "tutto incluso" (percorsi) multipli + calcolatrice prezzo buffet.
// Ruoli voce: INCLUSO (nel prezzo base) · OPZIONALE (integrazione a scelta +€) · OBBLIGATORIO (integrazione sempre +€).
type Role = 'INCLUSO' | 'OPZIONALE' | 'OBBLIGATORIO'
type PkgVoce = { menu_item_id: string; piatto: string; portata: string; role: Role; surcharge: number }
type Pkg = { id: string; nome: string; prezzo: number; note: string | null; voci: PkgVoce[] }
type Dish = { menu_item_id: string; piatto: string; portata: string }

const COURSE_LBL: Record<string, string> = { APERITIVO: 'Aperitivo', ANTIPASTO: 'Antipasti', PRIMO: 'Primi', SECONDO: 'Secondi', CONTORNO: 'Contorni', DOLCE: 'Dolci', FRUTTA: 'Frutta', BEVANDE: 'Bevande' }
const COURSE_ORD = ['APERITIVO', 'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'FRUTTA', 'BEVANDE']
const eur = (n: number) => `€ ${(Number(n) || 0).toFixed(2)}`

export function PackagesPanel({ entryId, dishes, coperti, readOnly }: { entryId: string; dishes: Dish[]; coperti: number; readOnly?: boolean }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([])
  const [reload, setReload] = useState(0)
  const [assignForId, setAssignForId] = useState<string | null>(null)
  const [editPkg, setEditPkg] = useState<{ id: string | null; nome: string; prezzo: string; note: string } | null>(null)
  const [calcId, setCalcId] = useState<string>('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [optOn, setOptOn] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await (supabase as any).rpc('fb_event_packages', { p_entry: entryId })
      if (alive) setPkgs(data && data.ok ? (data.pacchetti as Pkg[]) : [])
    })()
    return () => { alive = false }
  }, [entryId, reload])
  useEffect(() => { if ((!calcId || !pkgs.some((p) => p.id === calcId)) && pkgs.length) setCalcId(pkgs[0]!.id) }, [pkgs, calcId])

  async function savePkg() {
    if (!editPkg) return
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('fb_package_save', { p_id: editPkg.id, p_name: editPkg.nome, p_price: Number(editPkg.prezzo) || 0, p_notes: editPkg.note || null })
      if (error || data?.error) throw new Error()
      toast.success('Pacchetto salvato'); setEditPkg(null); setReload((x) => x + 1)
    } catch { toast.error('Salvataggio non riuscito') } finally { setBusy(false) }
  }
  async function delPkg(id: string) {
    if (!confirm('Eliminare questo pacchetto?')) return
    await (supabase as any).rpc('fb_package_delete', { p_id: id }); setReload((x) => x + 1)
  }
  async function setItem(pkgId: string, mi: string, role: Role | null, surcharge = 0) {
    await (supabase as any).rpc('fb_package_set_item', { p_package_id: pkgId, p_menu_item_id: mi, p_role: role, p_surcharge: surcharge })
    setReload((x) => x + 1)
  }

  const assignPkg = pkgs.find((p) => p.id === assignForId) || null
  const calc = pkgs.find((p) => p.id === calcId) || null
  const price = useMemo(() => {
    if (!calc) return null
    const base = Number(calc.prezzo) || 0
    const obbl = calc.voci.filter((v) => v.role === 'OBBLIGATORIO').reduce((s, v) => s + Number(v.surcharge || 0), 0)
    const opz = calc.voci.filter((v) => v.role === 'OPZIONALE' && optOn.has(v.menu_item_id)).reduce((s, v) => s + Number(v.surcharge || 0), 0)
    const perGuest = base + obbl + opz
    return { base, obbl, opz, perGuest, total: perGuest * (coperti || 0) }
  }, [calc, optOn, coperti])

  const dishesByCourse = useMemo(() => {
    const m: Record<string, Dish[]> = {}
    for (const d of dishes) { (m[d.portata] = m[d.portata] || []).push(d) }
    return m
  }, [dishes])

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="font-display text-lg flex items-center gap-2"><Package size={18} /> Pacchetti tutto incluso</h3>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setEditPkg({ id: null, nome: '', prezzo: '', note: '' })}>
            <Plus size={14} /> Nuovo pacchetto
          </Button>
        )}
      </div>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Crea uno o più percorsi "tutto incluso". Ogni piatto può entrare in più pacchetti (incluso, o integrazione opzionale/obbligatoria). Sotto, la calcolatrice del prezzo del buffet.</p>

      {pkgs.length === 0 ? (
        <p className="text-sm text-[rgb(var(--fg-subtle))] italic">Nessun pacchetto. {readOnly ? '' : 'Crea il primo con "Nuovo pacchetto".'}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {pkgs.map((p) => (
            <div key={p.id} className="rounded-xl border border-[rgb(var(--border))] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold truncate">{p.nome}</h4>
                  <p className="text-sm text-[rgb(var(--gold-700))] font-medium">{eur(p.prezzo)}/coperto</p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Modifica" onClick={() => setEditPkg({ id: p.id, nome: p.nome, prezzo: String(p.prezzo), note: p.note ?? '' })}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Elimina" onClick={() => delPkg(p.id)}><Trash2 size={13} /></Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{p.voci.length} voci · {p.voci.filter((v) => v.role !== 'INCLUSO').length} integrazioni</p>
              {!readOnly && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAssignForId(p.id)}>Assegna piatti</Button>}
            </div>
          ))}
        </div>
      )}

      {/* CALCOLATRICE PREZZO BUFFET */}
      {pkgs.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h4 className="font-medium flex items-center gap-2"><Calculator size={16} /> Calcolatrice prezzo buffet</h4>
            <select value={calcId} onChange={(e) => { setCalcId(e.target.value); setExcluded(new Set()); setOptOn(new Set()) }}
              className="h-9 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
              {pkgs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          {calc && price && (
            <>
              <p className="text-xs text-[rgb(var(--fg-muted))] mb-2">Base tutto incluso <span className="font-medium">{eur(price.base)}/coperto</span>. Escludi voci che non vuoi nel buffet; aggiungi le integrazioni.</p>
              {COURSE_ORD.filter((c) => calc.voci.some((v) => v.portata === c)).map((c) => (
                <div key={c} className="mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--gold-700))] font-medium mb-1">{COURSE_LBL[c] ?? c}</p>
                  <div className="space-y-1">
                    {calc.voci.filter((v) => v.portata === c).map((v) => {
                      const isExcluded = excluded.has(v.menu_item_id)
                      const isOpt = v.role === 'OPZIONALE'
                      const isObbl = v.role === 'OBBLIGATORIO'
                      const optSel = optOn.has(v.menu_item_id)
                      return (
                        <div key={v.menu_item_id} className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2.5 py-1.5 border ${isExcluded ? 'opacity-50 border-transparent' : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]'}`}>
                          <span className={`min-w-0 truncate ${isExcluded ? 'line-through' : ''}`}>
                            {v.piatto}
                            {isObbl && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-700))' }}>obbligatoria +{eur(v.surcharge)}</span>}
                            {isOpt && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>opzionale +{eur(v.surcharge)}</span>}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isOpt && !isExcluded && (
                              <button onClick={() => setOptOn((s) => { const n = new Set(s); n.has(v.menu_item_id) ? n.delete(v.menu_item_id) : n.add(v.menu_item_id); return n })}
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${optSel ? 'bg-[rgb(var(--gold-500))] text-white border-transparent' : 'border-[rgb(var(--border))]'}`}>
                                {optSel ? <span className="inline-flex items-center gap-1"><Check size={11} /> aggiunta</span> : 'aggiungi'}
                              </button>
                            )}
                            <button onClick={() => setExcluded((s) => { const n = new Set(s); n.has(v.menu_item_id) ? n.delete(v.menu_item_id) : n.add(v.menu_item_id); return n })}
                              className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]" title={isExcluded ? 'Reintegra nel buffet' : 'Escludi dal buffet'}>
                              {isExcluded ? <Plus size={14} /> : <XIcon size={14} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {calc.voci.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] italic mb-2">Nessun piatto assegnato a questo pacchetto. {readOnly ? '' : 'Usa "Assegna piatti".'}</p>}
              <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3 mt-1">
                <div className="text-xs text-[rgb(var(--fg-muted))]">
                  base {eur(price.base)}{price.obbl > 0 && ` · obblig. +${eur(price.obbl)}`}{price.opz > 0 && ` · opz. +${eur(price.opz)}`}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg leading-tight">{eur(price.perGuest)}<span className="text-sm font-normal text-[rgb(var(--fg-muted))]">/coperto</span></p>
                  <p className="text-xs text-[rgb(var(--fg-muted))]">× {coperti || 0} coperti = <span className="font-medium text-[rgb(var(--fg))]">{eur(price.total)}</span></p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODALE: crea/modifica pacchetto */}
      {editPkg && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditPkg(null)}>
          <div className="surface surface-elev max-w-md w-full p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">{editPkg.id ? 'Modifica pacchetto' : 'Nuovo pacchetto'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditPkg(null)} aria-label="Chiudi"><XIcon size={16} /></Button>
            </div>
            <div className="space-y-4">
              <div><Label htmlFor="pk-name">Nome</Label><Input id="pk-name" value={editPkg.nome} onChange={(e) => setEditPkg({ ...editPkg, nome: e.target.value })} placeholder="Es. Percorso Gourmet · Oro" /></div>
              <div><Label htmlFor="pk-price">Prezzo tutto incluso €/coperto</Label><Input id="pk-price" type="number" min="0" step="1" value={editPkg.prezzo} onChange={(e) => setEditPkg({ ...editPkg, prezzo: e.target.value })} placeholder="Es. 120" /></div>
              <div><Label htmlFor="pk-note">Note (facoltative)</Label><Input id="pk-note" value={editPkg.note} onChange={(e) => setEditPkg({ ...editPkg, note: e.target.value })} placeholder="Es. include open bar e torta" /></div>
              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <Button variant="ghost" onClick={() => setEditPkg(null)}>Annulla</Button>
                <Button variant="gold" onClick={savePkg} disabled={busy}><Save size={14} /> Salva</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: assegna piatti al pacchetto */}
      {assignPkg && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setAssignForId(null)}>
          <div className="surface surface-elev max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <h3 className="font-display text-xl">Assegna piatti · {assignPkg.nome}</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">Per ogni piatto scegli il ruolo nel pacchetto. Le integrazioni possono avere un sovrapprezzo €/coperto.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAssignForId(null)} aria-label="Chiudi"><XIcon size={16} /></Button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 space-y-3">
              {COURSE_ORD.filter((c) => (dishesByCourse[c] ?? []).length > 0).map((c) => (
                <div key={c}>
                  <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--gold-700))] font-medium mb-1">{COURSE_LBL[c] ?? c}</p>
                  <div className="space-y-1.5">
                    {(dishesByCourse[c] ?? []).map((d) => {
                      const voce = assignPkg.voci.find((v) => v.menu_item_id === d.menu_item_id)
                      const role = voce?.role ?? null
                      const needsSur = role === 'OPZIONALE' || role === 'OBBLIGATORIO'
                      return (
                        <div key={d.menu_item_id} className="flex items-center justify-between gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-2">
                          <span className="min-w-0 truncate text-sm">{d.piatto}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {needsSur && (
                              <Input type="number" min="0" step="1" defaultValue={voce?.surcharge ?? 0}
                                onBlur={(e) => setItem(assignPkg.id, d.menu_item_id, role as Role, Number(e.target.value) || 0)}
                                className="w-16 h-8 text-sm" title="Sovrapprezzo €/coperto" />
                            )}
                            {([['—', null], ['Incluso', 'INCLUSO'], ['Opz.', 'OPZIONALE'], ['Obbl.', 'OBBLIGATORIO']] as Array<[string, Role | null]>).map(([lbl, r]) => (
                              <button key={lbl} onClick={() => setItem(assignPkg.id, d.menu_item_id, r, voce?.surcharge ?? 0)}
                                className={`text-[11px] px-2 py-1 rounded-md border ${role === r ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {dishes.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] italic">Nessun piatto disponibile: definisci prima i piatti della proposta.</p>}
            </div>
            <div className="p-4 border-t flex justify-end" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="gold" onClick={() => setAssignForId(null)}>Fatto</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
