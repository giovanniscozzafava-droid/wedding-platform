import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/auth'

type FaqEntry = { q: string; a: string }
type FaqSection = { title: string; entries: FaqEntry[] }

const FAQ_GENERIC: FaqSection = {
  title: 'Generale',
  entries: [
    {
      q: 'Cosa è Planfully?',
      a: 'Planfully è la piattaforma SaaS che mette in collegamento wedding planner, location, fornitori e coppie di sposi. Gestisce in un solo posto preventivi, contratti firmati elettronicamente, calendario, invitati, mood board, playlist, scaletta, menu e pagamenti.',
    },
    {
      q: 'Quanto costa?',
      a: 'Durante la beta privata è gratuito. Per i wedding planner partner fondatori resterà gratuito. Per i fornitori sarà attivo un piano Pro da €29/mese a partire da ottobre 2026 (€0 fino ad allora). Le coppie non pagano mai.',
    },
    {
      q: 'Come funziona la firma elettronica?',
      a: 'Usiamo la Firma Elettronica Semplice (FES) ai sensi dell\'art. 20 del Codice dell\'Amministrazione Digitale (D.lgs. 82/2005). Quando firmi un preventivo o un contratto, registriamo: tuo nome, tipo e numero documento, indirizzo IP, dispositivo, data/ora e hash crittografico del documento. Tutto questo costituisce prova legale del consenso prestato.',
    },
    {
      q: 'I miei dati sono al sicuro?',
      a: 'Sì. Hosting su Supabase (server EU, conformi GDPR). I dati sono cifrati a riposo e in transito. Puoi richiedere in qualunque momento la cancellazione dei tuoi dati dal Profilo (art. 17 GDPR). I dati delle coppie sono visibili solo al wedding planner del matrimonio e ai fornitori coinvolti — mai cross-wedding.',
    },
    {
      q: 'Posso usare Planfully da mobile?',
      a: 'Sì, la piattaforma è ottimizzata per smartphone (iPhone e Android) e tablet. Per ora non c\'è un\'app nativa, ma la versione web è completa e installabile come PWA dal browser.',
    },
    {
      q: 'Come contatto il supporto?',
      a: 'Email: hello@planfully.it. Per emergenze contrattuali o tecniche durante un evento attivo, scrivi a support@planfully.it specificando il nome del matrimonio.',
    },
  ],
}

const FAQ_WP: FaqSection = {
  title: 'Wedding Planner / Location',
  entries: [
    {
      q: 'Come invito un fornitore nel mio network?',
      a: 'Vai su "Rete fornitori" → "Invita fornitore". Inserisci il suo indirizzo email: gli arriverà un link via email con cui può registrarsi a Planfully gratis e accettare la collaborazione. Dopo l\'accettazione potrai aggiungere i suoi servizi ai tuoi preventivi.',
    },
    {
      q: 'Come creo un preventivo?',
      a: 'Da "Preventivi" → "Nuovo preventivo". Inserisci titolo, dati cliente, data dell\'evento, location e numero di invitati. Aggiungi le voci scegliendo dal Catalogo (servizi tuoi o dei fornitori del network). Imposta il markup desiderato. Genera il PDF e invia al cliente con un click.',
    },
    {
      q: 'Come funziona il markup?',
      a: 'Per ogni voce vedi il costo (quanto paghi al fornitore) e il prezzo cliente (quanto il cliente paga te). La differenza è il tuo margine. Puoi impostare un markup globale (es. 20%) che si applica a tutte le voci, oppure overridarlo voce per voce. Il fornitore non vede mai il prezzo cliente, solo il proprio costo concordato.',
    },
    {
      q: 'Cosa è il modello GLOBAL vs BROKER?',
      a: 'GLOBAL = tu contratti l\'intero matrimonio col cliente e poi i singoli fornitori contrattano con te. BROKER = tu sei l\'organizzatrice, e la coppia firma direttamente con ogni fornitore (tu prendi una fee separata). Lo decidi all\'inizio del progetto e influenza chi firma cosa.',
    },
    {
      q: 'Cosa sono gli alert di disintermediazione?',
      a: 'Se un fornitore della tua rete crea un preventivo diretto con la stessa coppia che hai già nei tuoi preventivi (stessa email, nome o stessa data+location), il sistema te lo segnala in alto in tutte le pagine. Così sai subito se sta cercando di "saltarti".',
    },
    {
      q: 'Come converto un preventivo in contratto?',
      a: 'Quando il cliente firma il preventivo (stato ACCETTATO), nell\'editor del preventivo appare il bottone "Genera contratto". Cliccandolo si crea un contratto in BOZZA con 15 articoli legali pre-compilati (premesse, oggetto, corrispettivo rateizzato 30/40/30, recesso, forza maggiore, GDPR, diritti immagine, clausole vessatorie, foro competente). Puoi editare ogni articolo prima di inviarlo al cliente.',
    },
    {
      q: 'Posso modificare un preventivo già firmato?',
      a: 'Sì, ma con cautela. Su quel preventivo trovi il bottone "Modifica forzata". Devi specificare un motivo. Il cliente riceverà una mail con la modifica e il motivo, e dovrà ri-firmare la nuova revisione. La cronologia di firme resta intatta.',
    },
    {
      q: 'Come fanno i fornitori a vedere il calendario delle date occupate?',
      a: 'Ogni fornitore ha la pagina "Disponibilità" dove marca i giorni in cui è già impegnato. Quando aggiungi un fornitore a un preventivo, il sistema verifica automaticamente se è disponibile in quella data. Se ACCETTATO, la data si blocca automaticamente.',
    },
  ],
}

