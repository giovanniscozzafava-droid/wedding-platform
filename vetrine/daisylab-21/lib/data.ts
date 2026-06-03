export type Service = {
  id: string
  name: string
  category: string
  description: string
  basePrice: number
  unit: 'PEZZO' | 'EVENTO'
  photo: string
}

export const brand = {
  name: 'DaisyLab_21',
  owner: 'Elisabetta Citraro',
  tagline: 'Stampe · Inviti · Tableau',
  bio: 'Realizzo coordinati grafici per matrimoni ed eventi di ogni genere, tutto interamente fatto a mano per impreziosire in modo originale il tuo grande giorno.',
  city: 'Borgia (CZ)',
  yearsActive: 2,
  serviceRadiusKm: 1500,
  logo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/brand-assets/1d5b5670-1e36-43a5-9219-d680f01ad889/logo.png',
  links: {
    website: 'https://www.daisylab21.it',
    instagram: 'https://instagram.com/daisylab_21',
    instagramHandle: '@daisylab_21',
    planfully: 'https://planfully.it/p/fornitore/elisabetta-citraro',
  },
  capostipite: {
    name: 'Rosella Elia',
    role: 'Wedding Planner',
    city: 'Catanzaro',
  },
} as const

export const services: Service[] = [
  { id: '89b33ef7-c7b5-4e55-9080-378513469228', name: 'Wellcome in legno', category: 'Tableau de mariage', description: 'Composizione tableau de mariage costruita su misura, in legno, con grafica personalizzata e dettagli a mano.', basePrice: 140, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/89b33ef7-c7b5-4e55-9080-378513469228/7ecaf071-020f-44ba-9d4c-d94ef8e4548b.webp' },
  { id: '35942579-f295-4bf1-9fdd-951b68e312bd', name: 'Wedding Bag', category: 'Cartoleria evento', description: 'Bag per rito civile o religioso con gadget personalizzati per gli invitati. Comprende: libretto messa/promesse, lacrime di gioia, sacchetto riso, caramelle/tic tac, ventaglio.', basePrice: 10, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/35942579-f295-4bf1-9fdd-951b68e312bd/65df93b4-36f9-42f7-b9f4-6722364ea870.webp' },
  { id: 'f277da5b-0192-42f9-b3a0-7464fa6bba00', name: 'Lacrime di gioia', category: 'Cartoleria evento', description: 'Fazzolettino per lacrime di gioia. Gadget delicato per gli invitati in chiesa.', basePrice: 1.2, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/f277da5b-0192-42f9-b3a0-7464fa6bba00/a85a6126-238d-4676-b6e7-1b68b6ad9ceb.webp' },
  { id: 'a5cb9f05-00d7-4868-9775-872973b7f410', name: 'Porta confetti', category: 'Cartoleria evento', description: 'Scatolina con grafica personalizzata, porta confetti. Bomboniera piccolo evento (confetti compresi).', basePrice: 2.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/a5cb9f05-00d7-4868-9775-872973b7f410/36c75b00-b64c-4e75-9951-a5cacefda7c9.webp' },
  { id: '993d138b-15d0-4a97-917a-bde0010ca4bf', name: 'Scatolina riso', category: 'Cartoleria evento', description: 'Scatolina riso con grafica personalizzata, compresa di riso anti macchia.', basePrice: 2.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/993d138b-15d0-4a97-917a-bde0010ca4bf/4843123d-fcd0-41e8-880b-8a4ee01b9df7.webp' },
  { id: '16e4b131-65b5-4fc7-893e-d71496ff657e', name: 'Dipinto acquerello', category: 'Arte su misura', description: 'Dipinto in tecnica acquerello su carta martellata 300 gr, montato su cavalletto, a tema evento.', basePrice: 200, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/16e4b131-65b5-4fc7-893e-d71496ff657e/4074ef51-537f-4728-a5be-edb3e1c80c39.webp' },
  { id: '467a5247-0c67-48fd-8b42-ab58fa7bc469', name: 'Grafica acquerello', category: 'Arte su misura', description: 'Disegno in tecnica acquerello da usare su partecipazioni, tableau, libretto messa o come ricordo per gli sposi.', basePrice: 120, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/467a5247-0c67-48fd-8b42-ab58fa7bc469/9c0e449c-df1b-4640-a90e-9e4629313356.webp' },
  { id: '5ed3eb2a-9efb-48c1-8739-057299d021dd', name: 'Wedding suite carta stampa digitale', category: 'Cartoleria evento', description: 'Wedding suite completa stampa digitale: invito principale + RSVP card + busta. Per famiglia/ospite. Set 80 ospiti.', basePrice: 6.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/5ed3eb2a-9efb-48c1-8739-057299d021dd/9124dcb4-2cfc-419d-967e-0f8607794bae.webp' },
  { id: '4e8002fe-f2b7-4324-b1b5-676168e7ff98', name: 'Sito web wedding personalizzato', category: 'Digitale', description: 'Sito web matrimonio personalizzato: programma, RSVP digitale, location, hotel consigliati, registry. Online 6 mesi pre-evento.', basePrice: 350, unit: 'EVENTO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/4e8002fe-f2b7-4324-b1b5-676168e7ff98/04cdf40c-3d5e-47f3-91e2-4428eae7d3ee.webp' },
  { id: '05cad150-9c94-4df4-b3b7-adffdf06e550', name: 'Calligrafia manuale buste/menu', category: 'Calligrafia', description: 'Servizio calligrafia manuale: indirizzi su buste, nomi su segnaposti, menu personalizzati a mano. Prezzo per pezzo.', basePrice: 2.2, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/05cad150-9c94-4df4-b3b7-adffdf06e550/4a39ad45-4849-4f91-9b0c-a29e0ceb8bfd.webp' },
  { id: '8016150b-d7e6-4345-aa97-155eac1af7c7', name: 'Libretto cerimonia (8-12 pagine)', category: 'Cartoleria evento', description: 'Libretto cerimonia stampato: programma rito, brani, letture, ringraziamenti. Formato 14x21, stampa offset.', basePrice: 4.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/8016150b-d7e6-4345-aa97-155eac1af7c7/ec5948b6-9aa7-4b67-95ca-a602690d9e76.webp' },
  { id: '8d11080e-1d64-4ef1-b405-dc473937f395', name: 'Segnaposto + tableau de mariage', category: 'Tableau de mariage', description: 'Segnaposti calligrafici per ogni ospite + tableau de mariage di design. Soluzione coordinata grafica.', basePrice: 4, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/8d11080e-1d64-4ef1-b405-dc473937f395/1e3a8ea6-df46-4c53-a3a6-20604f9be114.webp' },
  { id: '8499a6e9-7c46-49ff-bf06-732fd0afce6d', name: 'Menu personalizzato (carta + stampa)', category: 'Cartoleria evento', description: 'Menu personalizzato sposi, stampa pregiata, formato A5 o lungo (5x21). Da disporre sul tavolo per ogni ospite.', basePrice: 2.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/8499a6e9-7c46-49ff-bf06-732fd0afce6d/0858bb59-2407-4663-993f-da06093a1509.webp' },
  { id: 'eee3b874-70da-4da8-bb8f-4b411cf700df', name: 'Save the Date (digitale o cartaceo)', category: 'Cartoleria evento', description: 'Save the Date in versione digitale (PDF interattivo, animazione email) o cartacea minimale. Inviato 6-12 mesi pre-evento.', basePrice: 3.5, unit: 'PEZZO', photo: 'https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/eee3b874-70da-4da8-bb8f-4b411cf700df/d6525e52-8e9e-41fd-b27d-d34b690b3f82.webp' },
]

export const categories = Array.from(new Set(services.map((s) => s.category)))
