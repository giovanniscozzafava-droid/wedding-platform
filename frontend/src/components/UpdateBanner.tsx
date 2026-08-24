import { useAppVersion } from '@/lib/useAppVersion'

// Banner discreto in basso: compare quando è disponibile una nuova versione.
// La ricarica avviene SOLO al tap dell'utente (mai automatica), così non
// interrompe la compilazione di un form (es. i dati di firma del preventivo).
export function UpdateBanner() {
  const { updateAvailable } = useAppVersion()
  if (!updateAvailable) return null
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 16, zIndex: 10000,
      display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 24px)',
      padding: '10px 14px', borderRadius: 12,
      background: '#25402F', color: '#F4F3EE',
      boxShadow: '0 6px 24px rgba(0,0,0,0.25)', fontSize: 14,
    }}>
      <span>È disponibile una versione aggiornata.</span>
      <button onClick={() => window.location.reload()}
        style={{
          background: '#F4F3EE', color: '#25402F', border: 'none', borderRadius: 8,
          padding: '6px 12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        Aggiorna
      </button>
    </div>
  )
}