const FAQ_FORN: FaqSection = {
  title: 'Fornitore',
  entries: [
    {
      q: 'Come carico il mio catalogo?',
      a: 'Vai su "Catalogo" → "Nuovo servizio". Inserisci nome, prezzo, unità (a persona, a evento, all\'ora), descrizione. Puoi caricare fino a 10 foto per servizio. I wedding planner che ti hanno nel loro network potranno aggiungerli ai loro preventivi.',
    },
    {
      q: 'Posso fare preventivi direttamente con i miei clienti?',
      a: 'Sì. Vai su "Clienti", crea il cliente (anagrafica completa con data evento, location, budget). Poi clicca "Preventivo" per creare un preventivo standalone col TUO brand. Il cliente riceve mail e firma online. La data viene bloccata automaticamente sul tuo calendario quando il preventivo viene accettato.',
    },
    {
      q: 'Come funziona il calendario disponibilità?',
      a: 'Vai su "Disponibilità". Verde = libero. Click per cambiare a giallo (forse) → rosso (occupato) → libero. Quando un preventivo che ti coinvolge passa ad ACCETTATO o un contratto a FIRMATO, la data si blocca automaticamente in rosso con la motivazione.',
    },
    {
      q: 'Cosa succede se voglio sbloccare una data?',
      a: 'Su "Disponibilità" sotto il calendario c\'è la sezione "Prossime date bloccate". Per ogni data trovi il bottone "Sblocca" con una conferma differenziata: se viene da un contratto firmato ti avverte che lo sblocco NON annulla il contratto. Se viene da un preventivo accettato, ti chiede se la trattativa è effettivamente saltata.',
    },
    {
      q: 'Vedo i totali del matrimonio?',
      a: 'No, per riservatezza tu vedi solo le voci tue. Sul Calendario clicchi un evento e vedi: il tuo importo concordato, quanto hai già incassato e quanto deve ancora pagarti il wedding planner o la coppia.',
    },
    {
      q: 'Posso usare il mio brand sui preventivi diretti?',
      a: 'Sì. Vai su "Brand" e carica il tuo logo, scegli i colori primario e secondario. Quando generi un PDF preventivo direttamente per un tuo cliente, viene usato il tuo brand (non quello di Planfully). Vale anche per la versione gratuita.',
    },
    {
      q: 'Come funziona l\'invito di un wedding planner?',
      a: 'Riceverai un\'email con un link di invito. Cliccandolo arrivi su una pagina dove vedi chi ti sta invitando. Crei la password, completi il profilo (Tipo fornitore, città, telefono) e sei pronto. La collaborazione con quel wedding planner diventa ATTIVA e potrai apparire nei suoi preventivi.',
    },
    {
      q: 'Cosa è il tutorial onboarding?',
      a: 'Al primo accesso vedi delle card flottanti in basso a destra che ti guidano passo-passo: crea offerta, carica foto, imposta disponibilità, configura brand. Se le chiudi, le puoi riattivare da "Profilo" → "Tutorial di benvenuto" → "Riattiva tutorial".',
    },
  ],
}

