import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// Promemoria NON bloccante: solo per le LOCATION. Mostra quanti movimenti di cassa
// del mese (incassi preventivo / ordini F&B ricevuti) non sono ancora in prima nota.
export function PrimaNotaNudge() {
  const { profile } = useAuth()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (profile?.role !== 'LOCATION') return
    void (async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: unknown; error: Error | null }>
      }).rpc('prima_nota_pending_count')
      if (!error) setCount(Number(data) || 0)
    })()
  }, [profile?.role])

  if (profile?.role !== 'LOCATION' || !count || count <= 0) return null

  return (
    <Link to="/prima-nota"
      className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm"
      style={{ borderColor: 'rgb(var(--gold-300))', background: 'rgb(var(--gold-100))' }}>
      <span className="rounded-full p-2" style={{ background: 'rgb(var(--gold-200))', color: 'rgb(var(--gold-700))' }}>
        <NotebookPen size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[rgb(var(--gold-700))]">
          Hai {count} {count === 1 ? 'movimento di cassa' : 'movimenti di cassa'} da registrare questo mese
        </div>
        <div className="text-xs text-[rgb(var(--fg-muted))]">Tieni aggiornata la prima nota della location.</div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[rgb(var(--gold-700))] shrink-0">
        Prima nota <ArrowRight size={15} />
      </span>
    </Link>
  )
}
