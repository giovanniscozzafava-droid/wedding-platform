// Rappresentazione di scala: una donna a mezzo busto che tiene l'album del formato scelto,
// così il cliente capisce la grandezza reale. L'album si ridimensiona in base ai cm.
export function AlbumScaleFigure({ wCm, hCm, sizeLabel }: { wCm: number; hCm: number; sizeLabel?: string }) {
  // Riferimento antropometrico: larghezza spalle ~42 cm → span in unità SVG.
  const shoulderCm = 42
  const shoulderSpan = 170 // da x=55 a x=225
  const pxPerCm = shoulderSpan / shoulderCm
  const aw = Math.max(16, wCm * pxPerCm)
  const ah = Math.max(16, hCm * pxPerCm)
  const cx = 140
  const cy = 188 // centro album, all'altezza delle mani
  const ax = cx - aw / 2
  const ay = cy - ah / 2
  const ink = 'rgb(var(--fg) / 0.16)'
  const inkLine = 'rgb(var(--fg) / 0.28)'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 280 290" className="w-full max-w-[230px]" role="img" aria-label="Confronto di grandezza">
        {/* busto: testa, collo, spalle/torso (mezzo busto, tagliato in basso) */}
        <g fill={ink} stroke={inkLine} strokeWidth={1.2}>
          <circle cx={cx} cy={46} r={23} />
          <path d="M126 66 q14 9 28 0 l0 13 q-14 8 -28 0 z" />
          <path d="M40 290 C 46 168, 66 104, 105 95 Q 140 88 175 95 C 214 104, 234 168, 240 290 Z" />
        </g>
        {/* braccia/avambracci che tengono l'album */}
        <g stroke={inkLine} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.9}>
          <path d={`M72 150 Q 64 200 ${ax + 14} ${ay + ah - 6}`} stroke={ink} />
          <path d={`M208 150 Q 216 200 ${ax + aw - 14} ${ay + ah - 6}`} stroke={ink} />
        </g>

        {/* ombra album */}
        <rect x={ax + 3} y={ay + 4} width={aw} height={ah} rx={3} fill="rgb(20 18 14 / 0.18)" />
        {/* album: copertina + dorso + blocco pagine */}
        <g>
          <rect x={ax} y={ay} width={aw} height={ah} rx={3} fill="url(#albcov)" stroke="rgb(var(--gold-700))" strokeWidth={1} />
          <rect x={ax} y={ay} width={Math.min(10, aw * 0.14)} height={ah} rx={2} fill="rgb(var(--gold-700) / 0.55)" />
          <rect x={ax + 6} y={ay + 5} width={Math.max(2, aw - 12)} height={Math.max(2, ah - 10)} rx={1.5} fill="none" stroke="rgb(255 255 255 / 0.45)" strokeWidth={0.8} />
        </g>
        {/* mani sopra l'album */}
        <g fill={ink} stroke={inkLine} strokeWidth={1}>
          <ellipse cx={ax + 12} cy={ay + ah - 4} rx={11} ry={7} />
          <ellipse cx={ax + aw - 12} cy={ay + ah - 4} rx={11} ry={7} />
        </g>

        <defs>
          <linearGradient id="albcov" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--gold-500))" />
            <stop offset="1" stopColor="rgb(var(--gold-700))" />
          </linearGradient>
        </defs>
      </svg>
      <p className="text-xs text-[rgb(var(--fg-muted))] -mt-1">Grandezza reale {sizeLabel ? <>· <strong>{sizeLabel}</strong></> : null}</p>
    </div>
  )
}
