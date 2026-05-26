// Questionari dedicati al CLIENTE per ogni subrole fornitore in flusso diretto.
// Usati su /p/accept/:token quando quote.direct_client_id è non-null e l'owner
// ha role=FORNITORE: invece di chiedere budget complessivo e diete (che sono
// roba da WP/Location), chiediamo cose pertinenti al servizio del fornitore.
//
// Tutti i questionari includono almeno un campo "ispirazione" (Pinterest/IG)
// + note libere per cliente.

import type { QuestionnaireSection } from './eventQuestions'

const INSPIRATION_SECTION: QuestionnaireSection = {
  title: 'Ispirazione e riferimenti',
  questions: [
    { key: 'pinterest_url', label: 'Link board Pinterest (se ne hai una)', type: 'text', placeholder: 'https://pinterest.com/...', help: 'Aiuta tantissimo a capire il tuo stile.' },
    { key: 'instagram_refs', label: 'Profili o post Instagram di riferimento', type: 'tags', placeholder: 'separa con virgole: @profilo1, @profilo2' },
    { key: 'mood_words', label: 'Tre parole che descrivono lo stile che vuoi', type: 'tags', placeholder: 'es. elegante, naturale, romantico' },
    { key: 'free_inspiration', label: 'Altre note di ispirazione', type: 'textarea', placeholder: 'Tutto quello che ti viene in mente, anche immagini descritte.' },
  ],
}

