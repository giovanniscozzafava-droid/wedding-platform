# PRP · Modulo Maestranze
## Product Requirements Prompt · v1.1
### Bacheca di competenze chiusa — architettura "legale by design"

**17 luglio 2026 — Fuyue Srl / Planfully** (v1.0: 16/07/2026 — vedi §0.2)
**Stato: SPECIFICATO, CONGELATO DIETRO GATE (blocker residui: SEC-00 rotazione key, staging, SEC-02)**
**Riferimento business: [BUSINESS-PLAN-Maestranze-In-Pancia-v1.md](BUSINESS-PLAN-Maestranze-In-Pancia-v1.md) (v1.1)**
**Prerequisito di lancio: parere giuslavorista favorevole (non prerequisito di build)**

---

## 0. COSA SOSTITUISCE QUESTO DOCUMENTO

Questo PRP **sostituisce integralmente** la specifica Maestranze v3 (~85 ore, matching pgvector + gte-small). Il matching semantico è **eliminato by design**: l'architettura legale (bacheca informativa, non intermediazione ex D.Lgs. 276/2003) richiede che Planfully non selezioni, non ordini per rilevanza, non suggerisca candidati. Ogni riga di codice che "sceglie per l'utente" indebolisce la difesa legale. pgvector esce dal modulo.

**Conseguenza positiva:** il modulo si semplifica rispetto a v3 (85 ore). Stima v1.1: **~70 ore** (la v1.0 diceva 58; vedi §0.2 e §7).

### 0.1 Come leggere questo documento

Il PRP è scritto per essere eseguito da Claude Code **senza ulteriori domande**. Dove il documento dice "verificato", significa che l'affermazione è stata controllata contro il codice di questo repo alla data indicata, non dedotta. Dove dice **[ASSUNZIONE]** o **[DECISIONE]**, non lo è.

### 0.2 Correzioni della v1.1 (17/07/2026) — verifica contro il codice reale

La v1.0 è stata verificata **contro il repo**, non riletta. Reggono: l'impianto legale (principi 1-7), il modello dati nella sua struttura, l'eliminazione del matching, la scelta `SECURITY INVOKER`, l'anti-aggregazione via assenza di rating numerico, il divieto di ranking. **Sei cose no** — e la prima è grave, perché smonta da sola la tesi difensiva del modulo.

**Correzione 1 (GRAVE) — Il bucket foto pubblico svuota la "bacheca chiusa".** La v1.0 diceva `photo_url text, -- Storage bucket maestranze-photos` senza specificare altro. **Verificato**: in questo repo 7 bucket su 10 sono `public = true` (`fb-dish-photos`, `supplier-assets`, `event-guest-uploads`, `floor-plans`, `post-media`, `blog-media`, `album-catalogs`) — è esattamente il blocker SEC-02, tuttora aperto. Seguendo il pattern esistente, `maestranze-photos` nascerebbe pubblico: **la foto del volto di un lavoratore sarebbe su un URL pubblico, senza autenticazione**, mentre §3 dichiara che la bacheca è chiusa ai soli registrati. La RLS protegge la riga; non protegge il file. Il modulo non "eredita" SEC-02: **ne crea una nuova istanza**, e su dati personali di lavoratori — alcuni dei quali avranno dichiarato regime `NON_DICHIARO`. Fix in §2.4 (bucket privato + signed URL): non negoziabile, ed è la ragione per cui SEC-02 va da prerequisito temporale a **parte dello scope**.

**Correzione 2 — Il ruolo `MAESTRANZA` finisce nel wizard dei capostipiti.** **Verificato** in `frontend/src/components/auth/RequireAuth.tsx:47-48`: il gate onboarding esclude solo `COUPLE`, `CLIENT`, `FOTOLAB`; e `homeFor()` (righe 14-18) manda al `'/'` (dashboard professionista) qualunque ruolo non elencato. Una maestranza verrebbe quindi **forzata sul questionario di profilazione dei professionisti** e atterrerebbe nella dashboard capostipite: il wizard di §5.1 non verrebbe mai eseguito. Ogni nuovo ruolo cade nel default "professionista" — stessa classe di bug già vista con le rotte coppia. Fix: §5.0 (nuova) + M-6b in §7.

**Correzione 3 — L'admin non può leggere la chat che deve moderare.** §5.3 della v1.0 prevede la coda flag con "contesto messaggio (qui sì il contenuto, solo per admin, accesso loggato)", ma l'unica policy SELECT su `maestranze_chat_messages` è `chat_solo_parti` — **e l'admin non è parte**. La coda di moderazione, così com'era specificata, mostrerebbe il flag senza il messaggio: inutilizzabile. In più "accesso loggato" non aveva alcuna tabella dove loggare. Fix in §3 (RPC `admin_read_flagged_message` in `SECURITY DEFINER` con guard + log obbligatorio) e §2.1 (`maestranze_admin_access_log`). Nota: la scelta di NON dare all'admin una policy SELECT larga sulla chat è giusta e va mantenuta — l'accesso deve essere puntuale sul messaggio flaggato e tracciato, non un permesso di lettura generale.

**Correzione 4 — Cancellare un profilo è impossibile, e il diritto all'oblio è dichiarato.** In v1.0 `maestranze_profiles.id` ha `REFERENCES profiles(id) ON DELETE CASCADE`, ma `maestranze_declarations`, `maestranze_contacts`, `maestranze_private_feedback` referenziano `maestranze_profiles`/`profiles` **senza `ON DELETE`** → default `NO ACTION` → la cancellazione **fallisce con errore FK**. Effetto combinato: cancellare l'account rompe la cascata, mentre il business plan (§5.3) promette "cancellazione profilo = rimozione da ogni ricerca entro 24h". C'è di più, ed è il punto interessante: le dichiarazioni **devono** essere immutabili e conservate (valore probatorio, principio 7), ma l'utente **ha diritto** alla cancellazione. Le due cose non si conciliano con un `DELETE`: si conciliano con l'**anonimizzazione**. Fix in §2.5 + nuova **[DECISIONE] 6** in §9, perché la retention di una dichiarazione anonimizzata è una scelta legale, non tecnica.

