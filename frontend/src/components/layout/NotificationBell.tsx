import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Campanella notifiche con badge rosso (+N). Mostra preventivi accettati,
// contratti firmati, nuove richieste. Polling leggero ogni 30s.
// ============================================================================

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, args)

export function NotificationBell() {
  const nav = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const { data } = await rpc('unread_notifications_count')
    setCount(typeof data === 'number' ? data : 0)
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 30000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      const { data } = await rpc('list_notifications', { p_limit: 20 })
      setItems((data as Notif[]) ?? [])
      // segna lette dopo aver aperto
      await rpc('mark_notifications_read')
      setCount(0)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => void toggle()} aria-label="Notifiche" className="relative p-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))]">
        <Bell size={18} className="text-[rgb(var(--fg-muted))]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: '#dc2626' }}>
            {count > 9 ? '9+' : `+${count}`}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-lg z-50"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
          <div className="px-4 py-2.5 border-b text-sm font-medium" style={{ borderColor: 'rgb(var(--border))' }}>Notifiche</div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[rgb(var(--fg-subtle))]">Nessuna notifica.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => { setOpen(false); if (n.link) nav(n.link) }}
                    className="w-full text-left px-4 py-3 border-b last:border-0 hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))', background: n.read_at ? undefined : 'rgb(220 38 38 / 0.05)' }}>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">{new Date(n.created_at).toLocaleString('it-IT')}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
