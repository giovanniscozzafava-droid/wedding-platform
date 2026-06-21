import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type FiloSignal = { key: string; priority: number; area: string; title: string; body: string; link: string }

// FILO v1 — la guida dentro Planfully. Presenza fluttuante (glifo ring-and-dot) che, toccata,
// dice "a cosa serve + la prossima mossa" dell'area in cui sei, con la voce del fondatore.
// In v1 SUGGERISCE, non risponde: niente input, niente chat (quella è la v2).
// Glifo semplice; l'arte materica del moodboard è polish e arriva dopo.

const RING = (size = 22) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" />
  </svg>
)

type Tip = { area: string; what: string; next: string }

// match per prefisso (specifici prima dei generici). Voce: dai del tu, asciutto, una mossa sola.
const TIPS: Array<{ m: string; t: Tip }> = [
  { m: '/quotes', t: { area: 'Preventivi', what: 'Qui crei le offerte e vedi che fine fanno: aperte, accettate, rifiutate.', next: 'Crea un preventivo e mandalo: da lì in poi ti dico quando il cliente lo apre.' } },
  { m: '/my-contracts', t: { area: 'Contratti', what: 'I documenti da firmare. Nascono dal preventivo accettato.', next: 'Se sono in attesa di firma, un sollecito breve di solito sblocca tutto.' } },
  { m: '/contracts', t: { area: 'Contratti', what: 'I documenti da firmare. Nascono dal preventivo accettato.', next: 'Se sono in attesa di firma, un sollecito breve di solito sblocca tutto.' } },
  { m: '/weddings', t: { area: 'Eventi', what: 'Il cantiere dell’evento: invitati, tavoli, scaletta, mood, album.', next: 'Parti da invitati e tavoli: il resto si incastra da lì.' } },
  { m: '/calendar', t: { area: 'Calendario', what: 'Le tue date: libere, occupate, da confermare.', next: 'Tieni aggiornata la disponibilità: chi ti propone per una data vede subito se ci sei.' } },
  { m: '/catalog', t: { area: 'Catalogo', what: 'I tuoi servizi e prezzi. È il motore dei preventivi veloci.', next: 'Carica 3–4 servizi col prezzo: il prossimo preventivo lo fai in un minuto.' } },
  { m: '/suppliers', t: { area: 'Rete fornitori', what: 'I professionisti con cui collabori. Più rete, più lavoro che gira.', next: 'Invita i fornitori con cui lavori già: il codice glielo dai tu, restano collegati a te.' } },
  { m: '/leads', t: { area: 'Lead', what: 'Le richieste in arrivo. Il punto di partenza della pipeline.', next: 'Rispondi in fretta a quelli nuovi: la velocità è metà del lavoro.' } },
  { m: '/richieste', t: { area: 'Richieste', what: 'I lavori che ti propongono i capostipiti.', next: 'Apri le nuove e conferma la tua disponibilità: così il preventivo va avanti.' } },
  { m: '/clienti', t: { area: 'Clienti', what: 'I tuoi clienti diretti.', next: 'Tieni le schede in ordine: ti servono quando prepari un preventivo.' } },
  { m: '/capostipiti', t: { area: 'Capostipiti', what: 'I wedding planner e le location con cui collabori.', next: 'Più capostipiti attivi, più eventi che ti arrivano.' } },
  { m: '/lavori-da-confermare', t: { area: 'Da confermare', what: 'Le voci che un capostipite ti ha messo a preventivo.', next: 'Confermale o segnala una modifica: senza la tua conferma il preventivo resta fermo.' } },
  { m: '/album', t: { area: 'Album', what: 'Impagini le foto e le fai sfogliare al cliente.', next: 'Quando la bozza è pronta, condividila: il cliente lascia i post-it e tu rispondi.' } },
  { m: '/profile', t: { area: 'Profilo', what: 'I tuoi dati e il tuo brand.', next: 'Completa logo e dati: i preventivi e i contratti escono già con la tua faccia.' } },
]