**Correzione 5 — "Riuso pattern realtime esistente" (M-8): il realtime non esiste.** **Verificato**: zero occorrenze di `supabase.channel(` / `postgres_changes` in tutto `frontend/src`. La chat esistente (`frontend/src/components/wedding/ChatEvento.tsx`, 252 righe) fa **polling ogni 15 secondi** — e il commento alle righe 93-95 lo dice esplicitamente ("senza realtime i messaggi altrui non comparivano fino a un reload manuale"). Il pattern riusabile quindi **esiste**, ma è polling: la stima di 8 ore regge solo per una chat in polling, che eredita 15s di latenza. Il realtime vero sarebbe **+6 ore** e non è mai stato costruito in questo progetto. Chiarito in §7; scelta esplicitata in **[DECISIONE] 7**.

**Correzione 6 — La DoD si appoggia a una CI che non esiste.** La v1.0 chiedeva "Nessun ORDER BY su colonne di merito in tutta la codebase del modulo (grep di verifica in CI)". **Verificato**: `.github/workflows/` non esiste, non c'è alcuna CI. Il check migliore del progetto oggi è `npm run build` a mano. Un vincolo architetturale affidato a una CI immaginaria non è un vincolo: è un buon proposito. Fix in §8 — il grep diventa un test Vitest eseguibile (`npm run test`), che è l'unico posto dove oggi un controllo automatico gira davvero.

**Due precisazioni minori, stesso spirito:**

- **`ALTER TYPE ... ADD VALUE` va in una migration da solo.** In PG15 l'istruzione può stare in transazione, ma **il nuovo valore non è utilizzabile nella stessa transazione**. La v1.0 la metteva in testa allo schema di §2.1, e M-1 dice "migrazione schema completo" con dentro anche il trigger publish-guard: se quel trigger nomina `'MAESTRANZA'`, la migration **fallisce**. Il repo ha già il pattern giusto (`20260614160000_guest_role_enum.sql` contiene *solo* l'`alter type`). Fix: fase M-0 in §7.
- **L'anti-aggregazione era sovradichiarata.** La v1.0 diceva "struttura DB che renda *impossibile* aggregarlo per profilo senza migrazione esplicita". Falso: `maestranze_private_feedback.contact_id → maestranze_contacts.maestranza_id` è **una JOIN** dal profilo. Ciò che è vero — e sufficiente — è che **non esiste un campo numerico**, quindi non esiste una media, una stella, un punteggio: il testo libero non diventa ranking senza NLP esplicito e volontario. La protezione è reale; la formulazione no. Corretta in §2.1. La differenza conta: in una causa, un'affermazione tecnica sovradichiarata che l'altra parte smonta con una JOIN indebolisce tutto il resto del documento.

---

## 1. PRINCIPI NON NEGOZIABILI

Questi principi sono vincoli architetturali, non preferenze. Claude Code non deve mai violarli, nemmeno se una feature sembrerebbe migliore violandoli.

1. **Nessun ranking, mai.** I risultati di ricerca escono in ordine casuale (seed per sessione) o cronologico (data iscrizione). Nessun ORDER BY su metriche di qualità, engagement, feedback, completezza profilo. Il DB non deve nemmeno *avere* colonne che permettano un ranking di qualità.
2. **Nessun matching.** Nessuna funzione che dato un evento/bisogno proponga maestranze. La ricerca è pull dell'utente con filtri informativi espliciti (zona, competenza, esperienza).
3. **Nessuna transazione economica.** Nessun campo, tabella o flusso che tocchi compensi tra le parti. La fascia prezzo nel profilo è testo autodichiarato, opzionale, mai usato in filtri o calcoli.
4. **Nessuna verifica.** Tutto autodichiarato, etichettato come tale in UI ("dichiarato dall'utente, non verificato da Planfully").
5. **Feedback privato.** Il feedback post-lavoro è visibile solo alle due parti coinvolte. Nessuna aggregazione, nessun impatto su visibilità o ricerca. **Nessun campo numerico**: senza un numero non esiste una media, e senza media non esiste un ranking (§2.1).
6. **Tracciamento metadati, non contenuti.** Chi contatta chi e quando: sì, con retention 24 mesi. Il contenuto chat resta privato; il flag automatico keyword è l'unica lettura macchina, dichiarata in informativa.
7. **Snapshot al momento della dichiarazione.** La dichiarazione di regime fiscale al signup viene salvata con timestamp, testo esatto della checkbox mostrata, versione T&C accettata. Se cambiamo il testo, le vecchie dichiarazioni restano immutate (pattern anti-mutazione già identificato su food cost e album).
8. **[nuovo in v1.1] La chiusura della bacheca vale anche per i file.** "Chiusa ai soli registrati" è vero solo se lo è ogni superficie: righe (RLS) **e** oggetti storage (bucket privato + signed URL, §2.4). Un URL pubblico che restituisce il volto di una maestranza senza autenticazione rende falsa la frase su cui poggia tutta §5 del business plan. Nessuna eccezione "per comodità di caching".

---

## 2. MODELLO DATI

### 2.0 M-0 — L'enum in una migration da solo

