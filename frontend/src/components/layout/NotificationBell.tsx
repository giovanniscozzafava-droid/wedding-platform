import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Campanella notifiche con badge rosso (+N). Il pannello è in un PORTALE con
// posizione fixed calcolata dal campanello: così non viene tagliato dalla
// sidebar né la copre (bug: con align=start sbordava sul contenuto).
// ============================================================================

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, args)

export function NotificationBell({ align = 'end' }: { align?: 'start' | 'end' }) {
  const nav = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

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
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function computePos() {
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    const width = Math.min(320, window.innerWidth - 16)
    let left: number, top: number
    if (align === 'start') {
      // sidebar: apri a DESTRA del campanello (verso il contenuto), non sopra la nav
      left = r.right + 8
      top = r.top
      if (left + width > window.innerWidth - 8) left = Math.max(8, r.left - width - 8)
    } else {
      // topbar: allineato a destra, sotto il campanello
      top = r.bottom + 8
      left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    }
    top = Math.max(8, Math.min(top, window.innerHeight - 140))
    setPos({ top, left, width })
  }

  async function toggle() {
    const next = !open
    if (next) computePos()
    setOpen(next)
    if (next) {
      const { data } = await rpc('list_notifications', { p_limit: 20 })
      setItems((data as Notif[]) ?? [])
      await rpc('mark_notifications_read')
      setCount(0)
    }
  }

  useEffect(() => {
    if (!open) return
    const onResize = () => computePos()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

      {open && pos && createPortal(
        <div ref={panelRef} className="fixed max-h-[24rem] overflow-y-auto rounded-xl border shadow-xl z-[100]"
          style={{ top: pos.top, left: pos.left, width: pos.width, borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
          <div className="px-4 py-2.5 border-b text-sm font-medium sticky top-0" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>Notifiche</div>
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
        </div>, document.body)}
    </div>
  )
}
