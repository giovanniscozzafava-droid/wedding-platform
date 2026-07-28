// Traduttore di errori: trasforma i messaggi tecnici (Postgres/PostgREST, Storage, auth, rete…)
// in un messaggio CHIARO in italiano + "cosa fare". Serve al fornitore beta per segnalare in modo
// comprensibile cosa non funziona, senza gergo. Le stringhe GIÀ amichevoli passano invariate.

export type HumanError = { message: string; hint?: string; technical: string }

function rawText(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input
  const e = input as any
  // errori supabase/postgrest: {message, details, hint, code}; Error: {message}
  return String(e?.message ?? e?.error_description ?? e?.error ?? e?.details ?? input)
}

// Regole: [test sul testo tecnico] → messaggio chiaro + cosa fare.
const RULES: { re: RegExp; message: string; hint: string }[] = [
  // PostgREST: funzione/tabella/colonna non trovata (server non allineato)
  { re: /could not find the function|schema cache|pgrst202|function .* does not exist/i,
    message: 'Questa funzione non è ancora disponibile sul server.',
    hint: 'Segnalalo così com’è: c’è un aggiornamento da rilasciare. Nel frattempo riprova più tardi.' },
  { re: /could not find the .* column|column .* does not exist|pgrst204/i,
    message: 'Un campo richiesto non esiste ancora sul server.',
    hint: 'Segnala cosa stavi salvando: manca un aggiornamento del database.' },
  // Permessi / RLS
  { re: /permission denied|row-level security|violates row-level security|not authorized|rls|42501/i,
    message: 'Non hai i permessi per fare questa azione.',
    hint: 'Se pensi di doverla poter fare, segnala il tuo ruolo e cosa stavi facendo.' },
  // Sessione / auth
  { re: /missing authorization header|jwt expired|jwt.*invalid|invalid token|not authenticated|auth session missing|401/i,
    message: 'La tua sessione è scaduta.',
    hint: 'Esci e rientra, poi riprova.' },
  // File troppo grande
  { re: /payload too large|exceeded the maximum allowed size|413|file too large/i,
    message: 'Il file è troppo grande.',
    hint: 'Carica un’immagine più leggera. (Le foto ora vengono ridotte in automatico: se rivedi questo errore, segnalalo.)' },
  { re: /mime type .* is not supported|invalid_mime_type|not an allowed/i,
    message: 'Questo tipo di file non è supportato.',
    hint: 'Usa JPG, PNG o PDF.' },
  // Duplicati / vincoli
  { re: /duplicate key|already exists|unique constraint|23505/i,
    message: 'Esiste già un elemento uguale.',
    hint: 'Modifica il valore oppure apri quello che c’è già.' },
  { re: /null value in column|violates not-null|23502/i,
    message: 'Manca un campo obbligatorio.',
    hint: 'Controlla di aver compilato tutti i campi richiesti.' },
  { re: /foreign key|violates foreign key|23503/i,
    message: 'Un collegamento non è valido.',
    hint: 'Ricarica la pagina e riprova; se persiste, segnala cosa stavi collegando.' },
  { re: /value too long|22001/i,
    message: 'Hai inserito un testo troppo lungo.',
    hint: 'Accorcia il testo e riprova.' },
  // Rete
  { re: /failed to fetch|networkerror|network request failed|load failed|err_internet|offline/i,
    message: 'Connessione assente o instabile.',
    hint: 'Controlla la rete e riprova.' },
  { re: /timeout|timed out|504|gateway time|statement timeout|57014/i,
    message: 'Il server ci ha messo troppo a rispondere.',
    hint: 'Riprova tra poco; se persiste, segnalalo.' },
  { re: /chunkloaderror|failed to (import|load|fetch) dynamically imported|loading chunk/i,
    message: 'L’app è stata aggiornata.',
    hint: 'Ricarica la pagina per prendere l’ultima versione.' },
  { re: /rate limit|too many requests|429/i,
    message: 'Troppe richieste in poco tempo.',
    hint: 'Aspetta qualche secondo e riprova.' },
  // Errore server generico
  { re: /internal server error|500|edge function returned a non-2xx|non-2xx status/i,
    message: 'Il server ha avuto un problema.',
    hint: 'Riprova; se persiste, segnala cosa stavi facendo.' },
]

// Un testo è "già amichevole" se sembra una frase per umani (no gergo tecnico evidente).
function looksTechnical(t: string): boolean {
  return /\b(pgrst|rpc|jwt|rls|null value|violates|schema cache|constraint|statuscode|http|fetch|undefined|null\)|function public\.|\bsql\b|postgres|supabase|stack|typeerror|referenceerror)\b/i.test(t)
    || /[{}<>]|::|_[a-z]+\(|0x[0-9a-f]+/i.test(t)
}

// Versione in una riga (messaggio + cosa fare) per i display inline (setErr, banner…).
export function humanErrorLine(input: unknown): string {
  const h = humanizeError(input)
  return h.hint ? `${h.message} ${h.hint}` : h.message
}

export function humanizeError(input: unknown): HumanError {
  const technical = rawText(input).trim()
  for (const r of RULES) {
    if (r.re.test(technical)) return { message: r.message, hint: r.hint, technical }
  }
  // Nessuna regola: se è già una frase chiara la lascio, altrimenti messaggio generico.
  if (technical && !looksTechnical(technical) && technical.length <= 160) {
    return { message: technical, technical }
  }
  return {
    message: 'Qualcosa non ha funzionato.',
    hint: 'Riprova. Se succede di nuovo, segnala cosa stavi facendo (e in quale pagina): lo sistemiamo.',
    technical,
  }
}