```sql
-- File: <ts>_maestranza_role_enum.sql — DEVE contenere SOLO questa riga.
-- PG15: ADD VALUE è ammesso in transazione, ma il valore NON è usabile nella stessa
-- transazione. Qualsiasi trigger/seed che nomini 'MAESTRANZA' nello stesso file fallisce.
-- Precedente nel repo: 20260614160000_guest_role_enum.sql (contiene solo l'alter type).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MAESTRANZA';
```

### 2.1 Tabelle

```sql
-- =============================================
-- Profilo maestranza (estende profiles esistente)
-- =============================================
CREATE TABLE maestranze_profiles (
  id                  uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  display_name        varchar(120) NOT NULL,
  photo_path          text,                    -- PATH nel bucket PRIVATO, non URL. Vedi §2.4
  provincia           varchar(4) NOT NULL REFERENCES province_regioni(provincia),
  raggio_disponibilita text NOT NULL CHECK (raggio_disponibilita IN
                        ('PROVINCIA','REGIONE','NAZIONALE')),
  bio                 text CHECK (char_length(bio) <= 1200),
  anni_esperienza     smallint CHECK (anni_esperienza BETWEEN 0 AND 60),
  fascia_prezzo       varchar(80),             -- testo libero opzionale, MAI filtrabile
  disponibilita_note  text,                    -- es. "weekend, alta stagione"
  is_published        boolean NOT NULL DEFAULT false,
  published_at        timestamptz,
  anonymized_at       timestamptz,             -- §2.5: diritto all'oblio senza DELETE
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Lookup province → regioni (era citata in M-1 ma MANCAVA dallo schema v1.0)
-- Serve al filtro raggio REGIONE della RPC di ricerca (§2.3).
-- =============================================
CREATE TABLE province_regioni (
  provincia  varchar(4) PRIMARY KEY,   -- sigla (CZ, MI, ...)
  nome       varchar(80) NOT NULL,
  regione    varchar(40) NOT NULL
);
CREATE INDEX idx_province_regione ON province_regioni(regione);
-- Seed: 107 province (fonte ISTAT). Dato statico, nessuna logica.

-- =============================================
-- Competenze: vocabolario controllato + libere
-- (stesso pattern di service_categories)
-- =============================================
CREATE TABLE maestranze_skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(80) NOT NULL UNIQUE,
  is_standard  boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE maestranze_profile_skills (
  profile_id   uuid NOT NULL REFERENCES maestranze_profiles(id) ON DELETE CASCADE,
  skill_id     uuid NOT NULL REFERENCES maestranze_skills(id),
  PRIMARY KEY (profile_id, skill_id)
);

-- =============================================
-- STRATO LEGALE 2: dichiarazione consapevole
-- snapshot immutabile al signup
-- =============================================
CREATE TABLE maestranze_declarations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NIENTE ON DELETE CASCADE: la dichiarazione sopravvive al profilo (valore probatorio).
  -- La cancellazione dell'utente passa da anonimizzazione, non da DELETE. Vedi §2.5.
  profile_id        uuid NOT NULL REFERENCES maestranze_profiles(id) ON DELETE NO ACTION,
  regime            text NOT NULL CHECK (regime IN
                      ('PARTITA_IVA','SUBORDINATO_DISPONIBILE',
                       'SOLO_CONTRATTI_REGOLARI','NON_DICHIARO')),
  checkbox_text     text NOT NULL,        -- testo ESATTO mostrato all'utente
  tos_version       varchar(20) NOT NULL, -- versione T&C accettata
  declared_at       timestamptz NOT NULL DEFAULT now()
  -- NIENTE updated_at: le dichiarazioni non si aggiornano, si aggiungono.
  -- Cambio regime = nuova riga. Storia completa preservata.
);

-- =============================================
-- STRATO LEGALE 6a: metadati contatto
-- =============================================
CREATE TABLE maestranze_contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maestranza_id     uuid NOT NULL REFERENCES maestranze_profiles(id) ON DELETE NO ACTION,
  requester_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE NO ACTION,
  first_contact_at  timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at  timestamptz,   -- STRATO LEGALE 4: email promemoria inviata
  UNIQUE (maestranza_id, requester_id)
);

-- =============================================
-- Chat interna (thread per coppia)
-- =============================================
CREATE TABLE maestranze_chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES maestranze_contacts(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE NO ACTION,
  body         text NOT NULL CHECK (char_length(body) <= 4000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- STRATO LEGALE 6b: flag automatici keyword
-- (scrive solo il sistema, legge solo admin via RPC tracciata §3)
-- =============================================
CREATE TABLE maestranze_moderation_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES maestranze_chat_messages(id) ON DELETE CASCADE,
  matched_rule varchar(80) NOT NULL,   -- id regola, NON il contenuto
  status       text NOT NULL DEFAULT 'OPEN' CHECK (status IN
                 ('OPEN','REVIEWED_OK','REVIEWED_ACTION')),
  reviewed_by  uuid REFERENCES profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Regole keyword: configurabili da admin, MAI hardcoded (v1.0 lo chiedeva ma
-- non definiva la tabella).
CREATE TABLE maestranze_moderation_rules (
  id           varchar(80) PRIMARY KEY,   -- es. 'nero_esplicito_01'
  pattern      text NOT NULL,             -- regex, valutata SOLO server-side (EF-2)
  is_active    boolean NOT NULL DEFAULT true,
  note         text,
  updated_by   uuid REFERENCES profiles(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- [nuovo v1.1] Log accessi admin al contenuto chat (Correzione 3)
-- "accesso loggato" della v1.0 non aveva un posto dove loggare.
-- =============================================
CREATE TABLE maestranze_admin_access_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES profiles(id),
  message_id   uuid NOT NULL REFERENCES maestranze_chat_messages(id),
  flag_id      uuid REFERENCES maestranze_moderation_flags(id),
  accessed_at  timestamptz NOT NULL DEFAULT now()
  -- Nessun DELETE, nessun UPDATE: è un registro. Retention = quella dei metadati (24 mesi).
);

-- =============================================
-- Feedback privato post-lavoro
-- ANTI-AGGREGAZIONE: nessun campo numerico (vedi nota sotto)
-- =============================================
CREATE TABLE maestranze_private_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid NOT NULL REFERENCES maestranze_contacts(id) ON DELETE NO ACTION,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE NO ACTION,
  body          text NOT NULL CHECK (char_length(body) <= 2000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, author_id)   -- un feedback per parte per rapporto
);
-- NOTA v1.1 (correzione di una sovradichiarazione della v1.0): questa struttura NON rende
-- "impossibile" l'aggregazione per profilo — contact_id → maestranze_contacts.maestranza_id
-- è una sola JOIN. Ciò che rende impossibile il RANKING è l'assenza di qualsiasi campo
-- numerico: niente stelle, niente voto, niente media. Trasformare del testo libero in un
-- punteggio richiede NLP esplicito e volontario, cioè una decisione di prodotto tracciabile,
-- non una query. È questa la protezione, e va dichiarata per quello che è.
```

