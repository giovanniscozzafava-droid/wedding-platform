import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Image, Frame, Palette, LayoutPanelTop, ShoppingBag, Crop, Truck, Award, Clock3, ArrowLeft, Sparkles } from 'lucide-react'

// Vetrina "Prossimamente" del Negozio Stampe (PRP-4). NON è il modulo commerciale (niente Stripe,
// ordini, prezzi): è una presentazione da mostrare ai clienti finché il modulo vero è dietro il gate.
const CATEGORIES = [
  { icon: Image, title: 'Stampa Fine Art', desc: 'Carte museali Hahnemühle, Canson Platine, Photorag. Plotter HP a pigmenti, colori fedeli, dettaglio assoluto.', formats: 'Dal 10×15 al 60×100' },
  { icon: Palette, title: 'Tela Canvas', desc: 'Cotone su telaio, oppure Tela Gallery con cornice a vista (laccato bianco/nero, noce, legno naturale).', formats: 'Dal 20×30 al 90×100' },
  { icon: Frame, title: 'Cornice in legno', desc: 'Profili piatti o bomberino, da muro o da tavolo, con protezione anti-riflesso. Colori a scelta.', formats: 'Dal 10×15 al 50×70' },
  { icon: LayoutPanelTop, title: 'Pannello', desc: 'Forex, Piuma, Alluminio o Plexiglass. Leggeri, moderni, pronti da appendere senza cornice.', formats: 'Dal 20×30 al metro quadro' },
]
const STEPS = [
  { icon: ShoppingBag, title: 'Scegli', desc: 'Materiale e formato dalla foto che ami di più.' },
  { icon: Crop, title: 'Ritaglia', desc: 'Inquadri tu cosa stampare: vedi esattamente il risultato.' },
  { icon: Truck, title: 'Ricevi a casa', desc: 'Stampa d’autore curata dal tuo fotografo, consegnata da te.' },
]

export default function PrintShopComingSoon() {
  return (
    <div className="aurora min-h-screen">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <div className="flex items-center gap-2 mb-8">
          <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-lg">Planfully</span>
          <Link to="/" className="ml-auto text-sm text-[rgb(var(--fg-muted))] hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} /> Indietro</Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
            <Sparkles size={12} /> Novità
          </span>
          <h1 className="font-display text-4xl sm:text-5xl mt-4 leading-tight">Le tue foto, stampe d&rsquo;autore</h1>
          <p className="text-[rgb(var(--fg-muted))] mt-4 text-lg">
            Ordina le tue foto preferite come stampe, tele, cornici e pannelli —
            curate dal tuo fotografo e consegnate a casa.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4 mt-12">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="surface rounded-2xl p-6 flex gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <c.icon size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-lg">{c.title}</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">{c.desc}</p>
                <p className="text-[12px] text-[rgb(var(--fg-subtle))] mt-2">{c.formats}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="font-display text-2xl text-center">Come funzionerà</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center px-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3" style={{ background: 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border))', color: 'rgb(var(--gold-700))' }}>
                  <s.icon size={20} />
                </span>
                <h3 className="font-medium">{i + 1}. {s.title}</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-6 mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[rgb(var(--fg-muted))]">
          <span className="inline-flex items-center gap-2"><Award size={16} className="text-[rgb(var(--gold-600))]" /> Carte e materiali da galleria</span>
          <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-[rgb(var(--gold-600))]" /> Colori garantiti nel tempo</span>
          <span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-[rgb(var(--gold-600))]" /> Anteprima fedele prima di ordinare</span>
        </div>

        <p className="text-center text-sm text-[rgb(var(--fg-muted))] mt-10">
          Apri la tua galleria, scegli la foto che ami di più e tocca <strong>«Stampa»</strong>.
        </p>
      </div>
    </div>
  )
}
