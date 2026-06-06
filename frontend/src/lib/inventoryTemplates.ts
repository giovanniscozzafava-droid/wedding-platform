// Starter pack del magazzino per tipo di fornitore: una base di attrezzatura
// "da non dimenticare", che il fornitore poi estende col proprio magazzino reale.

export type InventorySeed = { name: string; category?: string; qty_default?: number }

const BAND: InventorySeed[] = [
  { name: 'Mixer audio', category: 'Audio', qty_default: 1 },
  { name: 'Casse / monitor da palco', category: 'Audio', qty_default: 4 },
  { name: 'Microfoni voce', category: 'Audio', qty_default: 4 },
  { name: 'Aste microfoniche', category: 'Audio', qty_default: 4 },
  { name: 'Cavi XLR', category: 'Audio', qty_default: 12 },
  { name: 'Multipresa / ciabatte', category: 'Audio', qty_default: 4 },
  { name: 'Violino', category: 'Strumenti' },
  { name: 'Batteria completa', category: 'Strumenti' },
  { name: 'Tastiera', category: 'Strumenti' },
  { name: 'Chitarra + ampli', category: 'Strumenti' },
  { name: 'Basso + ampli', category: 'Strumenti' },
  { name: 'Luci da palco', category: 'Luci', qty_default: 6 },
  { name: 'Controller luci', category: 'Luci', qty_default: 1 },
  { name: 'Prolunghe elettriche', category: 'Trasporto', qty_default: 4 },
]

const FOTO: InventorySeed[] = [
  { name: 'Corpo macchina principale', category: 'Corpi', qty_default: 2 },
  { name: 'Corpo macchina backup', category: 'Corpi', qty_default: 1 },
  { name: 'Obiettivo 24-70mm', category: 'Ottiche' },
  { name: 'Obiettivo 70-200mm', category: 'Ottiche' },
  { name: 'Obiettivo 35mm / 50mm', category: 'Ottiche' },
  { name: 'Schede di memoria', category: 'Storage', qty_default: 6 },
  { name: 'Batterie cariche', category: 'Energia', qty_default: 6 },
  { name: 'Caricabatterie', category: 'Energia', qty_default: 2 },
  { name: 'Flash / illuminatori', category: 'Luci', qty_default: 2 },
  { name: 'Drone + batterie', category: 'Aerea', qty_default: 1 },
  { name: 'Cavi USB-C', category: 'Accessori', qty_default: 3 },
  { name: 'Computer + lettore schede', category: 'Backup', qty_default: 1 },
  { name: 'Hard disk backup', category: 'Backup', qty_default: 2 },
  { name: 'Treppiede / monopiede', category: 'Supporti', qty_default: 1 },
]

const LOCATION_DINING: InventorySeed[] = [
  { name: 'Mise en place completa (piatti/posate/bicchieri)', category: 'Sala' },
  { name: 'Tovagliato', category: 'Sala' },
  { name: 'Centrotavola / candele', category: 'Sala' },
  { name: 'Attrezzatura cucina mobile', category: 'Cucina' },
  { name: 'Carrelli di servizio', category: 'Sala', qty_default: 4 },
  { name: 'Frigoriferi / abbattitore', category: 'Cucina' },
  { name: 'Bar attrezzato', category: 'Bar' },
  { name: 'Estintori e kit sicurezza', category: 'Sicurezza', qty_default: 2 },
]

const LOCATION_VENUE: InventorySeed[] = [
  { name: 'Sedie e tavoli', category: 'Arredo' },
  { name: 'Gazebo / coperture', category: 'Arredo' },
  { name: 'Impianto luci ambiente', category: 'Luci' },
  { name: 'Generatore di corrente', category: 'Energia', qty_default: 1 },
  { name: 'Prolunghe e quadri elettrici', category: 'Energia' },
  { name: 'Riscaldatori / ventilatori', category: 'Comfort' },
  { name: 'Segnaletica e parcheggio', category: 'Accoglienza' },
]

const FUOCHI: InventorySeed[] = [
  { name: 'Fuochi / batterie pirotecniche', category: 'Materiale' },
  { name: 'Centralina di sparo', category: 'Comando' },
  { name: 'Cavi di linea', category: 'Comando' },
  { name: 'Rampe e supporti', category: 'Postazione' },
  { name: 'Estintori', category: 'Sicurezza', qty_default: 4 },
  { name: 'DPI (caschi, guanti, occhiali)', category: 'Sicurezza' },
  { name: 'Documenti permessi e licenze', category: 'Documenti' },
]

const FIORI: InventorySeed[] = [
  { name: 'Bouquet sposa', category: 'Composizioni' },
  { name: 'Centrotavola', category: 'Composizioni' },
  { name: 'Addobbi cerimonia', category: 'Composizioni' },
  { name: 'Vasi e supporti', category: 'Materiale' },
  { name: 'Spugne / oasis e forbici', category: 'Materiale' },
  { name: 'Furgone refrigerato', category: 'Trasporto' },
]

const DEFAULT: InventorySeed[] = [
  { name: 'Attrezzatura principale', category: 'Generale' },
  { name: 'Materiale di consumo', category: 'Generale' },
  { name: 'Cavi e adattatori', category: 'Accessori' },
  { name: 'Kit di emergenza', category: 'Sicurezza' },
]

const BY_SUBROLE: Record<string, InventorySeed[]> = {
  musica: BAND, dj: BAND, band: BAND,
  fotografo: FOTO, videomaker: FOTO,
  catering: LOCATION_DINING, chef: LOCATION_DINING, food_truck: LOCATION_DINING,
  pasticcere: LOCATION_DINING, bartender: LOCATION_DINING, sommelier: LOCATION_DINING,
  fuochi: FUOCHI, pirotecnica: FUOCHI, effetti: FUOCHI,
  fioraio: FIORI, allestimenti: FIORI,
}

export function inventoryStarterPack(opts: { role?: string | null; subrole?: string | null; offersFullDining?: boolean | null }): InventorySeed[] {
  const role = (opts.role ?? '').toUpperCase()
  if (role === 'LOCATION') return opts.offersFullDining ? LOCATION_DINING : LOCATION_VENUE
  const sr = (opts.subrole ?? '').toLowerCase().trim()
  return BY_SUBROLE[sr] ?? DEFAULT
}