### 2.2 Indici

```sql
CREATE INDEX idx_maestranze_provincia ON maestranze_profiles(provincia)
  WHERE is_published;
CREATE INDEX idx_maestranze_skills_lookup ON maestranze_profile_skills(skill_id);
CREATE INDEX idx_contacts_requester ON maestranze_contacts(requester_id);
CREATE INDEX idx_chat_contact ON maestranze_chat_messages(contact_id, created_at);
CREATE INDEX idx_flags_open ON maestranze_moderation_flags(status)
  WHERE status = 'OPEN';
-- NESSUN indice su fascia_prezzo, anni_esperienza come sort key:
-- gli indici seguono i principi. Ricerca = filtro, non ordinamento.
```

### 2.3 Ordine dei risultati — implementazione del principio 1

```sql
-- RPC di ricerca. UNICA via di accesso alla lista (il client non fa
-- SELECT diretto sulla tabella per la ricerca).
CREATE OR REPLACE FUNCTION search_maestranze(
  p_provincia varchar DEFAULT NULL,
  p_skill_ids uuid[] DEFAULT NULL,
  p_min_esperienza smallint DEFAULT NULL,
  p_seed float DEFAULT 0.5,       -- seed di sessione dal client
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) RETURNS SETOF maestranze_profiles
LANGUAGE sql SECURITY INVOKER    -- INVOKER: RLS resta attiva. Lezione SEC.
SET search_path = public
AS $$
  SELECT mp.* FROM maestranze_profiles mp
  WHERE mp.is_published
    AND mp.anonymized_at IS NULL
    -- Filtro raggio CORRETTO (v1.0 era sbagliato e lo ammetteva in nota: una
    -- maestranza REGIONE di Milano compariva nelle ricerche di Catanzaro).
    -- Semantica: la maestranza compare se la provincia cercata è raggiungibile
    -- dal suo raggio dichiarato.
    AND (p_provincia IS NULL OR CASE mp.raggio_disponibilita
          WHEN 'NAZIONALE' THEN true
          WHEN 'REGIONE'   THEN (SELECT pr.regione FROM province_regioni pr
                                  WHERE pr.provincia = mp.provincia)
                              = (SELECT pr.regione FROM province_regioni pr
                                  WHERE pr.provincia = p_provincia)
          ELSE mp.provincia = p_provincia
        END)
    AND (p_min_esperienza IS NULL OR mp.anni_esperienza >= p_min_esperienza)
    AND (p_skill_ids IS NULL OR EXISTS (
      SELECT 1 FROM maestranze_profile_skills ps
      WHERE ps.profile_id = mp.id AND ps.skill_id = ANY(p_skill_ids)))
  ORDER BY md5(mp.id::text || p_seed::text)   -- casuale stabile per sessione
  LIMIT p_limit OFFSET p_offset;
$$;
```

**Nota per Claude Code:** `SECURITY INVOKER` è deliberato — la RPC non deve bypassare RLS (lezione della vulnerabilità `suggest_alternatives_full`). L'`ORDER BY md5(...)` costa un full scan + sort a ogni ricerca: a 500 maestranze (target M12 del business plan) è irrilevante; oltre le ~50.000 va rivisto — e comunque **non** introducendo un ordinamento di merito.

### 2.4 [nuovo v1.1] Storage: bucket PRIVATO + signed URL (Correzione 1)

```sql
-- La bacheca è chiusa: le foto NON possono stare su un bucket pubblico.
-- Contro-esempio nel repo (SEC-02, aperto): fb-dish-photos, supplier-assets,
-- event-guest-uploads, floor-plans, post-media, blog-media, album-catalogs sono public=true.
-- Qui NO: sono volti di persone, dato personale, su una bacheca dichiarata chiusa.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('maestranze-photos','maestranze-photos', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Path convenzionale: <profile_id>/<uuid>.<ext> → la prima cartella è l'owner.
CREATE POLICY "maestranza_scrive_propria_foto" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maestranze-photos'
              AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "maestranza_aggiorna_propria_foto" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'maestranze-photos'
         AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "maestranza_elimina_propria_foto" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'maestranze-photos'
         AND (storage.foldername(name))[1] = auth.uid()::text);
-- Lettura: SOLO registrati, e solo di profili pubblicati e non anonimizzati.
CREATE POLICY "foto_leggibili_dai_registrati" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'maestranze-photos' AND EXISTS (
    SELECT 1 FROM maestranze_profiles mp
    WHERE mp.id::text = (storage.foldername(name))[1]
      AND mp.anonymized_at IS NULL
      AND (mp.is_published OR mp.id = auth.uid())));
```

