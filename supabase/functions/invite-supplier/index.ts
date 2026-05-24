// deno-lint-ignore-file no-explicit-any
// Invita un fornitore via email.
// Caller deve essere autenticato (capostipite). JWT obbligatorio.
//
// Flow:
// 1) Verifica caller → capostipite_id = caller.uid
// 2) Se email esiste già in auth.users come FORNITORE → crea collaboration PENDING (no email)
// 3) Altrimenti → crea record supplier_invites + Supabase auth.admin.inviteUserByEmail
//    con user_metadata { role: FORNITORE, invite_token, subrole?, invited_by }
//    redirect a /onboarding (wizard fornitore).
//
// POST { email, subrole?, message? } -> { ok, mode: 'collab_direct' | 'email_sent', invite_id? }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Address only (es. noreply@planfully.it OR onboarding@resend.dev se non ancora verificato)
const RESEND_FROM_ADDR = (Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <onboarding@resend.dev>')
  .replace(/^.*</, '').replace(/>$/, '')

// Preset messaggio per subrole — copy professionale, italiano, brand-friendly
const SUBROLE_PRESET: Record<string, { greeting: string; whatToDo: string[] }> = {
  fotografo: {
    greeting: 'Come fotografo, sarai in prima linea per raccontare il giorno più importante dei nostri sposi.',
    whatToDo: [
      'Carica 3-5 servizi (full day, reportage, album, riprese drone…)',
      'Aggiungi foto del tuo portfolio: 4-6 scatti rappresentativi per servizio',
      'Imposta le tue date di disponibilità (verde/giallo/rosso)',
      'Indica il tuo "work style" (reportage, ritratto, fine-art…) così il planner ti propone solo coppie compatibili',
    ],
  },
  videomaker: {
    greeting: 'Il video resta nel tempo come la foto — sei tu a costruire il ricordo in movimento.',
    whatToDo: [
      'Crea pacchetti video (highlight 3min, full ceremony, reel social)',
      'Aggiungi anteprime video o frame estratti dai tuoi lavori',
      'Comunica la tua disponibilità sulle prossime stagioni 2027-2028',
      'Specifica attrezzatura e team (drone, gimbal, secondo operatore)',
    ],
  },
  fioraio: {
    greeting: 'I fiori definiscono l\'atmosfera del matrimonio — il tuo lavoro fa la differenza visiva.',
    whatToDo: [
      'Crea i tuoi servizi (bouquet, centrotavola, allestimenti, archi)',
      'Aggiungi foto degli allestimenti realizzati negli anni',
      'Usa il calcolatore composizione per stimare al volo cesti/centrotavola',
      'Dichiara la stagionalità: che fiori puoi garantire in che periodo',
    ],
  },
  catering: {
    greeting: 'Il momento del pranzo è l\'esperienza più ricordata — gli ospiti ne parlano per mesi.',
    whatToDo: [
      'Carica i tuoi menù (base, deluxe, vegano/veg, allergie)',
      'Aggiungi foto food styling e mise en place',
      'Imposta i prezzi per persona e i supplementi (open bar, pesce, dolce)',
      'Comunica le date già impegnate per evitare doppie prenotazioni',
    ],
  },
  pasticcere: {
    greeting: 'La torta nuziale è l\'apoteosi visiva della festa — un\'opera che racconta gli sposi.',
    whatToDo: [
      'Carica i tuoi cake design (3 piani, naked cake, drip, sugar art)',
      'Aggiungi anche confettata, sweet table, mignon',
      'Foto delle torte realizzate (almeno 6-8 referenze)',
      'Indica eventuali certificazioni (gluten-free, halal, kosher)',
    ],
  },
  musica: {
    greeting: 'Tu fai ballare gli ospiti fino all\'alba — sei il custode del clima della festa.',
    whatToDo: [
      'Crea i tuoi pacchetti (DJ set, band cerimonia, archi aperitivo)',
      'Aggiungi link audio/video di tue performance',
      'Indica strumentazione e durata (ore di lavoro, pause)',
      'Comunica disponibilità sui weekend chiave 2027',
    ],
  },
  allestimenti: {
    greeting: 'Gli allestimenti trasformano una sala in scenografia — tu costruisci il "wow effect".',
    whatToDo: [
      'Crea pacchetti (sedute, tavoli, tovagliato, lighting, lounge)',
      'Foto delle ambientazioni realizzate per ispirare il planner',
      'Indica metratura e capacità (50-300 ospiti)',
      'Specifica i materiali (Chiavarine, Tiffany, vintage, gold/cromo…)',
    ],
  },
  make_up: {
    greeting: 'Sei il primo professionista che la sposa incontra il giorno-X — definisci il suo viso e la sua sicurezza.',
    whatToDo: [
      'Crea servizi beauty (prova + giorno, anche damigelle, mamme)',
      'Foto del tuo lavoro su spose reali (before/after o ritratto finale)',
      'Indica i brand di cosmetica che usi (alta gamma)',
      'Comunica disponibilità per prove e date matrimonio',
    ],
  },
  abiti: {
    greeting: 'L\'abito è il simbolo del giorno — la tua boutique è il primo sogno che si concretizza.',
    whatToDo: [
      'Carica capi e linee disponibili (boutique multimarca o couture)',
      'Foto degli abiti su modella o su spose reali',
      'Indica tempi di consegna e prove (60-90gg)',
      'Specifica servizi inclusi (sartoria, prove illimitate, accessori)',
    ],
  },
  location: {
    greeting: 'Sei la cornice del matrimonio — tutto inizia e finisce nella tua location.',
    whatToDo: [
      'Crea pacchetti per stagione (alta/bassa, infrasettimanale/weekend)',
      'Foto degli ambienti interni ed esterni',
      'Specifica capacità massima ospiti e servizi inclusi (ristorazione interna?)',
      'Carica planimetria, regolamento, listino bevande',
    ],
  },
  auto: {
    greeting: 'L\'arrivo della sposa è un momento iconico — la tua auto è la cornice di quella foto.',
    whatToDo: [
      'Carica i veicoli disponibili (vintage, lusso, sportive)',
      'Foto delle auto e di addobbi pre-impostati',
      'Indica km inclusi, tempo a disposizione, autista in livrea',
      'Disponibilità per le date primaverili/estive',
    ],
  },
  animazione: {
    greeting: 'L\'intrattenimento durante l\'aperitivo o per i bambini cambia il ritmo dell\'evento.',
    whatToDo: [
      'Crea servizi (mago, bolle giganti, mascotte, baby parking)',
      'Foto/video delle performance',
      'Durata e fascia oraria (aperitivo, taglio torta, kids zone)',
      'Indica se sei coperto da assicurazione RC',
    ],
  },
  celebrante: {
    greeting: 'Tu officiui il momento più solenne — le tue parole restano per sempre.',
    whatToDo: [
      'Specifica il tipo (rito civile, simbolico, multiculturale, religioso)',
      'Carica eventuali scritti / testimonianze passate',
      'Indica lingue parlate e disponibilità a viaggiare',
      'Comunica modalità (in presenza, online per ospiti lontani)',
    ],
  },
  wedding_planner: {
    greeting: 'Sei un collega: insieme costruiamo una rete di planner indipendenti, non un marketplace.',
    whatToDo: [
      'Compila bio e portfolio (matrimoni realizzati)',
      'Indica zona di lavoro principale + disponibilità a destination',
      'Specifica formule (full planning, day coordinator, consulenza)',
      'Carica testimonianze di sposi precedenti',
    ],
  },
}

function presetFor(subrole: string | null | undefined): { greeting: string; whatToDo: string[] } {
  const key = (subrole ?? '').toLowerCase().replace(/-/g, '_')
  return SUBROLE_PRESET[key] ?? {
    greeting: 'Entrare nel network ti permette di collaborare con i wedding planner che già ti conoscono e di organizzare la tua disponibilità.',
    whatToDo: [
      'Compila il tuo profilo (bio, città, stile di lavoro)',
      'Carica almeno 3 servizi con foto di portfolio',
      'Imposta la tua disponibilità sul calendario',
      'Verifica i dati fiscali per generare contratti corretti',
    ],
  }
}

async function sendInviteEmail(args: {
  to: string
  acceptUrl: string
  inviterName: string         // "Sara De Luca"
  inviterBusiness: string | null
  inviterEmail: string | null // Reply-to
  customMessage: string | null
  subrole: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' }
  const preset = presetFor(args.subrole)
  const inviterLabel = args.inviterBusiness
    ? `${args.inviterName} · ${args.inviterBusiness}`
    : args.inviterName

  const stepsHtml = preset.whatToDo
    .map((s, i) => `<li style="margin:0 0 8px;padding-left:8px"><span style="color:#C49A5C;font-weight:600">${i + 1}.</span> ${escapeHtml(s)}</li>`)
    .join('')

  const html = `<!doctype html>
<html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f4ef;margin:0;padding:32px;color:#1A2E4F">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#1A2E4F 0%,#C49A5C 100%);padding:32px;text-align:center;color:#fff">
    <h1 style="margin:0;font-size:28px;font-weight:600;letter-spacing:-0.02em">Planfully</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:13px">Network indipendente per il wedding italiano</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 4px;font-size:13px;color:#a0aec0;text-transform:uppercase;letter-spacing:1px">Invito personale</p>
    <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(args.inviterName)} ti vuole nel suo network</h2>
    <p style="line-height:1.6;font-size:15px;color:#4a5568">
      Ciao, sono <strong>${escapeHtml(inviterLabel)}</strong>. Ti scrivo da Planfully, lo strumento che uso per organizzare i miei matrimoni con i fornitori di fiducia — senza marketplace, senza commissioni sul tuo lavoro.
    </p>
    <p style="line-height:1.6;font-size:15px;color:#4a5568;margin:14px 0">
      ${escapeHtml(preset.greeting)}
    </p>
    ${args.customMessage ? `<div style="margin:20px 0;padding:16px;background:#f6f4ef;border-left:3px solid #C49A5C;border-radius:6px;color:#4a5568;line-height:1.5"><strong style="display:block;font-size:12px;color:#1A2E4F;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Messaggio personale</strong>${escapeHtml(args.customMessage)}</div>` : ''}
    <div style="margin:24px 0 16px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#1A2E4F">Cosa fare dopo aver accettato</h3>
      <ol style="margin:0;padding-left:0;list-style:none;font-size:14px;color:#4a5568;line-height:1.5">
        ${stepsHtml}
      </ol>
    </div>
    <div style="margin:28px 0;text-align:center">
      <a href="${args.acceptUrl}" style="display:inline-block;background:#C49A5C;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">Accetta l'invito di ${escapeHtml(args.inviterName)}</a>
    </div>
    <p style="font-size:12px;color:#a0aec0;text-align:center;margin:24px 0 0">
      Pulsante che non funziona? Copia questo link:<br>
      <a href="${args.acceptUrl}" style="color:#1A2E4F;word-break:break-all">${args.acceptUrl}</a>
    </p>
    ${args.inviterEmail ? `<p style="font-size:12px;color:#a0aec0;text-align:center;margin:16px 0 0">Puoi rispondere a questa email per parlare direttamente con ${escapeHtml(args.inviterName)} (${escapeHtml(args.inviterEmail)}).</p>` : ''}
  </div>
  <div style="background:#f6f4ef;padding:20px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0">
    Un progetto Fuyue Srl · planfully.it
  </div>
</div>
</body></html>`

  // FROM: "Nome Cognome · via Planfully <noreply@planfully.it>"
  // Reply-to = email reale del WP (così risposte vanno a lui, non a noreply)
  const fromLabel = args.inviterBusiness
    ? `${args.inviterName} via Planfully`
    : `${args.inviterName} via Planfully`
  const from = `${fromLabel} <${RESEND_FROM_ADDR}>`

  const body: Record<string, unknown> = {
    from,
    to: [args.to],
    subject: `${args.inviterName} ti invita su Planfully (${preset.greeting.split('—')[0].trim().slice(0, 40)}…)`,
    html,
  }
  if (args.inviterEmail) body.reply_to = args.inviterEmail

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const t = await r.text()
      return { ok: false, error: `Resend HTTP ${r.status}: ${t.slice(0, 400)}` }
    }
    const j = await r.json()
    return { ok: true, id: j.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing authorization' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // verifica caller
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: me } = await userClient.auth.getUser()
  if (!me?.user) return json({ error: 'unauthorized' }, 401)
  const callerId = me.user.id

  const body = (await req.json().catch(() => ({}))) as {
    email?: string; subrole?: string; message?: string; skip_email?: boolean
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return json({ error: 'invalid email' }, 400)
  const skipEmail = body.skip_email === true

  // 1. Cerca user esistente per email
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === email)

  if (found) {
    const { data: prof } = await admin.from('profiles').select('id, role').eq('id', found.id).maybeSingle()
    if (!prof) return json({ error: 'profilo non trovato per utente' }, 404)
    if (prof.role !== 'FORNITORE') {
      return json({ error: `utente esiste ma il suo ruolo è ${prof.role}, non FORNITORE` }, 409)
    }
    const { error: e } = await admin.from('collaborations')
      .insert({ capostipite_id: callerId, fornitore_id: prof.id, status: 'PENDING' })
    if (e && !String(e.message).includes('duplicate')) return json({ error: e.message }, 500)
    return json({ ok: true, mode: 'collab_direct' })
  }

  // 2. Crea record supplier_invites
  const { data: invite, error: insErr } = await admin.from('supplier_invites').insert({
    email,
    capostipite_id: callerId,
    subrole_hint: body.subrole ?? null,
    message: body.message ?? null,
  }).select().single()
  if (insErr) {
    const msg = String(insErr.message ?? '').toLowerCase()
    const code = (insErr as { code?: string }).code
    if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
      return json({ error: 'Hai già un invito in sospeso per questa email' }, 409)
    }
    return json({ error: insErr.message }, 500)
  }

  const acceptUrl = `${APP_BASE}/invito-fornitore/${invite.token}`

  if (skipEmail) {
    // Solo link, no email send (WP copia + manda manualmente via WhatsApp/etc)
    return json({ ok: true, mode: 'link_only', invite_id: invite.id, accept_url: acceptUrl, token: invite.token })
  }

  // 3. Email via Resend (NON Supabase auth, perché SES è in sandbox)
  // Recupera nome + email del WP per personalizzare l'email e reply-to
  const { data: inviterProf } = await admin.from('profiles')
    .select('business_name, full_name').eq('id', callerId).maybeSingle()
  const { data: inviterAuth } = await admin.auth.admin.getUserById(callerId)
  const inviterName = inviterProf?.full_name ?? 'Il tuo wedding planner'
  const inviterBusiness = inviterProf?.business_name ?? null
  const inviterEmail = inviterAuth?.user?.email ?? null

  const send = await sendInviteEmail({
    to: email,
    acceptUrl,
    inviterName,
    inviterBusiness,
    inviterEmail,
    customMessage: body.message ?? null,
    subrole: body.subrole ?? null,
  })
  if (!send.ok) {
    return json({
      ok: true, mode: 'email_failed_link_fallback', invite_id: invite.id,
      accept_url: acceptUrl, token: invite.token,
      email_error: send.error,
    })
  }

  return json({
    ok: true, mode: 'email_sent', invite_id: invite.id,
    accept_url: acceptUrl, token: invite.token, email_id: send.id,
  })
})
