#!/usr/bin/env node
/**
 * Resend smoke test (Fase 0 / simulazione completa).
 *
 * - Legge RESEND_API_KEY da .env locale (NON la stampa).
 * - Determina FROM:
 *   - se RESEND_FROM_EMAIL termina con .test o non e' settato → onboarding@resend.dev.
 *   - altrimenti usa RESEND_FROM_EMAIL.
 * - POST a https://api.resend.com/emails con un payload minimale.
 * - Stampa SOLO: status, ok, id, errore (nessuna chiave).
 */

import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = '/Users/giovanniscozzafava/Repository/wedding-platform/.env';

function parseEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function pickFromEmail(env) {
  // Nota: nel .env esiste sia RESEND_FROM_EMAIL sia (per typo) RRESEND_FROM_EMAIL.
  const candidate =
    env.RESEND_FROM_EMAIL ||
    env.RRESEND_FROM_EMAIL ||
    '';
  if (!candidate) return { from: 'onboarding@resend.dev', reason: 'no_from_set' };
  if (/\.test$/i.test(candidate)) return { from: 'onboarding@resend.dev', reason: 'test_tld' };
  if (/wedding-platform\.test/i.test(candidate)) return { from: 'onboarding@resend.dev', reason: 'unverified_local_domain' };
  return { from: candidate, reason: 'env_value' };
}

async function main() {
  const env = parseEnv(ENV_PATH);
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    console.error(JSON.stringify({ ok: false, error: 'RESEND_API_KEY_missing_or_empty' }));
    process.exit(2);
  }

  const { from, reason } = pickFromEmail(env);
  // Nota: Resend in modalita' testing (account senza dominio verificato)
  // consente l'invio SOLO all'indirizzo proprietario dell'account.
  // Il plus-alias `+9999` viene rifiutato con 403. Usiamo l'indirizzo base.
  const to = process.env.RESEND_TEST_TO || 'giovanni.scozzafava@gmail.com';
  const subject = 'Planfully — Resend smoke test';
  const ts = new Date().toISOString();
  const html = `<p>Test consegna dal workflow di simulazione. Timestamp: ${ts}</p>`;

  const body = { from, to, subject, html };

  let status = 0;
  let respJson = null;
  let errText = null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    status = res.status;
    const text = await res.text();
    try {
      respJson = JSON.parse(text);
    } catch {
      errText = text;
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: 'network_error', detail: String(err) }));
    process.exit(3);
  }

  const ok = status >= 200 && status < 300 && respJson && respJson.id;
  const out = {
    ok: Boolean(ok),
    status,
    from,
    from_reason: reason,
    to,
    subject,
    timestamp: ts,
    message_id: respJson?.id || null,
    error: ok ? null : respJson?.message || respJson?.error || errText || `http_${status}`,
  };
  console.log(JSON.stringify(out));
  process.exit(ok ? 0 : 1);
}

main();