const DEFAULT_TIP: Tip = {
  area: 'Planfully',
  what: 'Sono qui nell’angolo. Toccami in ogni schermata e ti dico cosa puoi farci.',
  next: 'Il flusso è semplice: preventivo → invio → quando lo aprono → contratto → evento.',
}

function tipFor(pathname: string): Tip {
  return (TIPS.find((x) => pathname === x.m || pathname.startsWith(x.m + '/') || pathname === x.m) ?? null)?.t
    ?? TIPS.find((x) => pathname.startsWith(x.m))?.t
    ?? DEFAULT_TIP
}

export function Filo() {
  const { profile } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [firstRun, setFirstRun] = useState(false)
  const [peek, setPeek] = useState<FiloSignal | null>(null) // Filo che "fa capolino" da solo
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const lastPeekKey = useRef<string | null>(null)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = profile?.role
  const isPro = role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'FORNITORE' || role === 'ADMIN'
  const isFornitore = role === 'FORNITORE'

  // Primo accesso: Filo si presenta una volta sola, poi si fa da parte.
  useEffect(() => {
    if (!isPro) return
    let seen = true
    try { seen = localStorage.getItem('filo-seen-v1') === '1' } catch { /* private mode */ }
    if (!seen) { setFirstRun(true); setOpen(true) }
  }, [isPro])

  // chiudi col click fuori / Esc
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const tip = useMemo(() => tipFor(location.pathname), [location.pathname])
  const nav = useNavigate()

  // Filo legge lo stato reale del business (RPC filo_brief) e ne ricava i consigli prioritizzati.
  const { data: brief } = useQuery({
    queryKey: ['filo-brief'],
    enabled: isPro,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('filo_brief')
      if (error) throw error
      return data as { signals?: FiloSignal[] }
    },
  })
  const signals = useMemo(() => [...(brief?.signals ?? [])].sort((a, b) => a.priority - b.priority).slice(0, 4), [brief])
  const hasUrgent = signals.some((s) => s.priority === 1)

  // Filo PROATTIVO: quando arriva un consiglio urgente NUOVO (chiave diversa), fa capolino da solo
  // con un'anteprima per qualche secondo, poi si richiude nel badge. Non si ripete sulla stessa cosa.
  useEffect(() => {
    if (open || firstRun) { setPeek(null); return }
    const top = signals.find((s) => s.priority === 1)
    if (!top || lastPeekKey.current === top.key) return
    lastPeekKey.current = top.key
    setPeek(top)
    if (peekTimer.current) clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setPeek(null), 8000)
  }, [signals, open, firstRun])

  if (!isPro) return null

  const dismissFirstRun = () => {
    setFirstRun(false)
    try { localStorage.setItem('filo-seen-v1', '1') } catch { /* ignore */ }
  }
  const close = () => { if (firstRun) dismissFirstRun(); setOpen(false) }

  const welcome = isFornitore
    ? 'Qui gestisci il tuo lavoro sugli eventi a cui ti invitano. Partiamo da due cose che ti fanno fare bella figura: il Catalogo (servizi e prezzi) e la disponibilità in Calendario.'
    : 'Ti accompagno i primi giorni, poi resto qui nell’angolo. Partiamo dalla cosa che conta: il primo preventivo. Lo costruisci in due minuti, te lo monto io pulito e lo mandi al cliente.'

  return (
    <>
      {/* Mobile: sfoca e oscura il dietro così il testo di Filo non si confonde con la pagina. */}
      {open && <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm sm:hidden print:hidden" onClick={close} aria-hidden="true" />}
      {open && (
        <div ref={panelRef} className="fixed z-[61] bottom-[5.25rem] right-4 left-4 sm:left-auto sm:right-5 sm:w-[330px] max-h-[80vh] overflow-y-auto rounded-2xl border shadow-[var(--shadow-lift)] animate-[filoIn_.18s_ease-out] print:hidden"
          style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <span className="text-[rgb(var(--gold-600))]">{RING(20)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base leading-none">Filo</p>
              <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-0.5">{firstRun ? 'la tua guida' : tip.area}</p>
            </div>
            <button onClick={close} aria-label="Chiudi" className="p-1 rounded-md text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]"><X size={16} /></button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {firstRun ? (
              <>
                <p className="text-sm leading-relaxed"><strong>Ciao, sono Filo.</strong> {welcome}</p>
              </>
            ) : (
              <>
                {signals.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Filo ti consiglia</p>
                    {signals.map((s, i) => (
                      <button key={i} onClick={() => { close(); nav(s.link) }}
                        className="w-full text-left rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))] hover:bg-[rgb(var(--bg-sunken))] px-3 py-2 transition-colors">
                        <div className="flex items-center gap-2">
                          {s.priority === 1 && <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--gold-500))] shrink-0" />}
                          <span className="text-[13px] font-medium leading-none">{s.title}</span>
                          <span className="ml-auto text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] shrink-0">{s.area}</span>
                        </div>
                        <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 leading-snug">{s.body}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className={signals.length > 0 ? 'pt-2 mt-1 border-t border-[rgb(var(--border))]' : ''}>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Dove sei · {tip.area}</p>
                  <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{tip.what}</p>
                  <div className="rounded-lg bg-[rgb(var(--gold-100))]/60 px-3 py-2 mt-2">
                    <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-700))] mb-0.5">La prossima mossa</p>
                    <p className="text-sm leading-snug">{tip.next}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-4 pb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[rgb(var(--fg-subtle))]">Per ora ti suggerisco. La chat arriva presto.</span>
            <button onClick={close} className="text-xs font-medium px-3 py-1.5 rounded-full bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]">
              {firstRun ? 'Iniziamo' : 'Ok'}
            </button>
          </div>
        </div>
      )}

      {/* Filo proattivo: fa capolino da solo con il consiglio più importante, poi si richiude. */}
      {peek && !open && (
        <div className="fixed z-[61] bottom-[5.25rem] right-4 left-4 sm:left-auto sm:right-5 sm:w-[300px] rounded-2xl border shadow-[var(--shadow-lift)] overflow-hidden animate-[filoIn_.2s_ease-out] print:hidden"
          style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--gold-400))' }}>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[rgb(var(--gold-600))]">{RING(16)}</span>
              <span className="text-[11px] font-medium text-[rgb(var(--gold-700))]">Filo · {peek.area}</span>
              <button onClick={() => setPeek(null)} aria-label="Chiudi" className="ml-auto p-0.5 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]"><X size={14} /></button>
            </div>
            <button onClick={() => { setPeek(null); setOpen(true) }} className="block w-full text-left">
              <p className="text-sm font-medium leading-snug">{peek.title}</p>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5 leading-snug line-clamp-2">{peek.body}</p>
            </button>
            <div className="flex justify-end mt-2">
              <button onClick={() => { const l = peek.link; setPeek(null); nav(l) }} className="text-xs font-medium px-3 py-1 rounded-full bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]">Vai</button>
            </div>
          </div>
        </div>
      )}

      <button ref={btnRef} onClick={() => (open ? close() : setOpen(true))} aria-label="Filo — la tua guida" title="Filo"
        className="fixed z-[62] bottom-4 right-4 sm:bottom-5 sm:right-5 h-12 w-12 rounded-full border flex items-center justify-center shadow-[var(--shadow-lift)] transition-transform hover:scale-105 text-[rgb(var(--gold-600))] print:hidden"
        style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--gold-400))' }}>
        {!open && hasUrgent && <span className="absolute inset-0 rounded-full animate-[filoPing_2.6s_ease-out_infinite]" style={{ background: 'rgb(var(--gold-400))' }} aria-hidden="true" />}
        {RING(24)}
        {!open && signals.length > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[rgb(var(--gold-500))] text-white text-[10px] font-bold leading-none flex items-center justify-center ${hasUrgent ? 'animate-pulse' : ''}`}
            style={{ boxShadow: '0 0 0 2px rgb(var(--bg))' }} aria-label={`${signals.length} consigli da Filo`}>{signals.length}</span>
        )}
      </button>

      <style>{`@keyframes filoIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes filoPing{0%{transform:scale(1);opacity:.5}70%{transform:scale(1.85);opacity:0}100%{opacity:0}}`}</style>
    </>
  )
}
