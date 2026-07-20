// Icone del brand "filiera" dal set assets/svg/icone (NON lucide). Tratto 1.5, 24x24,
// inchiostro #181F1B su fondi chiari, variante `light` (carta #F4F3EE) su fondi scuri.
// Uso: <Icona nome="filiera" size={20} />. L'elenco `nomi` è la fonte di verità del set:
// se serve un'icona non presente, va aggiunta al set — non inventata né presa da lucide.
export type NomeIcona =
  | 'aggiungi-utente' | 'allegato' | 'altro' | 'andamento' | 'annulla' | 'appunti' | 'archivio'
  | 'attenzione' | 'avvia' | 'bilancio' | 'bozza' | 'calendario-condiviso' | 'calendario-piu'
  | 'calendario' | 'calice' | 'carica' | 'cartella' | 'casa' | 'catalogo' | 'cerca' | 'chat'
  | 'chevron-destra' | 'chevron-giu' | 'chevron-sinistra' | 'chevron-su' | 'chiave' | 'chiudi'
  | 'collegamento' | 'commento' | 'comprimi' | 'condividi' | 'conferma' | 'contratto' | 'cornetta'
  | 'cronologia' | 'cruscotto' | 'data-bloccata' | 'data-evento' | 'documento-firmato' | 'duplica'
  | 'durata' | 'elimina' | 'entra' | 'esci' | 'espandi' | 'esterno' | 'euro-cerchio' | 'euro'
  | 'fattura' | 'filiera' | 'filtri' | 'firma' | 'fissato' | 'flusso' | 'fotografia' | 'freccia-destra'
  | 'freccia-diagonale' | 'freccia-giu' | 'freccia-sinistra' | 'freccia-su' | 'furgone' | 'grafico-barre'
  | 'grafico-torta' | 'informazione' | 'invia' | 'inviato' | 'invito' | 'lista-attivita' | 'lista'
  | 'luna' | 'luogo' | 'mappa' | 'margine' | 'meno' | 'menu' | 'modifica' | 'mondo' | 'musica'
  | 'nascosto' | 'notifica-off' | 'notifica' | 'obiettivo' | 'orario' | 'ordina' | 'pagamento' | 'pausa'
  | 'penna' | 'percorso' | 'piu' | 'posate' | 'posizione' | 'posta' | 'preventivo' | 'prezzo' | 'prodotto'
  | 'regolazioni' | 'rifiutato' | 'rimuovi-utente' | 'ripeti' | 'sbloccato' | 'scadenza' | 'scarica'
  | 'scudo' | 'sede' | 'segnalibro' | 'sole' | 'stampa' | 'stato-attesa' | 'stato-errore' | 'stato-successo'
  | 'tabella' | 'tavolo-rotondo' | 'telefono' | 'timeline' | 'trascina' | 'trasferimento' | 'utente'
  | 'utenti' | 'videocamera' | 'visibile' | 'zoom-meno' | 'zoom-piu'

export function Icona({ nome, size = 24, light = false, className, style }: {
  nome: NomeIcona
  size?: number
  light?: boolean   // true su fondi scuri (variante carta)
  className?: string
  style?: React.CSSProperties
}) {
  const dir = light ? 'icone-light' : 'icone'
  return (
    <img src={`/assets/svg/${dir}/${nome}.svg`} width={size} height={size} alt="" aria-hidden="true"
      className={className} style={style} />
  )
}
