// Preset servizi per subrole. Aiutano il fornitore a popolare velocemente
// il catalogo con voci tipiche del proprio settore, modificabili.
import type { Database } from '@/lib/database.types'

type Unit = Database['public']['Enums']['service_unit']

export type ServicePreset = {
  name: string
  description: string
  base_price: number
  unit: Unit
}

export const SERVICE_PRESETS: Record<string, ServicePreset[]> = {
  fotografo: [
    { name: 'Servizio fotografico full day', description: 'Copertura completa giornata: preparativi, cerimonia, ricevimento, post-cena. 8-10 ore.', base_price: 2200, unit: 'EVENTO' },
    { name: 'Reportage cerimonia + ricevimento', description: 'Solo cerimonia e prime ore di ricevimento. 5-6 ore.', base_price: 1500, unit: 'EVENTO' },
    { name: 'Album premium 40×30', description: 'Album fine art rilegato a mano, copertina in pelle, 60 pagine.', base_price: 650, unit: 'PEZZO' },
    { name: 'Riprese drone cerimonia', description: 'Aerial shots della location + arrivo sposi. 30 min editing.', base_price: 380, unit: 'EVENTO' },
    { name: 'Engagement shoot pre-matrimonio', description: 'Sessione fotografica di coppia 2 ore in location scelta.', base_price: 450, unit: 'EVENTO' },
    { name: 'Stampe extra (per pezzo)', description: 'Stampa fine art 30×40 cm, carta cotone.', base_price: 35, unit: 'PEZZO' },
  ],
  videomaker: [
    { name: 'Video matrimonio + trailer', description: 'Full day video + trailer 3 minuti consegnato in 30 giorni.', base_price: 2800, unit: 'EVENTO' },
    { name: 'Highlight 1 minuto social', description: 'Reel verticale per Instagram, consegnato in 7 giorni.', base_price: 380, unit: 'EVENTO' },
    { name: 'Cerimonia integrale multi-camera', description: 'Cerimonia completa con 2 camere + audio professionale.', base_price: 1200, unit: 'EVENTO' },
    { name: 'Pre-wedding film', description: 'Mini film 2-3 min girato prima del matrimonio in location.', base_price: 700, unit: 'EVENTO' },
    { name: 'Riprese drone', description: 'Aerial shots + editing dedicato.', base_price: 480, unit: 'EVENTO' },
  ],
  fioraio: [
    { name: 'Bouquet sposa premium', description: 'Composizione tonale concordata, fiori di stagione, fasciatura in seta.', base_price: 180, unit: 'PEZZO' },
    { name: 'Centrotavola elegante', description: 'Composizione bassa con candele, fiori di stagione, supporto in ceramica/vetro.', base_price: 55, unit: 'PEZZO' },
    { name: 'Centrotavola alto strutturato', description: 'Composizione alta su tronchetto con fiori a cascata. Tema scenografico.', base_price: 120, unit: 'PEZZO' },
    { name: 'Allestimento chiesa', description: 'Composizioni altare + banchi, archi floreali, sospensioni.', base_price: 950, unit: 'EVENTO' },
    { name: 'Allestimento ricevimento completo', description: 'Tavolo sposi, centrotavola, lounge area, photo corner.', base_price: 1800, unit: 'EVENTO' },
    { name: 'Boutonnière sposo', description: 'Composizione coordinata al bouquet.', base_price: 15, unit: 'PEZZO' },
    { name: 'Coroncina damigelle', description: 'Coroncina di fiori freschi per damigelle/bambine.', base_price: 35, unit: 'PEZZO' },
  ],
  catering: [
    { name: 'Menu base 4 portate', description: 'Aperitivo + antipasto + primo + secondo + dolce + caffè. Bevande incluse.', base_price: 95, unit: 'PERSONA' },
    { name: 'Menu deluxe 5 portate', description: 'Aperitivo prolungato + 2 antipasti + 2 primi + secondo + dessert.', base_price: 140, unit: 'PERSONA' },
    { name: 'Aperitivo di benvenuto', description: 'Buffet aperitivo 1h: stuzzichini caldi e freddi, cocktail di benvenuto.', base_price: 35, unit: 'PERSONA' },
    { name: 'Open bar 4h', description: 'Bar professionale con barman, cocktail classici e signature.', base_price: 28, unit: 'PERSONA' },
    { name: 'Menu vegetariano/vegano', description: 'Stessa struttura del menu base, ricette vegetali.', base_price: 90, unit: 'PERSONA' },
    { name: 'Servizio personale aggiuntivo', description: 'Cameriere extra per evento (8 ore).', base_price: 180, unit: 'EVENTO' },
  ],
  pasticcere: [
    { name: 'Torta nuziale 3 piani', description: 'Torta a tema, decorazione zucchero o fiori freschi, fino a 80 porzioni.', base_price: 480, unit: 'PEZZO' },
    { name: 'Torta nuziale 5 piani', description: 'Torta scenografica, fino a 150 porzioni.', base_price: 850, unit: 'PEZZO' },
    { name: 'Confettata classica', description: 'Bordo confetti assortiti + cake topper, bomboniere incluse fino a 100 ospiti.', base_price: 280, unit: 'PEZZO' },
    { name: 'Sweet table tematica', description: 'Tavolo dolci scenografico: 8-10 tipologie mignon, cake pops, biscotti.', base_price: 12, unit: 'PERSONA' },
    { name: 'Mignon assortiti', description: 'Vassoio 60 pezzi di pasticceria mignon.', base_price: 90, unit: 'PEZZO' },
    { name: 'Wedding cake gluten free', description: 'Opzione senza glutine, certificata.', base_price: 580, unit: 'PEZZO' },
  ],
  musica: [
    { name: 'DJ set 5 ore', description: 'DJ professionale, attrezzatura audio + luci, playlist condivisa.', base_price: 1100, unit: 'EVENTO' },
    { name: 'DJ set 8 ore (open end)', description: 'Set esteso fino all\'alba.', base_price: 1500, unit: 'EVENTO' },
    { name: 'Band live cerimonia', description: 'Trio acustico per cerimonia, repertorio classico + moderno.', base_price: 800, unit: 'EVENTO' },
    { name: 'Band live ricevimento', description: 'Cover band 5 elementi, 2 set da 45 minuti.', base_price: 1900, unit: 'EVENTO' },
    { name: 'Archi aperitivo', description: 'Duo violino + violoncello per aperitivo, 1 ora.', base_price: 450, unit: 'EVENTO' },
    { name: 'Karaoke / animazione musicale', description: 'Animatore musicale con karaoke + giochi musicali.', base_price: 350, unit: 'EVENTO' },
  ],
  allestimenti: [
    { name: 'Pacchetto sedute Chiavarine + tavoli', description: 'Sedute eleganti + tavoli rotondi/imperiali fino a 100 ospiti. Setup + dismount.', base_price: 1200, unit: 'EVENTO' },
    { name: 'Tovagliato premium', description: 'Tovaglie in lino, runner, tovaglioli coordinati, mise en place porcellana.', base_price: 15, unit: 'PERSONA' },
    { name: 'Lighting design completo', description: 'Luci ambientali, faretti, candele LED, festoni, regia luci.', base_price: 1500, unit: 'EVENTO' },
    { name: 'Lounge area chill-out', description: 'Salotti in stile boho/classico per relax ospiti.', base_price: 800, unit: 'EVENTO' },
    { name: 'Photo corner branded', description: 'Sfondo personalizzato + props + lighting per ospiti.', base_price: 450, unit: 'EVENTO' },
    { name: 'Arco cerimonia', description: 'Arco floreale o ligneo strutturato per cerimonia.', base_price: 650, unit: 'PEZZO' },
  ],
  make_up: [
    { name: 'Beauty sposa prova + giorno-X', description: 'Make-up + acconciatura. Prova preliminare inclusa.', base_price: 350, unit: 'EVENTO' },
    { name: 'Beauty damigella/madrina', description: 'Make-up + acconciatura giorno-X per ospite.', base_price: 90, unit: 'PEZZO' },
    { name: 'Beauty mamma sposa/sposo', description: 'Make-up + acconciatura coordinati.', base_price: 110, unit: 'PEZZO' },
    { name: 'Ritocco pomeridiano', description: 'Re-style trucco e capelli pre-ricevimento.', base_price: 80, unit: 'EVENTO' },
    { name: 'Pacchetto bridal party (sposa + 4)', description: 'Sposa + 4 ospiti, tutti il giorno-X.', base_price: 600, unit: 'EVENTO' },
  ],
  abiti: [
    { name: 'Abito da sposa couture', description: 'Linea couture su misura, prove illimitate, accessori coordinati.', base_price: 3500, unit: 'PEZZO' },
    { name: 'Abito da sposa boutique', description: 'Selezione boutique multimarca, 2-3 prove sartoria inclusa.', base_price: 1800, unit: 'PEZZO' },
    { name: 'Abito sposo sartoriale', description: 'Su misura: giacca + pantaloni + gilet. Tessuto premium.', base_price: 1400, unit: 'PEZZO' },
    { name: 'Accessori sposa', description: 'Velo, scarpe, gioielli, jarretiera coordinati.', base_price: 350, unit: 'PEZZO' },
  ],
  location: [
    { name: 'Affitto sala + menu', description: 'Uso esclusivo della location + ristorazione interna, fino a 120 ospiti.', base_price: 130, unit: 'PERSONA' },
    { name: 'Uso esclusivo location (no catering)', description: 'Solo struttura + servizi base, catering esterno consentito.', base_price: 3500, unit: 'EVENTO' },
    { name: 'Pernottamento sposi suite', description: 'Suite nuziale notte del matrimonio + colazione.', base_price: 350, unit: 'PEZZO' },
    { name: 'Pacchetto destination weekend', description: 'Uso esclusivo + ristorazione 3 giorni (welcome + matrimonio + brunch).', base_price: 280, unit: 'PERSONA' },
  ],
  auto: [
    { name: 'Auto d\'epoca con autista', description: 'Auto vintage per ingresso sposa, autista in livrea, 4 ore.', base_price: 650, unit: 'EVENTO' },
    { name: 'Auto di lusso moderna', description: 'Mercedes/BMW Serie 7 con autista, 4 ore.', base_price: 480, unit: 'EVENTO' },
    { name: 'Auto sportiva fotografica', description: 'Auto cabrio per scatti foto post-cerimonia, 2 ore.', base_price: 380, unit: 'EVENTO' },
  ],
  animazione: [
    { name: 'Mago/illusionista aperitivo', description: 'Magia close-up tra gli ospiti durante aperitivo, 1.5 ore.', base_price: 450, unit: 'EVENTO' },
    { name: 'Bolle giganti', description: 'Animazione bolle giganti, ideale per bimbi e foto.', base_price: 280, unit: 'EVENTO' },
    { name: 'Baby parking + animatore', description: 'Area bambini con animatore dedicato, materiali, snack.', base_price: 380, unit: 'EVENTO' },
    { name: 'Fuochi d\'artificio cerimoniali', description: 'Spettacolo pirotecnico 5 min, autorizzazione inclusa.', base_price: 1200, unit: 'EVENTO' },
  ],
  celebrante: [
    { name: 'Rito civile/simbolico', description: 'Cerimonia civile o simbolica personalizzata, scrittura testi inclusa.', base_price: 600, unit: 'EVENTO' },
    { name: 'Rito multiculturale', description: 'Cerimonia mista tradizioni diverse, anche multilingue.', base_price: 800, unit: 'EVENTO' },
    { name: 'Consulenza scrittura voti', description: 'Sessione 1h per supportare gli sposi nei voti.', base_price: 120, unit: 'EVENTO' },
  ],
  wedding_planner: [
    { name: 'Full planning (12 mesi)', description: 'Pianificazione completa dall\'inizio alla fine, gestione fornitori, budget, scaletta.', base_price: 4500, unit: 'EVENTO' },
    { name: 'Day coordinator', description: 'Coordinamento solo del giorno-X, briefing fornitori, scaletta.', base_price: 1200, unit: 'EVENTO' },
    { name: 'Consulenza orientativa', description: '3 sessioni 1h per impostare il matrimonio in autonomia.', base_price: 350, unit: 'EVENTO' },
  ],
}

export function presetsFor(subrole: string | null | undefined): ServicePreset[] {
  if (!subrole) return []
  const key = subrole.toLowerCase().replace(/-/g, '_')
  return SERVICE_PRESETS[key] ?? []
}