**Lato client:** `photo_path` è un path, non un URL. La UI chiede una signed URL (`createSignedUrl`, TTL 1 ora) al momento del render. **Mai** `getPublicUrl` in questo modulo: se compare, è un bug di sicurezza, non una scorciatoia — e §8 lo verifica con un test.

### 2.5 [nuovo v1.1] Diritto all'oblio senza DELETE (Correzione 4)

La tensione è reale e va risolta in modo esplicito: la dichiarazione di regime **deve** sopravvivere (è la prova che abbiamo fatto il nostro dovere, principio 7), l'utente **ha diritto** a sparire. Un `DELETE` non può fare entrambe le cose — e con le FK di v1.0 non poteva fare nemmeno la prima (falliva e basta).

```sql
-- Cancellazione = anonimizzazione. Il profilo esce da ricerca, foto e chat;
-- restano le righe probatorie, private dei dati identificativi.
CREATE OR REPLACE FUNCTION maestranza_anonymize(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE maestranze_profiles SET
    display_name = 'Profilo rimosso', photo_path = NULL, bio = NULL,
    fascia_prezzo = NULL, disponibilita_note = NULL,
    is_published = false, anonymized_at = now()
  WHERE id = p_id;
  DELETE FROM maestranze_profile_skills WHERE profile_id = p_id;
  -- Le foto vanno rimosse dallo storage dalla EF che chiama questa RPC.
  -- Dichiarazioni, contatti e feedback RESTANO: non contengono più dati identificativi
  -- una volta anonimizzato il profilo che li lega a una persona.
END $$;
```

**[DECISIONE 6, §9]** — quanto a lungo conservare le dichiarazioni anonimizzate, e se l'anonimizzazione basti come "cancellazione" ai fini GDPR quando la finalità è probatoria: è una domanda per il legale, insieme a quella sull'intermediazione. Il codice qui sopra implementa la risposta più conservativa (conserva); se il parere dice diverso, cambia una funzione, non lo schema.

---

## 3. RLS

```sql
ALTER TABLE maestranze_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_admin_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestranze_private_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE province_regioni ENABLE ROW LEVEL SECURITY;

-- Lookup province: sola lettura per i registrati (serve ai filtri UI)
CREATE POLICY "province_lettura_registrati" ON province_regioni
  FOR SELECT TO authenticated USING (true);

-- Profili: la bacheca è CHIUSA. Solo utenti autenticati vedono i profili
-- pubblicati. MAI il ruolo anon.
CREATE POLICY "bacheca_solo_registrati" ON maestranze_profiles
  FOR SELECT TO authenticated
  USING ((is_published AND anonymized_at IS NULL) OR id = auth.uid());

CREATE POLICY "maestranza_gestisce_proprio_profilo" ON maestranze_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Dichiarazioni: INSERT solo proprio, SELECT solo proprio + admin.
-- Nessun UPDATE/DELETE per nessuno (immutabilità = valore probatorio).
CREATE POLICY "dichiarazione_insert_propria" ON maestranze_declarations
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "dichiarazione_select_propria_o_admin" ON maestranze_declarations
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

-- Contatti: visibili solo alle due parti
CREATE POLICY "contatto_solo_parti" ON maestranze_contacts
  FOR SELECT TO authenticated
  USING (maestranza_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY "contatto_crea_richiedente" ON maestranze_contacts
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND maestranza_id <> auth.uid());

-- Chat: solo le parti del contatto. L'admin NON è parte e NON legge da qui:
-- l'accesso al contenuto flaggato passa dalla RPC tracciata sotto (Correzione 3).
CREATE POLICY "chat_solo_parti" ON maestranze_chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM maestranze_contacts c
                 WHERE c.id = contact_id
                   AND (c.maestranza_id = auth.uid()
                        OR c.requester_id = auth.uid())));
CREATE POLICY "chat_scrive_parte" ON maestranze_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM maestranze_contacts c
    WHERE c.id = contact_id
      AND (c.maestranza_id = auth.uid() OR c.requester_id = auth.uid())));

-- Flag moderazione: SOLO admin in lettura. Scrittura solo service_role (EF-2).
CREATE POLICY "flags_solo_admin" ON maestranze_moderation_flags
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "flags_admin_review" ON maestranze_moderation_flags
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Regole keyword: admin legge/scrive, EF-2 (service_role) legge bypassando RLS
CREATE POLICY "regole_solo_admin" ON maestranze_moderation_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Log accessi: l'admin vede il registro, nessuno lo modifica dal client
CREATE POLICY "log_lettura_admin" ON maestranze_admin_access_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- Feedback: solo le due parti del contatto, MAI aggregabile da terzi
CREATE POLICY "feedback_solo_parti" ON maestranze_private_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM maestranze_contacts c
                 WHERE c.id = contact_id
                   AND (c.maestranza_id = auth.uid()
                        OR c.requester_id = auth.uid())));
CREATE POLICY "feedback_scrive_parte" ON maestranze_private_feedback
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM maestranze_contacts c
    WHERE c.id = contact_id
      AND (c.maestranza_id = auth.uid() OR c.requester_id = auth.uid())));
```

### 3.1 [nuovo v1.1] Accesso admin al messaggio flaggato — puntuale e tracciato

