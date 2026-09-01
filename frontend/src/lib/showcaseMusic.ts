// MUSICA DELLA PRESENTAZIONE FOTO — un carattere per tipo di evento.
//
// Due sorgenti, in quest'ordine:
//   1. un brano vero in /music/<stile>.mp3 → se c'è vince sempre: è musica suonata.
//   2. altrimenti la generiamo dal vivo in Web Audio: nessun file, nessun copyright,
//      e non si ripete mai (niente loop che si sente girare). Serve a non lasciare
//      muta la presentazione finché i brani veri non ci sono.
//
// Per aggiungere un brano vero: metti il file in frontend/public/music/ e aggiungi
// la voce in TRACK_FILE qui sotto. Nient'altro da toccare.

export type StyleKey = 'romantica' | 'culla' | 'solenne' | 'festa' | 'sobria'

/** Che musica va con che evento. */
export const STYLE_BY_KIND: Record<string, StyleKey> = {
  matrimonio: 'romantica',
  anniversario: 'romantica',
  battesimo: 'culla',
  comunione: 'solenne',
  cresima: 'solenne',
  compleanno: 'festa',
  laurea: 'festa',
  corporate: 'sobria',
  altro: 'sobria',
}

export const STYLE_LABEL: Record<StyleKey, string> = {
  romantica: 'Romantica',
  culla: 'Delicata',
  solenne: 'Solenne',
  festa: 'Festosa',
  sobria: 'Sobria',
}

/** Brani veri disponibili (file in /public/music). Vedi music/SOURCES.md per le licenze:
 *  tutte registrazioni di pubblico dominio o CC0 da Wikimedia Commons. */
export const TRACK_FILE: Partial<Record<StyleKey, string>> = {
  romantica: '/music/romantica.mp3',   // Chopin, Notturno op. 9 n. 2
  culla:     '/music/culla.mp3',       // Brahms, Ninna nanna op. 49 n. 4
  solenne:   '/music/solenne.mp3',     // Bach, BWV 147 «Jesus bleibet meine Freude»
  festa:     '/music/festa.mp3',       // Mozart, Eine kleine Nachtmusik, Allegro
  sobria:    '/music/sobria.mp3',      // Satie, Gnossienne n. 1
}

export function styleForKind(kind: string | null | undefined): StyleKey {
  return STYLE_BY_KIND[(kind ?? 'matrimonio').toLowerCase()] ?? 'romantica'
}

// ————————————————————————————————————————————————————————————————
// Generatore procedurale
// ————————————————————————————————————————————————————————————————

type Palette = {
  root: number            // Hz della fondamentale
  bpm: number
  wave: OscillatorType    // timbro della melodia
  padWave: OscillatorType
  scale: number[]         // gradi in semitoni
  chords: number[][]      // progressione: [offset fondamentale, ...intervalli]
  cutoff: number          // lowpass: quanto "aperto" è il suono
  decay: number           // durata della nota di melodia
  density: number         // 0..1 quante posizioni ritmiche suonano
  padGain: number
  leadGain: number
}

const PALETTES: Record<StyleKey, Palette> = {
  // Pianoforte lontano, archi tenuti: caldo, lento, mai sdolcinato.
  romantica: {
    root: 146.83, bpm: 56, wave: 'triangle', padWave: 'sine',
    scale: [0, 2, 4, 7, 9, 12, 14, 16],
    chords: [[0, 0, 4, 7], [9, 0, 3, 7], [5, 0, 4, 7], [7, 0, 4, 7]],
    cutoff: 1900, decay: 2.6, density: 0.5, padGain: 0.16, leadGain: 0.13,
  },
  // Carillon: note corte, cristalline, tante pause. Per il battesimo.
  culla: {
    root: 261.63, bpm: 64, wave: 'sine', padWave: 'sine',
    scale: [0, 2, 4, 7, 9, 12, 16, 19],
    chords: [[0, 0, 4, 7], [5, 0, 4, 7], [7, 0, 4, 7], [0, 0, 4, 7]],
    cutoff: 3200, decay: 1.4, density: 0.42, padGain: 0.1, leadGain: 0.15,
  },
  // Note lunghe, quinte aperte, aria di navata. Comunione e cresima.
  solenne: {
    root: 110.0, bpm: 44, wave: 'triangle', padWave: 'sawtooth',
    scale: [0, 2, 4, 5, 7, 11, 12, 16],
    chords: [[0, 0, 7, 12], [5, 0, 4, 7], [7, 0, 4, 7], [3, 0, 4, 7]],
    cutoff: 900, decay: 3.4, density: 0.32, padGain: 0.2, leadGain: 0.1,
  },
  // Pizzicato leggero, maggiore, passo svelto ma non chiassoso.
  festa: {
    root: 174.61, bpm: 92, wave: 'triangle', padWave: 'sine',
    scale: [0, 2, 4, 7, 9, 12, 14, 16],
    chords: [[0, 0, 4, 7], [7, 0, 4, 7], [9, 0, 3, 7], [5, 0, 4, 7]],
    cutoff: 2600, decay: 0.9, density: 0.68, padGain: 0.1, leadGain: 0.14,
  },
  // Poche note, molto spazio: sta sotto senza chiedere attenzione.
  sobria: {
    root: 98.0, bpm: 50, wave: 'sine', padWave: 'sine',
    scale: [0, 2, 5, 7, 12, 14],
    chords: [[0, 0, 7, 12], [5, 0, 7, 12], [3, 0, 7, 12], [7, 0, 7, 12]],
    cutoff: 1200, decay: 3.0, density: 0.28, padGain: 0.14, leadGain: 0.08,
  },
}

