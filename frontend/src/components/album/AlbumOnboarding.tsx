import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// Onboarding "primo utilizzo": spiega il flusso passo-passo. Si mostra UNA volta (localStorage per
// utente); l'utente può saltarlo. Usato al primo ingresso del fotografo nella sezione foto.
export type OnbStep = { icon: ReactNode; title: string; body: ReactNode }

export function AlbumOnboarding({ steps, storageKey }: { steps: OnbStep[]; storageKey: string }) {
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => { try { if (!localStorage.getItem(storageKey)) setOpen(true) } catch { /* no storage */ } }, [storageKey])
  const close = () => { try { localStorage.setItem(storageKey, '1') } catch { /* no storage */ } setOpen(false) }
  if (!open || !steps.length) return null
  const s = steps[Math.min(i, steps.length - 1)]!
  const last = i >= steps.length - 1
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[min(94vw,460px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 shadow-2xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">{s.icon}</span>
          <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Passo {i + 1} di {steps.length}</span>
        </div>
        <p className="font-display text-lg">{s.title}</p>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{s.body}</p>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-[rgb(var(--gold-500))]' : 'w-1.5 bg-[rgb(var(--border))]'}`} />)}
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={close} className="text-xs text-[rgb(var(--fg-subtle))] hover:underline">Salta</button>
          <div className="flex gap-2">
            {i > 0 && <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>Indietro</Button>}
            {!last ? <Button variant="gold" size="sm" onClick={() => setI(i + 1)}>Avanti</Button> : <Button variant="gold" size="sm" onClick={close}>Ho capito</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