```sql
-- L'admin deve poter leggere IL messaggio flaggato per decidere, e nient'altro.
-- Ogni lettura lascia una traccia: è la contropartita del potere.
CREATE OR REPLACE FUNCTION admin_read_flagged_message(p_flag_id uuid)
RETURNS TABLE (message_id uuid, body text, sender_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT f.message_id INTO v_msg FROM maestranze_moderation_flags f WHERE f.id = p_flag_id;
  IF v_msg IS NULL THEN RAISE EXCEPTION 'flag not found'; END IF;
  INSERT INTO maestranze_admin_access_log (admin_id, message_id, flag_id)
  VALUES (auth.uid(), v_msg, p_flag_id);
  RETURN QUERY SELECT m.id, m.body, m.sender_id, m.created_at
               FROM maestranze_chat_messages m WHERE m.id = v_msg;
END $$;
REVOKE ALL ON FUNCTION admin_read_flagged_message(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_read_flagged_message(uuid) TO authenticated;
```

Questa è l'**unica** eccezione al principio 6 (metadati sì, contenuti no), è limitata al singolo messaggio già flaggato dal sistema, ed è tracciata. Va dichiarata in informativa insieme a EF-2: un accesso umano non dichiarato sarebbe peggio del flag automatico, perché il flag almeno è una macchina.

**Punto critico anti-`suggest_alternatives_full`:** nessuna policy usa `TO anon`. La Definition of Done include il test di impersonazione anonima su ogni tabella, sulla RPC di ricerca **e sul bucket storage**: tutte devono restituire zero righe/403 al ruolo `anon`.

---

## 4. EDGE FUNCTIONS

### EF-1 · `maestranze-contact-reminder` (STRATO LEGALE 4)
- Trigger via pg_net su INSERT `maestranze_contacts`
- Invia a **entrambe** le parti l'email promemoria regolarizzazione (template dedicato, tono sartoriale ma contenuto formale — testo da validare col legale)
- UPDATE `reminder_sent_at`
- Idempotente: se `reminder_sent_at` non è null, esce
- **Nota v1.1:** il repo invia via **SES** (`supabase/functions/_shared/ses.ts` + `emailShell`), non Resend come diceva la v1.0. Riusare `sendEmail` + `emailShell` esistenti.

### EF-2 · `maestranze-chat-scan` (STRATO LEGALE 6b)
- Trigger via pg_net su INSERT `maestranze_chat_messages`
- Confronta il body con `maestranze_moderation_rules` (tabella, §2.1 — mai regex hardcoded)
- Match → INSERT in `maestranze_moderation_flags` con `matched_rule` (mai il testo del messaggio nel flag)
- **Nessuna azione automatica sull'utente**: il flag apre una review umana, non una sospensione. Le sospensioni automatiche su regex sono un disastro annunciato di falsi positivi
- GDPR: questa funzione esiste solo se dichiarata in informativa + LIA documentata. Nel codice, commento con riferimento alla sezione dell'informativa

### EF-3 · `maestranze-publish-guard`
- Validazione server-side alla pubblicazione profilo: dichiarazione presente per la versione T&C corrente, foto presente, provincia valida, almeno 1 competenza
- Senza dichiarazione → `is_published` non può diventare true (enforcement anche via trigger DB, doppia cintura)

### EF-4 · [nuovo v1.1] `maestranze-erase`
- Chiama `maestranza_anonymize` (§2.5) **e** rimuove gli oggetti da `maestranze-photos` (lo storage non si pulisce da solo)
- Idempotente; se `anonymized_at` è già valorizzato, esce
- È la superficie che rende vera la promessa GDPR del business plan §5.3

Quattro funzioni, tutte piccole. La semplicità qui è una feature legale.

---

## 5. UI

### 5.0 [nuovo v1.1] Integrazione col routing esistente (Correzione 2)

**Verificato** in `frontend/src/components/auth/RequireAuth.tsx` — senza queste modifiche il modulo non funziona, a prescindere dal resto:

1. **`homeFor()` (righe 14-18):** aggiungere `if (role === 'MAESTRANZA') return '/maestranze/profilo'`. Senza, la maestranza viene rimbalzata sulla dashboard capostipite.
2. **Gate onboarding (righe 47-48):** aggiungere `&& profile.role !== 'MAESTRANZA'` all'elenco delle esclusioni. Senza, la maestranza viene forzata sul questionario di profilazione dei professionisti (che non la riguarda) e il wizard di §5.1 non parte mai.
3. **Confinamento (pattern `FOTOLAB`, righe 55-59):** la maestranza vive in `/maestranze/*` + `/profile`. Non deve vedere `/weddings`, `/quotes`, la sidebar capostipite. È il pattern già usato per FOTOLAB: copiarlo, non inventarne uno.

**Assegnazione del ruolo — trappola SEC-01.** Il lock `trg_lock_profile_privileged` (`20260707180000`, BEFORE UPDATE su `profiles`) fa `new.role := old.role` per chiunque non sia admin o service_role e non abbia il flag transazionale `sec.privileged_write`. Conseguenza: **se il ruolo `MAESTRANZA` viene assegnato con un UPDATE post-signup dal client, viene silenziosamente revertito — senza errore.** È la stessa classe del bug "verificato che sparisce". Il ruolo va scritto **all'INSERT del profilo** (il lock è solo BEFORE UPDATE), oppure da una RPC che faccia `set_config('sec.privileged_write','on',true)` dopo aver verificato l'autorizzazione.

### 5.1 Flusso maestranza (chi si iscrive)

1. **Signup** → ruolo MAESTRANZA assegnato **all'insert** (vedi §5.0) → wizard profilo (3 step: dati base / competenze / foto)
2. **Step dichiarazione (STRATO LEGALE 2)** — pagina dedicata, non un checkbox nascosto nel form: testo integrale, scelta regime obbligatoria, link T&C e Linee Guida. Il pulsante "Pubblica profilo" vive QUI e solo qui
3. **Profilo pubblicato** → stato visibile ("Il tuo profilo è in bacheca"), possibilità di sospendere visibilità con un toggle (consenso revocabile GDPR: effetto immediato)
4. **Inbox chat** — thread per contatto ricevuto
5. **[nuovo v1.1] "Elimina il mio profilo"** → EF-4 (§2.5): la revoca del consenso è un toggle, la cancellazione è un'altra cosa e va offerta esplicitamente