// ---------------------------------------------------------------------------
// FOTOGRAFO
// ---------------------------------------------------------------------------
const Q_FOTOGRAFO: QuestionnaireSection[] = [
  {
    title: 'Stile fotografico',
    questions: [
      { key: 'style_preference', label: 'Stile che ti rappresenta di più', type: 'select',
        options: ['reportage_naturale', 'fine_art_luminoso', 'editoriale_moda', 'classico_posato', 'vintage_pellicola', 'dark_moody', 'mix_reportage_e_posato'] },
      { key: 'posing_comfort', label: 'Quanto sei a tuo agio davanti alla fotocamera', type: 'select',
        options: ['per_niente', 'poco', 'abbastanza', 'molto'] },
      { key: 'b_w_preference', label: 'Foto in bianco e nero — quante ne vuoi nella consegna', type: 'select',
        options: ['solo_colore', 'solo_alcune', 'circa_meta', 'molte_bn'] },
    ],
  },
  {
    title: 'Cosa fotografare',
    questions: [
      { key: 'coverage_hours', label: 'Quante ore di copertura ti servono', type: 'select',
        options: ['fino_4_ore', '6_8_ore', 'full_day_10_12_ore', 'multi_day'] },
      { key: 'key_moments', label: 'Momenti per te imperdibili', type: 'multiselect',
        options: ['preparativi', 'first_look', 'cerimonia', 'ritratti_di_coppia', 'foto_famiglia', 'gruppi', 'aperitivo', 'taglio_torta', 'prima_danza', 'party_serale', 'fuochi_artificio'] },
      { key: 'must_have_shots', label: 'Foto specifiche da non perdere (es. nonna in carrozzella, animale domestico)', type: 'textarea' },
      { key: 'shy_or_no_photo', label: 'Persone che NON vogliono essere fotografate', type: 'textarea', placeholder: 'Nomi e relazione, se ce ne sono' },
    ],
  },
  {
    title: 'Consegna finale',
    questions: [
      { key: 'expected_photo_count', label: 'Quante foto editate ti aspetti', type: 'select',
        options: ['200_300', '300_500', '500_800', 'tutte_consegnabili'] },
      { key: 'album_wanted', label: 'Vuoi un album stampato?', type: 'select', options: ['sì_premium', 'sì_standard', 'no_solo_digitale', 'decideremo_dopo'] },
      { key: 'prints_count', label: 'Stampe fine art aggiuntive (numero indicativo)', type: 'number', placeholder: '0' },
      { key: 'turnaround_priority', label: 'Quanto è importante avere le foto presto', type: 'select',
        options: ['molto_urgente_2_4_settimane', 'medio_2_3_mesi', 'tranquilli_fino_6_mesi'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// VIDEOMAKER
// ---------------------------------------------------------------------------
const Q_VIDEOMAKER: QuestionnaireSection[] = [
  {
    title: 'Stile video',
    questions: [
      { key: 'video_style', label: 'Stile preferito', type: 'select',
        options: ['cinematografico', 'documentaristico', 'reel_social_moderno', 'classico_narrato', 'silenzioso_emozionale'] },
      { key: 'audio_priority', label: 'Quanto è importante l\'audio (voti, discorsi)', type: 'select',
        options: ['fondamentale_microfoni_su_tutti', 'importante_su_sposi', 'solo_musica_di_sottofondo'] },
      { key: 'drone_wanted', label: 'Riprese drone aeree?', type: 'select', options: ['sì_indispensabili', 'sì_se_possibile', 'no'] },
    ],
  },
  {
    title: 'Cosa filmare',
    questions: [
      { key: 'coverage_hours', label: 'Ore di copertura', type: 'select',
        options: ['cerimonia_solo_2_3_ore', 'meta_giornata_5_6_ore', 'full_day_10_12_ore'] },
      { key: 'operators', label: 'Numero operatori (2 fanno più angolazioni)', type: 'select', options: ['1', '2', '3_o_piu'] },
      { key: 'key_moments', label: 'Momenti chiave', type: 'multiselect',
        options: ['preparativi', 'cerimonia', 'voti', 'discorsi', 'taglio_torta', 'prima_danza', 'party'] },
      { key: 'special_requests', label: 'Richieste speciali', type: 'textarea' },
    ],
  },
  {
    title: 'Consegna finale',
    questions: [
      { key: 'deliverables', label: 'Cosa vuoi ricevere', type: 'multiselect',
        options: ['highlights_3_5_min', 'film_completo_20_40_min', 'reel_social_60_sec', 'aftermovie_trailer', 'same_day_edit'] },
      { key: 'music_mood', label: 'Mood musica del montaggio', type: 'select',
        options: ['acustico_emozionante', 'cinematico_epico', 'pop_indie', 'classica_orchestrale', 'lascia_a_te'] },
      { key: 'shared_song', label: 'Avete una canzone particolare da usare? (titolo e artista)', type: 'text' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// FIORAIO
// ---------------------------------------------------------------------------
const Q_FIORAIO: QuestionnaireSection[] = [
  {
    title: 'Palette e stile',
    questions: [
      { key: 'color_palette', label: 'Colori principali', type: 'tags', placeholder: 'es. bianco, eucalipto, rosa cipria' },
      { key: 'style', label: 'Stile floreale', type: 'select',
        options: ['romantico_classico', 'wild_garden', 'minimalista_strutturato', 'tropical_esotico', 'rustico_campagna', 'fine_art_pastello', 'monocolore_audace'] },
      { key: 'preferred_flowers', label: 'Fiori che ami', type: 'tags', placeholder: 'es. peonie, rose david austin, ortensie' },
      { key: 'avoid_flowers', label: 'Fiori che NON vuoi (allergie, antipatie)', type: 'tags', placeholder: 'es. gigli, gerbere' },
    ],
  },
  {
    title: 'Allestimenti richiesti',
    questions: [
      { key: 'pieces_needed', label: 'Composizioni da realizzare', type: 'multiselect',
        options: ['bouquet_sposa', 'bouquet_damigelle', 'boutonniere_sposo', 'corona_fiori', 'cerimonia_arco_altare', 'cerimonia_navata', 'centrotavola_ricevimento', 'tableau_mariage', 'auto_sposi', 'torta', 'wedding_cake_smash', 'petali_uscita', 'lounge_area'] },
      { key: 'table_count', label: 'Numero tavoli da allestire', type: 'number', placeholder: '10' },
      { key: 'venue_indoor_outdoor', label: 'Allestimento interno o esterno', type: 'select', options: ['solo_interno', 'solo_esterno', 'misto'] },
      { key: 'reuse_ceremony_reception', label: 'Vuoi che le composizioni della cerimonia siano spostate al ricevimento?', type: 'select', options: ['sì_per_risparmiare', 'no_voglio_due_set', 'lascia_decidere'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// CATERING
// ---------------------------------------------------------------------------
const Q_CATERING: QuestionnaireSection[] = [
  {
    title: 'Format del servizio',
    questions: [
      { key: 'service_format', label: 'Formato pasto', type: 'select',
        options: ['pranzo_seduto', 'cena_seduta', 'aperitivo_buffet_lungo', 'cocktail_dinatoire', 'isole_buffet', 'mix_seduto_e_isole'] },
      { key: 'guests_count', label: 'Numero invitati', type: 'number', required: true },
      { key: 'kids_count', label: 'Bambini sotto i 12 anni', type: 'number' },
      { key: 'cuisine_style', label: 'Stile di cucina', type: 'select',
        options: ['italiana_tradizionale_regionale', 'mediterranea_moderna', 'gourmet_fine_dining', 'fusion_internazionale', 'street_food_party', 'vegetariana_vegana_centric'] },
    ],
  },
  {
    title: 'Diete, allergie, preferenze',
    questions: [
      { key: 'vegetarian_count', label: 'Quanti ospiti vegetariani', type: 'number' },
      { key: 'vegan_count', label: 'Quanti ospiti vegani', type: 'number' },
      { key: 'celiac_count', label: 'Quanti ospiti celiaci', type: 'number' },
      { key: 'allergies_notes', label: 'Allergie note degli ospiti', type: 'textarea', placeholder: 'Es. zia Anna — crostacei; cugino Luca — frutta secca' },
      { key: 'cultural_restrictions', label: 'Restrizioni culturali/religiose', type: 'multiselect', options: ['halal', 'kosher', 'no_maiale', 'no_alcol_per_alcuni'] },
      { key: 'favourite_dishes', label: 'Piatti che amate (anche regionali)', type: 'textarea' },
      { key: 'avoid_dishes', label: 'Cose che NON volete vedere a tavola', type: 'textarea' },
    ],
  },
  {
    title: 'Bevande e bar',
    questions: [
      { key: 'open_bar', label: 'Open bar?', type: 'select', options: ['sì_premium', 'sì_classico', 'solo_aperitivo_e_vini', 'no_solo_acqua_vino'] },
      { key: 'wine_preference', label: 'Preferenze vino', type: 'select', options: ['rossi_strutturati', 'bianchi_freschi', 'bollicine_metodo_classico', 'mix_regionale', 'lascia_scelta_al_sommelier'] },
      { key: 'special_drinks', label: 'Cocktail o drink particolari da inserire', type: 'tags' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// PASTICCERE
// ---------------------------------------------------------------------------
const Q_PASTICCERE: QuestionnaireSection[] = [
  {
    title: 'La torta',
    questions: [
      { key: 'cake_layers', label: 'Numero piani torta', type: 'select', options: ['1', '2', '3', '4_o_piu', 'cake_topper_finta_+_torta_da_taglio_separata'] },
      { key: 'cake_style', label: 'Stile estetico', type: 'select',
        options: ['classica_bianca', 'naked_cake', 'semi_naked', 'floreale', 'cascata_drip', 'geometrica_moderna', 'tematica'] },
      { key: 'cake_flavours', label: 'Gusti preferiti (interno)', type: 'tags', placeholder: 'es. pistacchio bronte, vaniglia bourbon, frutti di bosco' },
      { key: 'cake_flavours_avoid', label: 'Gusti da evitare', type: 'tags' },
      { key: 'guests_count', label: 'Numero invitati', type: 'number' },
    ],
  },
  {
    title: 'Dolci accessori',
    questions: [
      { key: 'accessories', label: 'Cosa vuoi oltre la torta', type: 'multiselect',
        options: ['confettata_classica', 'sweet_table_buffet', 'mini_cake_ospiti', 'wedding_cookies_segnaposto', 'cake_pops', 'macarons', 'cioccolatini', 'gelato_artigianale'] },
      { key: 'allergies', label: 'Allergie alimentari ospiti', type: 'multiselect',
        options: ['glutine', 'lattosio', 'uova', 'frutta_a_guscio', 'soia'] },
      { key: 'gluten_free_count', label: 'Porzioni gluten-free da prevedere', type: 'number' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// MUSICA / DJ / BAND
// ---------------------------------------------------------------------------
const Q_MUSICA: QuestionnaireSection[] = [
  {
    title: 'Cerimonia',
    questions: [
      { key: 'ceremony_music', label: 'Vuoi musica per la cerimonia?', type: 'select', options: ['sì_dal_vivo', 'sì_registrata', 'no'] },
      { key: 'ceremony_song_walk', label: 'Brano per l\'entrata (titolo e artista)', type: 'text', placeholder: 'Es. Canon in D — Pachelbel' },
      { key: 'ceremony_song_exit', label: 'Brano per l\'uscita', type: 'text' },
    ],
  },
  {
    title: 'Aperitivo e cena',
    questions: [
      { key: 'aperitivo_mood', label: 'Mood musica per aperitivo/cena', type: 'select',
        options: ['lounge_chill', 'jazz_acustico', 'pop_italiano_anni_60_80', 'pop_moderno', 'classica', 'mix_dj_eclettico'] },
      { key: 'volume_preference', label: 'Volume durante la cena', type: 'select', options: ['basso_sottofondo', 'medio_si_balla_anche', 'alto_party_da_subito'] },
    ],
  },
  {
    title: 'Festa e danze',
    questions: [
      { key: 'first_dance_song', label: 'Canzone della prima danza', type: 'text', placeholder: 'titolo e artista' },
      { key: 'party_genres', label: 'Generi che vuoi sentire', type: 'multiselect',
        options: ['pop_italiano', 'pop_internazionale', 'anni_70', 'anni_80', 'anni_90', 'anni_2000', 'hip_hop', 'reggaeton', 'rock', 'house_dance', 'commerciale_radio', 'cantautori_italiani'] },
      { key: 'banned_genres', label: 'Generi da NON suonare', type: 'tags' },
      { key: 'must_play_songs', label: 'Brani assolutamente da mettere', type: 'tags', placeholder: 'titolo - artista, separati da virgola' },
      { key: 'no_play_songs', label: 'Brani assolutamente da NON mettere', type: 'tags' },
      { key: 'karaoke', label: 'Karaoke?', type: 'select', options: ['sì_voglio', 'forse_breve', 'assolutamente_no'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// ALLESTIMENTI / ARREDI / TABLE
// ---------------------------------------------------------------------------
const Q_ALLESTIMENTI: QuestionnaireSection[] = [
  {
    title: 'Stile generale',
    questions: [
      { key: 'overall_style', label: 'Stile complessivo', type: 'select',
        options: ['classico_elegante', 'rustico_country', 'boho_chic', 'industrial', 'minimal_moderno', 'tropicale', 'glam_oro', 'shabby_pastello'] },
      { key: 'color_palette', label: 'Colori principali (max 3)', type: 'tags' },
      { key: 'material_preference', label: 'Materiali che ami', type: 'multiselect',
        options: ['legno_naturale', 'metallo_dorato', 'metallo_nero', 'vetro_cristallo', 'lino_tessuto_naturale', 'velluto', 'ottone_rame', 'rattan_bambu'] },
    ],
  },
  {
    title: 'Cosa allestire',
    questions: [
      { key: 'guests_count', label: 'Numero invitati', type: 'number' },
      { key: 'tables_setup', label: 'Configurazione tavoli', type: 'select',
        options: ['rotondi_da_8_10', 'imperiali_lunghi', 'misto', 'tavolata_unica', 'cocktail_alto_lounge'] },
      { key: 'spaces_to_dress', label: 'Aree da allestire', type: 'multiselect',
        options: ['cerimonia', 'aperitivo', 'sala_ricevimento', 'photo_corner', 'lounge_area', 'dance_floor', 'tableau', 'tavolo_dolci', 'open_bar'] },
      { key: 'lighting_priority', label: 'Importanza illuminazione scenografica', type: 'select',
        options: ['fondamentale', 'importante', 'sufficiente_basic'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// MAKE-UP / HAIRSTYLING
// ---------------------------------------------------------------------------
const Q_MAKE_UP: QuestionnaireSection[] = [
  {
    title: 'Il/la festeggiato/a',
    questions: [
      { key: 'skin_type', label: 'Tipo di pelle', type: 'select', options: ['secca', 'mista', 'grassa', 'sensibile', 'normale'] },
      { key: 'usual_makeup', label: 'Quanto trucco usi di solito', type: 'select', options: ['mai', 'poco_quotidiano', 'medio', 'molto_amante_makeup'] },
      { key: 'allergies', label: 'Allergie a cosmetici o ingredienti', type: 'tags', placeholder: 'es. lattice, profumi, henna' },
    ],
  },
  {
    title: 'Stile desiderato',
    questions: [
      { key: 'makeup_style', label: 'Stile trucco', type: 'select',
        options: ['naturale_glowy', 'classico_elegante', 'smokey_eyes', 'romantico_pesca', 'editoriale_audace', 'no_makeup_makeup'] },
      { key: 'lipstick_preference', label: 'Rossetto preferito', type: 'select', options: ['nude_naturale', 'rosa_glossy', 'rosso_classico', 'berry_scuro', 'lasciamo_decidere_a_te'] },
      { key: 'hair_style', label: 'Acconciatura', type: 'select',
        options: ['raccolto_classico', 'raccolto_morbido', 'semi_raccolto', 'sciolto_onde', 'treccia_elaborata', 'da_decidere_in_prova'] },
      { key: 'hair_extensions', label: 'Extension capelli', type: 'select', options: ['sì_le_ho_già', 'sì_servono', 'no'] },
    ],
  },
  {
    title: 'Prova e logistica',
    questions: [
      { key: 'trial_wanted', label: 'Vuoi una prova prima?', type: 'select', options: ['sì_necessaria', 'sì_se_inclusa', 'no_diretto_il_giorno'] },
      { key: 'other_people_makeup', label: 'Altre persone da truccare', type: 'multiselect', options: ['mamma_sposa', 'mamma_sposo', 'damigelle_sorelle', 'testimoni', 'amiche', 'bambini'] },
      { key: 'location_setup', label: 'Dove ti prepari', type: 'select', options: ['casa_propria', 'hotel', 'location_evento', 'studio_truccatore', 'da_decidere'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// ABITI / ATELIER
// ---------------------------------------------------------------------------
const Q_ABITI: QuestionnaireSection[] = [
  {
    title: 'Stile abito',
    questions: [
      { key: 'silhouette', label: 'Silhouette preferita', type: 'select',
        options: ['principessa_aderente_voluminoso', 'sirena', 'a_linea', 'colonna_dritto', 'corto', 'pantalone_jumpsuit', 'da_definire'] },
      { key: 'neckline', label: 'Scollatura', type: 'select', options: ['cuore', 'a_v', 'tondo', 'incrociato', 'monospalla', 'a_barchetta', 'alta_collo', 'lasciamo_aperto'] },
      { key: 'fabric_preference', label: 'Tessuto preferito', type: 'multiselect', options: ['pizzo', 'tulle', 'crepe', 'mikado', 'organza', 'raso', 'georgette', 'satin'] },
      { key: 'sleeve_preference', label: 'Maniche', type: 'select', options: ['senza_maniche', 'spalline_sottili', 'maniche_lunghe_pizzo', 'maniche_corte', 'cape_o_coprispalle_a_parte'] },
    ],
  },
  {
    title: 'Dimensioni e tempistiche',
    questions: [
      { key: 'usual_size', label: 'Taglia abituale italiana', type: 'select', options: ['38', '40', '42', '44', '46', '48', 'oltre_50', 'preferisco_non_dire'] },
      { key: 'height', label: 'Altezza (cm)', type: 'number', placeholder: '170' },
      { key: 'event_date', label: 'Data evento', type: 'date' },
      { key: 'first_fitting_when', label: 'Quando puoi iniziare le prove', type: 'select', options: ['subito', 'tra_1_3_mesi', 'tra_3_6_mesi'] },
    ],
  },
  {
    title: 'Accessori',
    questions: [
      { key: 'accessories_wanted', label: 'Accessori inclusi', type: 'multiselect',
        options: ['velo_corto', 'velo_cattedrale', 'tiara', 'fascia_capelli', 'orecchini', 'collana', 'scarpe', 'guanti'] },
      { key: 'budget_dress', label: 'Budget approssimativo abito €', type: 'number' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// LOCATION
// ---------------------------------------------------------------------------
const Q_LOCATION: QuestionnaireSection[] = [
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date', label: 'Data prevista (o periodo)', type: 'date' },
      { key: 'guests_count', label: 'Numero invitati stimato', type: 'number', required: true },
      { key: 'ceremony_in_venue', label: 'Cerimonia in struttura?', type: 'select', options: ['sì_civile', 'sì_simbolica', 'no_solo_ricevimento'] },
      { key: 'reception_kind', label: 'Tipo ricevimento', type: 'select',
        options: ['pranzo_seduto', 'cena_seduta', 'aperitivo_lungo', 'cocktail_party'] },
    ],
  },
  {
    title: 'Logistica',
    questions: [
      { key: 'sleeping_in_venue', label: 'Sposi dormono in struttura?', type: 'select', options: ['sì_suite_sposi', 'sì_+_invitati', 'no'] },
      { key: 'guests_accommodation', label: 'Quante camere ospiti servono', type: 'number' },
      { key: 'parking_required', label: 'Parcheggio invitati', type: 'select', options: ['serve_grande', 'medio', 'pochi_posti_va_bene'] },
      { key: 'special_needs', label: 'Esigenze speciali (accessibilità, animali, bambini)', type: 'textarea' },
    ],
  },
  {
    title: 'Catering',
    questions: [
      { key: 'catering_choice', label: 'Vuoi il catering della location o esterno?', type: 'select', options: ['interno_pacchetto', 'esterno_porto_io', 'da_valutare'] },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// AUTO / TRASPORTI
// ---------------------------------------------------------------------------
const Q_AUTO: QuestionnaireSection[] = [
  {
    title: 'Auto sposi',
    questions: [
      { key: 'car_style', label: 'Stile auto', type: 'select',
        options: ['vintage_anni_50_60', 'sportiva_moderna', 'rolls_royce_classico', 'jaguar_inglese', 'fiat_500_iconica', 'altro_da_concordare'] },
      { key: 'car_color', label: 'Colore preferito', type: 'tags' },
      { key: 'decorations', label: 'Vuoi addobbi floreali sull\'auto?', type: 'select', options: ['sì_eleganti', 'sì_minimal', 'no_solo_pulita'] },
    ],
  },
  {
    title: 'Tratte',
    questions: [
      { key: 'pickup_address', label: 'Indirizzo ritiro sposa', type: 'text' },
      { key: 'ceremony_address', label: 'Luogo cerimonia', type: 'text' },
      { key: 'reception_address', label: 'Luogo ricevimento', type: 'text' },
      { key: 'photo_stops', label: 'Fermate per foto desiderate?', type: 'textarea' },
    ],
  },
  {
    title: 'Servizio invitati',
    questions: [
      { key: 'shuttle_for_guests', label: 'Servizio navetta per invitati?', type: 'select', options: ['sì_per_tutti', 'sì_solo_alcuni', 'no'] },
      { key: 'guests_to_transport', label: 'Quanti invitati da trasportare', type: 'number' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// ANIMAZIONE
// ---------------------------------------------------------------------------
const Q_ANIMAZIONE: QuestionnaireSection[] = [
  {
    title: 'Pubblico',
    questions: [
      { key: 'audience_type', label: 'Per chi è l\'animazione', type: 'multiselect',
        options: ['bambini_piccoli_3_6', 'bambini_7_11', 'ragazzi_12_16', 'adulti_party', 'tutti'] },
      { key: 'kids_count', label: 'Numero bambini presenti', type: 'number' },
      { key: 'event_duration', label: 'Durata richiesta', type: 'select', options: ['1_ora', '2_3_ore', 'tutto_il_pomeriggio', 'serata_intera'] },
    ],
  },
  {
    title: 'Tipo di animazione',
    questions: [
      { key: 'activities', label: 'Cosa vuoi', type: 'multiselect',
        options: ['mago_illusionista', 'truccabimbi', 'palloncini_modellabili', 'baby_dance', 'gonfiabili', 'caccia_al_tesoro', 'statua_vivente', 'fuochi_di_artificio', 'spettacolo_fuoco', 'cabaret_comico'] },
      { key: 'space_available', label: 'Spazio disponibile', type: 'select', options: ['interno_grande', 'interno_piccolo', 'giardino', 'terrazza', 'piscina'] },
      { key: 'special_requests', label: 'Richieste particolari', type: 'textarea' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// CELEBRANTE
// ---------------------------------------------------------------------------
const Q_CELEBRANTE: QuestionnaireSection[] = [
  {
    title: 'La cerimonia',
    questions: [
      { key: 'ceremony_kind', label: 'Tipo cerimonia', type: 'select',
        options: ['simbolica_laica', 'rito_alleanze', 'rito_sabbia', 'rito_candele', 'rito_albero', 'libera_con_letture', 'altro'] },
      { key: 'duration', label: 'Durata desiderata', type: 'select', options: ['breve_15_20_min', 'media_30_40_min', 'piu_lunga'] },
      { key: 'language', label: 'Lingua', type: 'select', options: ['italiano', 'inglese', 'bilingue', 'altra'] },
    ],
  },
  {
    title: 'Voi due',
    questions: [
      { key: 'how_met', label: 'Come vi siete conosciuti', type: 'textarea' },
      { key: 'love_story_milestones', label: 'Momenti importanti della vostra storia', type: 'textarea' },
      { key: 'wedding_meaning', label: 'Cosa significa per voi sposarvi', type: 'textarea' },
      { key: 'shared_values', label: 'Valori che condividete e volete portare nella cerimonia', type: 'tags' },
    ],
  },
  {
    title: 'Persone coinvolte',
    questions: [
      { key: 'readings_by', label: 'Chi vorresti che leggesse?', type: 'textarea', placeholder: 'Nomi e relazioni' },
      { key: 'music_during', label: 'Musica desiderata durante la cerimonia', type: 'text' },
      { key: 'rituals_special', label: 'Riti particolari da includere', type: 'textarea' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// WEDDING PLANNER (versione fornitore-WP standalone)
// ---------------------------------------------------------------------------
const Q_WEDDING_PLANNER: QuestionnaireSection[] = [
  {
    title: 'Voi due',
    questions: [
      { key: 'partner1_name', label: 'Nome partner 1', type: 'text', required: true },
      { key: 'partner2_name', label: 'Nome partner 2', type: 'text', required: true },
      { key: 'how_met', label: 'Come vi siete conosciuti', type: 'textarea' },
    ],
  },
  {
    title: 'Vision evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data confermata', type: 'date' },
      { key: 'location_kind', label: 'Tipo location ideale', type: 'select', options: ['villa', 'tenuta', 'castello', 'spiaggia', 'borgo', 'agriturismo', 'casa_privata', 'destination_estero'] },
      { key: 'styles', label: 'Stili che vi piacciono', type: 'multiselect',
        options: ['classico', 'moderno', 'rustico', 'boho', 'minimal', 'elegante', 'romantico', 'industriale'] },
      { key: 'guests_estimate', label: 'Invitati stimati', type: 'number' },
      { key: 'budget_total', label: 'Budget totale orientativo €', type: 'number' },
      { key: 'must_haves', label: 'Tre cose che NON possono mancare', type: 'tags' },
      { key: 'no_thanks', label: 'Tre cose che NON volete', type: 'tags' },
    ],
  },
  INSPIRATION_SECTION,
]

// ---------------------------------------------------------------------------
// GENERICO (altro/wedding_planner non specifico)
// ---------------------------------------------------------------------------
const Q_GENERICO: QuestionnaireSection[] = [
  {
    title: 'Il servizio',
    questions: [
      { key: 'event_date', label: 'Data evento', type: 'date' },
      { key: 'guests_count', label: 'Numero persone coinvolte', type: 'number' },
      { key: 'specific_needs', label: 'Esigenze specifiche', type: 'textarea' },
      { key: 'special_requests', label: 'Richieste particolari', type: 'textarea' },
    ],
  },
  INSPIRATION_SECTION,
]

const QUESTIONS_BY_SUBROLE: Record<string, QuestionnaireSection[]> = {
  fotografo: Q_FOTOGRAFO,
  videomaker: Q_VIDEOMAKER,
  fioraio: Q_FIORAIO,
  catering: Q_CATERING,
  pasticcere: Q_PASTICCERE,
  musica: Q_MUSICA,
  dj: Q_MUSICA,
  band: Q_MUSICA,
  allestimenti: Q_ALLESTIMENTI,
  make_up: Q_MAKE_UP,
  hairstylist: Q_MAKE_UP,
  abiti: Q_ABITI,
  atelier: Q_ABITI,
  location: Q_LOCATION,
  auto: Q_AUTO,
  animazione: Q_ANIMAZIONE,
  celebrante: Q_CELEBRANTE,
  wedding_planner: Q_WEDDING_PLANNER,
  altro: Q_GENERICO,
}

export function getQuestionsForSubrole(subrole: string | null | undefined): QuestionnaireSection[] {
  const k = (subrole ?? 'altro').toLowerCase().trim()
  return QUESTIONS_BY_SUBROLE[k] ?? Q_GENERICO
}

// Sezione "stile" minimale per il subrole, da combinare con domande event-specific
// quando l'evento NON è un matrimonio. Le domande dei Q_* per subrole sono cucite
// su matrimonio (bouquet sposa, auto sposi, ecc) e non si applicano agli altri eventi.
const SUBROLE_STYLE_SECTIONS: Record<string, QuestionnaireSection> = {
  fotografo: {
    title: 'Stile fotografico',
    questions: [
      { key: 'photo_style', label: 'Stile preferito', type: 'multiselect',
        options: ['reportage_naturale', 'posato_elegante', 'editoriale_fashion', 'fine_art', 'cinematografico', 'spontaneo_emozionale', 'vintage_pellicola', 'minimal_pulito'] },
      { key: 'photo_must_have', label: 'Foto che NON possono mancare', type: 'textarea', placeholder: 'Es. il momento del rito, i nonni con il festeggiato, primi piani durante il taglio della torta' },
      { key: 'photo_to_avoid', label: 'Cose da evitare', type: 'textarea' },
      { key: 'delivery_format', label: 'Cosa vuoi ricevere', type: 'multiselect', options: ['solo_digitale', 'album_stampato', 'box_stampe', 'video_slideshow'] },
    ],
  },
  videomaker: {
    title: 'Stile video',
    questions: [
      { key: 'video_style', label: 'Stile preferito', type: 'multiselect', options: ['cinematografico', 'documentaristico', 'editoriale', 'spontaneo', 'highlight_breve'] },
      { key: 'video_duration', label: 'Durata video finale', type: 'select', options: ['1_3_minuti', '5_10_minuti', '15_20_minuti', 'lungo_30_min'] },
      { key: 'video_music_pref', label: 'Preferenze musica', type: 'textarea' },
    ],
  },
  fioraio: {
    title: 'Palette e allestimenti',
    questions: [
      { key: 'color_palette', label: 'Colori preferiti', type: 'tags', placeholder: 'bianco, verde salvia, rosa cipria' },
      { key: 'flower_style', label: 'Stile', type: 'multiselect', options: ['classico', 'romantico', 'rustico_country', 'minimal_moderno', 'elegante_lussuoso', 'boho', 'tropicale'] },
      { key: 'addobbi_needed', label: 'Allestimenti richiesti', type: 'textarea', placeholder: 'Es. centrotavola per 8 tavoli, addobbo altare, ingresso casa, fonte battesimale' },
    ],
  },
  catering: {
    title: 'Servizio catering',
    questions: [
      { key: 'service_format', label: 'Formato', type: 'multiselect', options: ['servito_al_tavolo', 'buffet', 'fingerfood', 'aperitivo', 'rinfresco', 'pranzo_seduti', 'cena_seduti'] },
      { key: 'guests_count', label: 'Numero ospiti', type: 'number' },
      { key: 'vegetarian_count', label: 'Vegetariani', type: 'number' },
      { key: 'vegan_count', label: 'Vegani', type: 'number' },
      { key: 'celiac_count', label: 'Celiaci', type: 'number' },
      { key: 'allergies', label: 'Allergie/intolleranze', type: 'textarea' },
    ],
  },
  pasticcere: {
    title: 'Dolce/torta',
    questions: [
      { key: 'cake_format', label: 'Formato', type: 'multiselect', options: ['torta_unica', 'cake_design_piani', 'monoporzioni', 'mignon_assortiti', 'cupcakes'] },
      { key: 'guests_count', label: 'Numero ospiti', type: 'number' },
      { key: 'cake_style', label: 'Stile decorativo', type: 'textarea' },
      { key: 'flavors', label: 'Gusti preferiti', type: 'tags' },
    ],
  },
  musica: {
    title: 'Musica e intrattenimento',
    questions: [
      { key: 'music_format', label: 'Tipo di servizio', type: 'multiselect', options: ['dj_set', 'band_live', 'musicista_solo', 'coro', 'musica_ambient_aperitivo'] },
      { key: 'music_genre', label: 'Generi preferiti', type: 'tags' },
      { key: 'special_songs', label: 'Brani particolari richiesti', type: 'textarea' },
    ],
  },
  allestimenti: {
    title: 'Allestimenti e mood',
    questions: [
      { key: 'style', label: 'Stile', type: 'multiselect', options: ['classico', 'rustico', 'moderno_minimal', 'elegante_lussuoso', 'boho', 'industriale', 'fairytale'] },
      { key: 'color_palette', label: 'Colori', type: 'tags' },
      { key: 'spaces_to_decorate', label: 'Spazi da allestire', type: 'textarea' },
    ],
  },
  make_up: {
    title: 'Make-up & hair',
    questions: [
      { key: 'style_preferred', label: 'Stile preferito', type: 'multiselect', options: ['naturale_glow', 'classico_elegante', 'glamour_intenso', 'bohemian', 'editoriale_moderno'] },
      { key: 'other_people_makeup', label: 'Altre persone da truccare', type: 'number', help: 'Quante altre persone oltre te' },
      { key: 'allergies', label: 'Allergie/sensibilità', type: 'textarea' },
    ],
  },
  abiti: {
    title: 'Abito',
    questions: [
      { key: 'style', label: 'Stile', type: 'textarea', placeholder: 'Es. elegante, classico, moderno' },
      { key: 'colors', label: 'Colori preferiti', type: 'tags' },
      { key: 'size_notes', label: 'Note taglia/misure', type: 'textarea' },
    ],
  },
  location: {
    title: 'Spazio e setup',
    questions: [
      { key: 'guests_count', label: 'Numero ospiti', type: 'number' },
      { key: 'service_type', label: 'Tipo di servizio', type: 'multiselect', options: ['solo_spazio', 'spazio_e_catering', 'aperitivo', 'pranzo', 'cena', 'evento_serale'] },
      { key: 'special_needs', label: 'Esigenze particolari', type: 'textarea' },
    ],
  },
  auto: {
    title: 'Trasporto',
    questions: [
      { key: 'pickup_address', label: 'Indirizzo ritiro', type: 'text' },
      { key: 'destination', label: 'Destinazione', type: 'text' },
      { key: 'auto_style', label: 'Tipo auto', type: 'select', options: ['classica_epoca', 'moderna_lusso', 'limousine', 'minivan', 'sportiva'] },
    ],
  },
  animazione: {
    title: 'Intrattenimento',
    questions: [
      { key: 'children_count', label: 'Numero bambini', type: 'number' },
      { key: 'children_age', label: 'Fasce d\'età', type: 'tags', placeholder: '3-5 anni, 6-10 anni, ...' },
      { key: 'activities', label: 'Attività preferite', type: 'multiselect', options: ['baby_dance', 'truccabimbi', 'palloncini', 'magia', 'giochi_organizzati', 'angolo_lettura'] },
    ],
  },
  celebrante: { title: 'Celebrazione', questions: [
    { key: 'ceremony_type', label: 'Tipo cerimonia', type: 'textarea' },
    { key: 'reading_preferences', label: 'Letture/preghiere preferite', type: 'textarea' },
  ]},
  wedding_planner: { title: 'Coordinamento evento', questions: [
    { key: 'services_needed', label: 'Servizi richiesti', type: 'multiselect', options: ['consulenza', 'pianificazione_completa', 'coordinamento_giorno', 'gestione_fornitori'] },
    { key: 'budget_range', label: 'Budget orientativo (€)', type: 'select', options: ['<5k', '5k-15k', '15k-30k', '30k-50k', '>50k'] },
  ]},
}

// Combina domande event-specific con stile del fornitore.
// Per matrimonio mantiene il flusso attuale (Q_* subrole cucite su matrimonio).
// Per altri eventi (battesimo, comunione, ...) prende le domande evento + stile subrole.
export function getQuestionsForSupplierContext(
  subrole: string | null | undefined,
  eventKind: string | null | undefined,
  baseEventQuestions: QuestionnaireSection[],
): QuestionnaireSection[] {
  const ek = (eventKind ?? 'matrimonio').toLowerCase().trim()
  if (ek === 'matrimonio') {
    return getQuestionsForSubrole(subrole)
  }
  const k = (subrole ?? 'altro').toLowerCase().trim()
  const styleSection = SUBROLE_STYLE_SECTIONS[k]
  const sections: QuestionnaireSection[] = [...baseEventQuestions]
  if (styleSection) sections.push(styleSection)
  sections.push(INSPIRATION_SECTION)
  return sections
}

const SUBROLE_LABELS: Record<string, string> = {
  fotografo: 'fotografo',
  videomaker: 'videomaker',
  fioraio: 'fioraio',
  catering: 'catering',
  pasticcere: 'pasticcere',
  musica: 'musica',
  dj: 'DJ',
  band: 'band',
  allestimenti: 'allestimenti',
  make_up: 'make-up artist',
  hairstylist: 'hairstylist',
  abiti: 'atelier',
  atelier: 'atelier',
  location: 'location',
  auto: 'auto e trasporti',
  animazione: 'animazione',
  celebrante: 'celebrante',
  wedding_planner: 'wedding planner',
  altro: 'fornitore',
}

export function subroleLabel(subrole: string | null | undefined): string {
  const k = (subrole ?? 'altro').toLowerCase().trim()
  return SUBROLE_LABELS[k] ?? 'fornitore'
}