const FAQ_COUPLE: FaqSection = {
  title: 'Sposi',
  entries: [
    {
      q: 'Come accedo alla mia dashboard sposi?',
      a: 'Il tuo/la tua wedding planner ti invia un link via email. Cliccandolo arrivi su una pagina dove crei la password e accedi alla dashboard del tuo matrimonio. Da qui vedi tutto: documenti, programma giornata, invitati, tavoli, mood board, playlist, menu, sito ospiti.',
    },
    {
      q: 'Posso modificare i tavoli, gli invitati o la scaletta?',
      a: 'I dati operativi (chi va con chi a tavola, scaletta giornata, allergie, ecc.) sono in sola lettura per gli sposi: gestisce il wedding planner. Però puoi SUGGERIRE modifiche col bottone "Suggerisci modifica" presente su ogni tab. Il/la tuo/a WP riceve la richiesta e la approva.',
    },
    {
      q: 'Come firmo il preventivo?',
      a: 'Quando il/la WP ti manda un preventivo, ricevi una mail. Cliccando il link arrivi su una pagina riservata dove vedi tutto (totale, voci, durata). Compili nome, tipo documento e numero, disegni la firma sul touchpad/tablet, accetti termini e privacy. Pronto: il preventivo è firmato legalmente.',
    },
    {
      q: 'Cosa è la firma elettronica semplice (FES)?',
      a: 'È un tipo di firma riconosciuto dalla legge italiana (CAD art. 20). Vale quanto una firma fisica per i contratti tra privati. Quando firmi, salviamo il tuo nome, documento, IP, ora e hash del PDF. Questi dati provano in tribunale chi ha firmato e cosa.',
    },
    {
      q: 'Posso scaricare il preventivo e il contratto in PDF?',
      a: 'Sì. Dopo aver firmato ricevi due PDF via email: il preventivo originale e l\'atto di accettazione (con i tuoi dati di firma). Stessa cosa per il contratto: dopo la firma ricevi il PDF controfirmato. Tutto è salvato anche nella tua dashboard sotto "Documenti".',
    },
    {
      q: 'Vedo i prezzi dei fornitori singoli?',
      a: 'Vedi il totale del preventivo e la lista voci. Non vedi quanto guadagna ogni fornitore o il wedding planner sul singolo elemento (questo per riservatezza commerciale tra professionisti).',
    },
    {
      q: 'Come funziona il sito per gli ospiti?',
      a: 'Sul tab "Sito ospiti" trovi un link tipo planfully.it/w/nome-sposi. Lo condividi nelle partecipazioni. Gli ospiti possono leggere data, location, dress code, programma e — soprattutto — confermare la presenza (RSVP) con allergie, accompagnatori, esigenze speciali. I dati arrivano automaticamente nella tua sezione "Invitati".',
    },
    {
      q: 'Posso aggiungere foto al mood board?',
      a: 'Sì. Sul tab "Mood board" puoi caricare immagini da PC o importarle da Pinterest/Instagram. Aiutano il/la wedding planner a capire il tuo stile e fanno da reference per fioraio, location, allestitore.',
    },
  ],
}

export default function FaqPage() {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')

  const sections: FaqSection[] = useMemo(() => {
    const role = profile?.role
    const out: FaqSection[] = [FAQ_GENERIC]
    if (role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'ADMIN') out.push(FAQ_WP)
    if (role === 'FORNITORE' || role === 'ADMIN') out.push(FAQ_FORN)
    if (role === 'COUPLE' || role === 'ADMIN') out.push(FAQ_COUPLE)
    // Anonymous/no role: mostra tutto
    if (!role) out.push(FAQ_WP, FAQ_FORN, FAQ_COUPLE)
    return out
  }, [profile?.role])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((s) => ({
        ...s,
        entries: s.entries.filter((e) =>
          e.q.toLowerCase().includes(q) || e.a.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.entries.length > 0)
  }, [sections, query])

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Aiuto"
          title="Domande frequenti"
          description="Le risposte alle domande più comuni, organizzate per ruolo. Cerca con la barra qui sotto."
        />

        <div className="relative mb-8 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
          <Input className="pl-9" placeholder="Cerca nelle FAQ…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="space-y-8">
          {filtered.map((sec) => (
            <section key={sec.title}>
              <h2 className="font-display text-2xl mb-3">{sec.title}</h2>
              <div className="space-y-2">
                {sec.entries.map((e, i) => <FaqItem key={`${sec.title}-${i}`} entry={e} />)}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <Card className="p-12 text-center">
              <HelpCircle size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                Nessuna risposta trovata. Scrivici a <a href="mailto:hello@planfully.it" className="underline">hello@planfully.it</a>.
              </p>
            </Card>
          )}
        </div>

        <Card className="p-5 mt-10 text-sm" style={{ background: 'rgb(var(--bg-sunken))' }}>
          <p>
            Non trovi la tua domanda? Scrivici a{' '}
            <a href="mailto:hello@planfully.it" className="font-medium underline">hello@planfully.it</a>.
            Per emergenze durante un evento attivo: <a href="mailto:support@planfully.it" className="font-medium underline">support@planfully.it</a>.
          </p>
        </Card>
      </div>
    </div>
  )
}

function FaqItem({ entry }: { entry: FaqEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-[rgb(var(--bg-sunken))]"
      >
        <span className="font-medium text-sm">{entry.q}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-4 text-sm leading-relaxed text-[rgb(var(--fg-muted))] whitespace-pre-line">{entry.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
