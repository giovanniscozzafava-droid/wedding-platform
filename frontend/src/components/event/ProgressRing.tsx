import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

// Anello di progressione stile Apple: arco continuo che si chiude. value 0..1.
export function ProgressRing({ value, label, detail, size = 76, stroke = 9, onClick }: {
  value: number; label: string; detail?: string; size?: number; stroke?: number; onClick?: () => void
}) {
  const r = (size - stroke) / 2
  const cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value || 0))
  const closed = v >= 0.999
  const Wrap: 'button' | 'div' = onClick ? 'button' : 'div'
  return (
    <Wrap onClick={onClick} className={`flex flex-col items-center gap-1.5 ${onClick ? 'group cursor-pointer' : ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="pringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--gold-600))" />
              <stop offset="55%" stopColor="rgb(var(--gold-500))" />
              <stop offset="100%" stopColor="rgb(var(--gold-300))" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} stroke="rgb(var(--bg-sunken))" />
          <motion.circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
            stroke="url(#pringGrad)" strokeDasharray={C}
            initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - v) }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          {closed
            ? <Check size={20} className="text-[rgb(var(--gold-600))]" />
            : <span className="text-[13px] font-semibold text-[rgb(var(--fg))]">{Math.round(v * 100)}<span className="text-[9px]">%</span></span>}
        </span>
      </div>
      <span className="text-xs font-medium text-center leading-tight group-hover:text-[rgb(var(--gold-700))]">{label}</span>
      {detail && <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{detail}</span>}
    </Wrap>
  )
}
