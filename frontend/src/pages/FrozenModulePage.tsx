import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PauseCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FROZEN_MODULES, isFrozen } from '@/lib/frozenModules'

// Gate da avvolgere intorno all'element di una rotta: se il path è congelato
// mostra l'avviso "in pausa" al posto del modulo (che resta importato e intatto,
// così la riattivazione è solo togliere il path da FROZEN_MODULES).
export function FrozenGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return isFrozen(pathname) ? <FrozenModulePage /> : <>{children}</>
}

// Schermata per un modulo messo "in pausa" durante il refocus sul core rete.
// Il codice del modulo resta intatto: qui comunichiamo solo che è sospeso e
// riportiamo l'utente agli Strumenti. Riattivazione = rimuovere la voce da
// FROZEN_MODULES.
export default function FrozenModulePage() {
  const { pathname } = useLocation()
  const label = FROZEN_MODULES[pathname] ?? 'Questo strumento'

  return (
    <div className="min-h-full">
      <div className="max-w-lg mx-auto px-6 py-16">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
               style={{ background: 'rgb(var(--bg-sunken))' }}>
            <PauseCircle size={26} strokeWidth={1.5} style={{ color: 'rgb(var(--gold-700))' }} />
          </div>
          <h1 className="text-lg font-semibold text-[rgb(var(--fg))]">{label} è in pausa</h1>
          <p className="mt-2 text-sm text-[rgb(var(--fg-muted))]">
            Stiamo concentrando il lavoro sulla rete: preventivi, contratti, fornitori ed eventi.
            Questo strumento tornerà disponibile più avanti — i tuoi dati restano al sicuro.
          </p>
          <Link to="/strumenti" className="inline-block mt-6">
            <Button variant="gold">Torna agli strumenti</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