### 5.2 Flusso capostipite/fornitore (chi cerca)

1. **Bacheca** `/maestranze` — filtri: provincia (default: la propria), competenza (multiselect), esperienza minima. Card: foto (signed URL, §2.4), nome, competenze, zona, esperienza. **Ordine casuale di sessione, con etichetta esplicita "Risultati in ordine casuale"** — la trasparenza sull'ordinamento è parte della difesa legale e del posizionamento
2. **Profilo maestranza** — tutto il dichiarato + banner permanente (STRATO LEGALE 1): "Profilo autodichiarato, non verificato da Planfully. La regolarizzazione del rapporto di lavoro è responsabilità delle parti. → Linee Guida"
3. **Pulsante "Contatta"** → crea `maestranze_contacts` → apre chat → parte EF-1
4. **Post-lavoro** — da un contatto esistente, entrambe le parti possono lasciare feedback privato (visibile solo all'altra parte)

### 5.3 Admin

- `/admin/maestranze/flags` — coda flag OPEN; il contenuto del messaggio si apre **via `admin_read_flagged_message`** (§3.1), che lo traccia. Azioni: OK / richiama utente / sospendi profilo
- `/admin/maestranze/rules` — regole keyword (§2.1), modificabili senza deploy
- `/admin/maestranze/skills` — gestione vocabolario competenze (pattern identico a service_categories)

### 5.4 Copy legale in UI (STRATO LEGALE 1 — testi placeholder, valida il legale)

- Footer di ogni pagina del modulo: "Planfully è una bacheca informativa. Non siamo un'agenzia per il lavoro e non intermediamo rapporti di lavoro."
- Empty state bacheca: stesso disclaimer + CTA Linee Guida
- Primo messaggio di ogni chat: messaggio di sistema automatico non cancellabile con promemoria regolarizzazione

---

## 6. COSA NON C'È IN V1 (esplicito, per resistere allo scope creep)

| Fuori | Perché | Quando (se mai) |
|---|---|---|
| Matching/suggerimenti | Vincolo legale, principio 1-2 | Solo con parere legale esplicito |
| Rating pubblici | Vincolo legale | Mai, by design |
| Numero di telefono visibile | Monetizzazione fase 2, condizionata a parere | Fase 2 |
| Abbonamento maestranze | Idem | Fase 2 |
| Annunci di lavoro pubblicati dai capostipiti ("cerco 4 camerieri il 12/9") | Inverte la direzione della bacheca e si avvicina di più all'annuncio di lavoro ex art. 9 D.Lgs. 276/2003 (obblighi specifici) | v2, con parere dedicato |
| Notifiche push nuove maestranze in zona | È un suggerimento travestito | Da valutare |
| Calendario disponibilità strutturato | Complessità non giustificata al lancio; il campo note basta | v2 |
| **Chat realtime** | **[nuovo v1.1]** Non esiste in questo progetto: la chat attuale fa polling 15s (§0.2 Correzione 5). Costruirlo qui sarebbe il primo del repo | v2, se la latenza dà davvero fastidio |

---

## 7. BUILD PHASES E STIME

| Fase | Contenuto | Ore | v1.0 |
|---|---|---|---|
| **M-0** | **[nuovo]** `alter type user_role add value 'MAESTRANZA'` in migration DEDICATA (§2.0) | **0,5** | — |
| M-1 | Schema + indici + `province_regioni` (+ seed 107 province) + trigger publish-guard + seed skills standard + `maestranza_anonymize` | 8 | 6 |
| M-2 | RLS complete + test impersonazione (authenticated, anon, admin, parti/non-parti) + policy storage | 7 | 6 |
| M-3 | RPC `search_maestranze` con filtro regione corretto (§2.3) | 4 | 4 |
| **M-3b** | **[nuovo]** Bucket privato + signed URL lato client + rimozione oggetti (§2.4) | **3** | — |
| M-4 | EF-1 contact-reminder + template email (SES, non Resend) | 4 | 4 |
| M-5 | EF-2 chat-scan + tabella regole + admin flags + RPC tracciata (§3.1) + admin rules UI | 7 | 6 |
| M-6 | UI wizard signup maestranza + step dichiarazione | 8 | 8 |
| **M-6b** | **[nuovo]** Integrazione RequireAuth/homeFor/confinamento + ruolo all'insert (§5.0) | **2** | — |
| M-7 | UI bacheca + filtri + profilo pubblico | 8 | 8 |
| M-8 | UI chat interna — **riuso `ChatEvento.tsx` (polling 15s)**, non realtime | 8 | 8 |
| M-9 | UI feedback privato + admin skills | 4 | 4 |
| **M-9b** | **[nuovo]** EF-4 erase + UI "elimina profilo" (§2.5) | **3** | — |
| M-10 | Test e2e Playwright: iscrizione→pubblicazione→ricerca→contatto→chat→feedback; test negativo anon (righe **e storage**); flag moderazione; anonimizzazione | 5 | 4 |
| **Totale** | | **~70** | 58 |

Le 12 ore in più non sono scope creep: **11,5 sono cose che la v1.0 dava per fatte e non lo erano** (enum, province_regioni, storage privato, routing del ruolo, cancellazione GDPR, accesso admin alla chat), e mezz'ora è la migration dell'enum. Meglio scoprirlo qui che a M-7.

Sequenza vincolata: **M-0 → M-1 → M-2 → M-3 prima di qualsiasi UI**. M-2 non si chiude senza i test di impersonazione verdi. M-6b va fatto prima di M-6, o il wizard non è raggiungibile e si debugga a vuoto.

---

## 8. DEFINITION OF DONE

- [ ] `anon` non vede NULLA: zero righe da ogni tabella e dalla RPC (test SQL di impersonazione)
- [ ] **`anon` non vede nemmeno le FOTO**: richiesta diretta all'oggetto storage senza auth → 403 (test esplicito; è la Correzione 1)
- [ ] **Nessun `getPublicUrl` nel modulo**: solo `createSignedUrl` (test/grep — vedi nota CI sotto)
- [ ] Un authenticated non-parte non legge chat/contatti/feedback altrui (test impersonazione)
- [ ] **L'admin non legge la chat via SELECT diretto** (deve fallire) ma solo via `admin_read_flagged_message`, **e la lettura lascia una riga in `maestranze_admin_access_log`**
- [ ] Profilo non pubblicabile senza dichiarazione per la T&C version corrente (test trigger + EF-3)
- [ ] Dichiarazioni immutabili: UPDATE e DELETE falliscono anche per il proprietario e per admin
- [ ] **Cancellazione profilo: `maestranza_anonymize` esce da ricerca entro 24h, le foto spariscono dallo storage, le dichiarazioni restano** (test §2.5)
- [ ] Ricerca: due sessioni con seed diversi producono ordini diversi; stessa sessione, ordine stabile
- [ ] **Filtro raggio corretto**: una maestranza REGIONE di Milano NON compare cercando in Catanzaro (test sulla RPC — era il bug noto di v1.0)
- [ ] Nessun ORDER BY su colonne di merito in tutta la codebase del modulo
- [ ] Email promemoria parte una e una sola volta per contatto
- [ ] Flag keyword: match → flag creato, nessuna azione automatica sull'utente
- [ ] Copy legale presente in: footer modulo, profilo, primo messaggio chat, step dichiarazione
- [ ] Informativa privacy aggiornata e linkata prima del deploy in produzione — **include EF-2 (flag automatico) e §3.1 (accesso admin tracciato)**. Responsabilità Giovanni/legale, ma il deploy è bloccato senza

**Nota v1.1 sui controlli automatici (Correzione 6):** la v1.0 affidava il grep anti-ranking a una "CI". **Verificato: non esiste `.github/workflows/`, non c'è CI in questo progetto.** I due check di grep (`ORDER BY` di merito, `getPublicUrl`) vanno quindi scritti come **test Vitest** in `frontend/src/**/*.test.ts` — leggono i sorgenti del modulo e falliscono su match. Vitest c'è già ed è l'unico posto dove oggi un controllo gira davvero (`npm run test`). Un vincolo architetturale che nessuno esegue non è un vincolo.

---

## 9. [DECISIONE] — DA CHIUDERE PRIMA DEL BUILD

1. **Vocabolario competenze standard iniziale** — propongo di derivarlo dalle categorie del Rapporto sul lavoro invisibile (coerenza narrativa e dati già in raccolta). Lista da approvare.
2. **Testo esatto della checkbox dichiarazione** — bozza mia → validazione giuslavorista → freeze. Bloccante per M-6.
3. **Regole keyword iniziali per EF-2** — chi le scrive? Propongo: bozza mia di 10-15 regole, review legale, e admin UI per evolverle senza deploy (tabella `maestranze_moderation_rules`, §2.1).
4. **La bacheca è visibile ai fornitori free o solo ai paganti In Pancia?** — propongo: visibile a tutti i registrati (la bacheca piena è il motore del valore percepito; chiuderla ai free la svuota). Da confermare.
5. **Le maestranze vedono gli altri profili maestranze?** — propongo di sì (trasparenza, e comunque il valore non è segretezza). Da confermare.
6. **[nuova v1.1] Cancellazione: anonimizzazione basta?** (§2.5) Le dichiarazioni devono sopravvivere per valore probatorio, l'utente ha diritto a sparire: l'anonimizzazione tiene insieme le due cose, ma **è una domanda per il giuslavorista/privacy, da fare nella stessa lettera** dell'intermediazione — non una seconda consulenza. Con quanta retention sulla dichiarazione anonimizzata? Il codice implementa la risposta conservativa (conserva a tempo indeterminato); se il parere dice diverso, cambia una funzione.
7. **[nuova v1.1] Chat: polling 15s o realtime?** (§0.2 Correzione 5) Propongo **polling**, riusando `ChatEvento.tsx`: 15s di latenza su una chat dove ci si accorda per un ingaggio non sono un problema, e il realtime sarebbe il primo del repo (+6h, nuovo pattern da mantenere). Da confermare, perché è una scelta di prodotto, non tecnica.
8. **[nuova v1.1] SEC-02 entra nello scope o resta prerequisito?** (§0.2 Correzione 1) Propongo: il bucket `maestranze-photos` nasce **privato** dentro questo modulo (M-3b, già in stima), **indipendentemente** da quando si sistemano i 7 bucket pubblici esistenti. Non aspettare SEC-02 per fare la cosa giusta su un bucket nuovo — e non usarlo come scusa per rimandarla.

---

*PRP v1.1 — congelato dietro gate. Build subordinato a: chiusura blocker SEC-00/staging (SEC-02 vedi [DECISIONE] 8). Lancio subordinato a: parere giuslavorista. Documento pronto per Claude Code una volta chiuse le [DECISIONE] 1-8. Verifiche di §0.2 eseguite contro il repo il 17/07/2026: se il codice citato cambia, ri-verificare prima di eseguire.*
