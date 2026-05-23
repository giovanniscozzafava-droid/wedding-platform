import { faker } from '@faker-js/faker/locale/it'

export type Role = 'WP' | 'LOC' | 'FORN' | 'COUPLE'

export type Persona = {
  role: Role
  firstName: string
  lastName: string
  fullName: string
  email: string
  password: string
  phone: string
  city: string
  zip: string
  address: string
  businessName?: string
  vatNumber?: string
  fiscalCode?: string
  website?: string
  instagram?: string
  bio?: string
  yearsActive?: number
  serviceRadiusKm?: number
  subrole?: string
  // Couple-specific
  partnerName?: string
  weddingStyle?: string[]
  budgetMin?: number
  budgetMax?: number
  guestsEstimate?: number
}

const FORNITORE_SUBROLES = [
  'fotografo', 'videomaker', 'fioraio', 'catering', 'pasticcere',
  'musica', 'allestimenti', 'auto', 'animazione', 'make_up', 'abiti',
]
const STYLES = [
  'CLASSICO', 'MODERNO', 'BOHO', 'RUSTICO', 'GLAMOUR', 'MINIMAL',
  'VINTAGE', 'BEACH', 'MOUNTAIN', 'GARDEN',
]

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

function randomEmail(firstName: string, lastName: string): string {
  // Email garantita unica grazie a timestamp + suffisso random; solo [a-z0-9]
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 6)
  return `${slug(firstName)}.${slug(lastName)}.${ts}.${rnd}@planfully-agent.test`
}

function randomItalianVat(): string {
  // 11 cifre numeriche
  return faker.string.numeric(11)
}

function randomItalianFiscalCode(firstName: string, lastName: string): string {
  // Approssimazione (non valida ma formato giusto): 6 lettere + 2 cifre + 1 lettera + 2 cifre + 1 lettera + 3 cifre + 1 lettera = 16
  const ln = lastName.toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3)
  const fn = firstName.toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3)
  const yy = faker.string.numeric(2)
  const mm = faker.helpers.arrayElement(['A','B','C','D','E','H','L','M','P','R','S','T'])
  const dd = faker.string.numeric(2)
  const place = faker.string.alpha({ length: 1, casing: 'upper' }) + faker.string.numeric(3)
  const cd = faker.string.alpha({ length: 1, casing: 'upper' })
  return `${ln}${fn}${yy}${mm}${dd}${place}${cd}`
}

export function makePersona(role: Role): Persona {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const fullName = `${firstName} ${lastName}`
  const email = randomEmail(firstName, lastName)
  const phone = faker.phone.number({ style: 'international' })
  const city = faker.location.city()
  const zip = faker.location.zipCode()
  const address = `${faker.location.street()}, ${faker.number.int({ min: 1, max: 200 })}`

  const base: Persona = {
    role, firstName, lastName, fullName, email, password: 'Agent2026!',
    phone, city, zip, address,
  }

  if (role === 'WP' || role === 'LOC' || role === 'FORN') {
    const subrole = role === 'WP' ? 'wedding_planner'
      : role === 'LOC' ? 'location'
      : faker.helpers.arrayElement(FORNITORE_SUBROLES)
    return {
      ...base,
      businessName: role === 'WP'
        ? `${firstName} ${lastName} Wedding Studio`
        : role === 'LOC'
        ? `Villa ${faker.location.city()}`
        : `${faker.company.name()}`,
      vatNumber: randomItalianVat(),
      fiscalCode: randomItalianFiscalCode(firstName, lastName),
      website: `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.it`,
      instagram: `@${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      bio: faker.lorem.paragraph(2),
      yearsActive: faker.number.int({ min: 1, max: 25 }),
      serviceRadiusKm: faker.number.int({ min: 50, max: 500 }),
      subrole,
    }
  }

  // COUPLE
  const partnerName = faker.person.firstName()
  return {
    ...base,
    partnerName,
    weddingStyle: faker.helpers.arrayElements(STYLES, { min: 2, max: 4 }),
    budgetMin: faker.number.int({ min: 15000, max: 30000 }),
    budgetMax: faker.number.int({ min: 35000, max: 80000 }),
    guestsEstimate: faker.number.int({ min: 50, max: 250 }),
  }
}
