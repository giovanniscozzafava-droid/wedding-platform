// "Borsa di partenza": un listino acquisto pre-compilato con costi all'ingrosso
// INDICATIVI (da aggiornare col proprio fornitore). Serve a partire subito col
// food-cost senza scrivere tutto da zero.

export type BorsaSeed = { name: string; unit: string; unit_cost: number; category?: string }

const FIORAIO: BorsaSeed[] = [
  { name: 'Rosa rossa', unit: 'gambo', unit_cost: 1.2, category: 'Fiori' },
  { name: 'Rosa David Austin', unit: 'gambo', unit_cost: 4.5, category: 'Fiori' },
  { name: 'Rosa garden', unit: 'gambo', unit_cost: 3.5, category: 'Fiori' },
  { name: 'Peonia', unit: 'gambo', unit_cost: 7.5, category: 'Fiori' },
  { name: 'Ranuncolo', unit: 'gambo', unit_cost: 1.8, category: 'Fiori' },
  { name: 'Ortensia', unit: 'gambo', unit_cost: 5.0, category: 'Fiori' },
  { name: 'Lisianthus', unit: 'gambo', unit_cost: 2.2, category: 'Fiori' },
  { name: 'Gypsophila (nebbiolina)', unit: 'mazzo', unit_cost: 4.0, category: 'Fiori' },
  { name: 'Garofano', unit: 'gambo', unit_cost: 0.9, category: 'Fiori' },
  { name: 'Tulipano', unit: 'gambo', unit_cost: 1.3, category: 'Fiori' },
  { name: 'Eucalipto', unit: 'gambo', unit_cost: 1.5, category: 'Verde' },
  { name: 'Ruscus', unit: 'gambo', unit_cost: 1.2, category: 'Verde' },
  { name: 'Felce / verde misto', unit: 'mazzo', unit_cost: 3.0, category: 'Verde' },
  { name: 'Spugna oasis', unit: 'pz', unit_cost: 1.5, category: 'Materiali' },
  { name: 'Vaso vetro cilindrico', unit: 'pz', unit_cost: 6.0, category: 'Contenitori' },
  { name: 'Vaso ceramica', unit: 'pz', unit_cost: 9.0, category: 'Contenitori' },
  { name: 'Nastro di seta', unit: 'm', unit_cost: 1.8, category: 'Materiali' },
  { name: 'Carta / confezione bouquet', unit: 'pz', unit_cost: 2.5, category: 'Materiali' },
  { name: 'Filo / spillo floreale', unit: 'pz', unit_cost: 0.3, category: 'Materiali' },
]

const PASTICCERE: BorsaSeed[] = [
  { name: 'Farina 00', unit: 'kg', unit_cost: 1.2, category: 'Base' },
  { name: 'Burro', unit: 'kg', unit_cost: 8.5, category: 'Base' },
  { name: 'Uova', unit: 'pz', unit_cost: 0.25, category: 'Base' },
  { name: 'Zucchero', unit: 'kg', unit_cost: 1.0, category: 'Base' },
  { name: 'Panna fresca', unit: 'l', unit_cost: 3.5, category: 'Base' },
  { name: 'Cioccolato copertura', unit: 'kg', unit_cost: 9.0, category: 'Base' },
  { name: 'Pasta di zucchero', unit: 'kg', unit_cost: 6.0, category: 'Decoro' },
  { name: 'Frutta fresca', unit: 'kg', unit_cost: 4.0, category: 'Decoro' },
  { name: 'Cake board / vassoio', unit: 'pz', unit_cost: 3.0, category: 'Materiali' },
]

const ALLESTIMENTI: BorsaSeed[] = [
  { name: 'Sedia chiavarina (noleggio)', unit: 'pz', unit_cost: 3.0, category: 'Sedute' },
  { name: 'Tavolo rotondo (noleggio)', unit: 'pz', unit_cost: 25.0, category: 'Tavoli' },
  { name: 'Tovaglia lino', unit: 'pz', unit_cost: 12.0, category: 'Tessili' },
  { name: 'Runner', unit: 'pz', unit_cost: 6.0, category: 'Tessili' },
  { name: 'Charger plate', unit: 'pz', unit_cost: 1.5, category: 'Mise en place' },
  { name: 'Catena luminosa 10m', unit: 'pz', unit_cost: 18.0, category: 'Luci' },
]

const BY_SUBROLE: Record<string, BorsaSeed[]> = {
  fioraio: FIORAIO,
  pasticcere: PASTICCERE, sweet_table: PASTICCERE,
  allestimenti: ALLESTIMENTI, fioraio_allestimenti: ALLESTIMENTI,
}

export function borsaStarter(subrole?: string | null): BorsaSeed[] {
  return BY_SUBROLE[(subrole ?? '').toLowerCase().trim()] ?? []
}