const semi = (hz: number, n: number) => hz * Math.pow(2, n / 12)

export type MusicHandle = {
  setVolume: (v: number) => void
  stop: () => void
  /** true se sta suonando davvero (l'autoplay del browser può averlo sospeso) */
  resume: () => Promise<boolean>
}

/**
 * Avvia la musica per uno stile. Se esiste un file lo suona in loop, altrimenti
 * genera. Ritorna una maniglia per volume e stop.
 */
export function startMusic(style: StyleKey, volume: number): MusicHandle {
  const file = TRACK_FILE[style]
  if (file) return startFile(file, volume)
  return startGenerated(style, volume)
}

function startFile(src: string, volume: number): MusicHandle {
  const el = new Audio(src)
  el.loop = true
  el.volume = Math.max(0, Math.min(1, volume))
  void el.play().catch(() => { /* l'autoplay può rifiutare: resume() riprova */ })
  return {
    setVolume: (v) => { el.volume = Math.max(0, Math.min(1, v)) },
    stop: () => { el.pause(); el.src = '' },
    resume: async () => { try { await el.play(); return !el.paused } catch { return false } },
  }
}

function startGenerated(style: StyleKey, volume: number): MusicHandle {
  const p = PALETTES[style]
  const Ctx: typeof AudioContext = window.AudioContext
    ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()

  const master = ctx.createGain()
  master.gain.value = Math.max(0, Math.min(1, volume))
  master.connect(ctx.destination)

  // Un filtro morbido + un delay in controfase danno l'aria della stanza senza
  // dover caricare un impulso di riverbero (che sarebbe un altro file).
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = p.cutoff
  tone.Q.value = 0.4
  tone.connect(master)

  const delay = ctx.createDelay(1.2)
  delay.delayTime.value = 60 / p.bpm * 1.5
  const fb = ctx.createGain(); fb.gain.value = 0.28
  const wet = ctx.createGain(); wet.gain.value = 0.3
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master)

  const beat = 60 / p.bpm
  let step = 0
  let next = ctx.currentTime + 0.15
  let lastDegree = 0

  function note(freq: number, at: number, dur: number, gain: number, wave: OscillatorType, toDelay: boolean) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = wave
    o.frequency.value = freq
    // Attacco morbido e coda lunga: nessun click, niente di percussivo.
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + Math.min(0.25, dur * 0.25))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g); g.connect(tone)
    if (toDelay) g.connect(delay)
    o.start(at); o.stop(at + dur + 0.05)
  }

  function schedule() {
    // Guarda avanti mezzo secondo: il timer di JS non è preciso, l'orologio audio sì.
    while (next < ctx.currentTime + 0.6) {
      const bar = Math.floor(step / 8) % p.chords.length
      const chord = p.chords[bar]!
      // Accordo tenuto: cambia una volta ogni due battute.
      if (step % 8 === 0) {
        for (const iv of chord.slice(1)) {
          note(semi(p.root, chord[0]! + iv), next, beat * 8.4, p.padGain, p.padWave, false)
        }
      }
      // Melodia: passi piccoli, qualche salto, molte pause.
      if (Math.random() < p.density) {
        const jump = Math.random() < 0.22 ? 2 : 1
        lastDegree = Math.max(0, Math.min(p.scale.length - 1,
          lastDegree + (Math.random() < 0.5 ? -jump : jump)))
        const deg = p.scale[lastDegree]!
        note(semi(p.root, chord[0]! + deg + 12), next, p.decay,
          p.leadGain * (0.75 + Math.random() * 0.35), p.wave, true)
      }
      next += beat
      step += 1
    }
  }

  schedule()
  const timer = window.setInterval(schedule, 180)

  return {
    setVolume: (v) => {
      const t = Math.max(0, Math.min(1, v))
      master.gain.setTargetAtTime(t, ctx.currentTime, 0.08)
    },
    stop: () => { window.clearInterval(timer); void ctx.close().catch(() => {}) },
    resume: async () => {
      try { await ctx.resume(); return ctx.state === 'running' } catch { return false }
    },
  }
}
