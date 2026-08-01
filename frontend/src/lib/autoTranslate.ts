// Auto-traduzione dell'INTERA UI a runtime. Quando la lingua scelta non e' italiano, traduciamo i
// testi visibili (nodi di testo + attributi placeholder/title/aria-label/alt) nella lingua scelta.
// Cache a 3 livelli: memoria → localStorage → cache server condivisa (ui_translations) → AI (edge
// ui-translate) per le stringhe nuove. NON traduciamo dati sensibili: numeri, valute (€), email,
// URL, telefoni; e saltiamo input/textarea, code/pre, e le zone marcate [data-notranslate]/translate="no".
import { supabase } from '@/lib/supabase'

export const AUTO_LANGS = ['en', 'es', 'fr', 'de'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'CANVAS', 'IFRAME', 'INPUT'])
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']

const mem: Record<string, Map<string, string>> = {}
const memOf = (lang: string) => (mem[lang] ??= new Map())

const lsKey = (lang: string) => `pf_i18n_${lang}`
function loadLS(lang: string) {
  try { const raw = localStorage.getItem(lsKey(lang)); if (raw) { const o = JSON.parse(raw) as Record<string, string>; const m = memOf(lang); for (const k in o) m.set(k, o[k]!) } } catch { /* ignore */ }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSaveLS(lang: string) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { try { const o: Record<string, string> = {}; memOf(lang).forEach((v, k) => { if (v) o[k] = v }); localStorage.setItem(lsKey(lang), JSON.stringify(o)) } catch { /* ignore */ } }, 1200)
}

// Stringhe da NON tradurre (dati, non interfaccia).
function skipText(s: string): boolean {
  const t = s.trim()
  if (t.length < 2) return true
  if (!/[A-Za-zÀ-ÿ]/.test(t)) return true            // nessuna lettera → numeri/€/simboli
  if (/^\S+@\S+\.\S+$/.test(t)) return true           // email
  if (/^https?:\/\//i.test(t)) return true            // URL
  if (/^[+\d][\d\s().\/-]{5,}$/.test(t)) return true  // telefono/IBAN-like
  return false
}

function skippableAncestor(node: Node): boolean {
  let el: Element | null = node.parentElement
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.getAttribute?.('translate') === 'no' || el.hasAttribute?.('data-notranslate')) return true
    if ((el as HTMLElement).isContentEditable) return true
    el = el.parentElement
  }
  return false
}

const origText = new WeakMap<Text, string>()
const origAttr = new WeakMap<Element, Record<string, string>>()
const translatedNodes = new Set<Text>()
const translatedAttrEls = new Set<Element>()

let curLang = 'it'
let observer: MutationObserver | null = null
let flushTimer: ReturnType<typeof setTimeout> | undefined

// Legge cache server + traduce le mancanti con l'AI (edge). Popola la memoria.
async function ensureTranslations(lang: string, sources: string[]) {
  const m = memOf(lang)
  const need = sources.filter((s) => !m.get(s))
  if (!need.length) return
  try {
    const { data } = await (supabase.rpc as any)('get_ui_translations', { p_lang: lang, p_sources: need })
    const got = (data ?? {}) as Record<string, string>
    for (const k in got) m.set(k, got[k]!)
  } catch { /* ignore */ }
  const still = need.filter((s) => !m.get(s))
  for (let i = 0; i < still.length; i += 100) {
    const chunk = still.slice(i, i + 100)
    try {
      const { data } = await supabase.functions.invoke('ui-translate', { body: { lang, texts: chunk } })
      const map = ((data as { map?: Record<string, string> } | null)?.map) ?? {}
      for (const k in map) m.set(k, map[k]!)
    } catch { /* ignore */ }
  }
  scheduleSaveLS(lang)
}

function withObserverPaused(fn: () => void) {
  const o = observer
  o?.disconnect()
  try { fn() } finally { if (o && curLang !== 'it') o.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }) }
}

async function translatePass() {
  if (curLang === 'it') return
  const lang = curLang
  // 1) raccogli i nodi di testo e gli attributi tradotti
  const nodes: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const tn = n as Text
    if (skippableAncestor(tn)) continue
    const orig = origText.get(tn) ?? tn.nodeValue ?? ''
    if (skipText(orig)) continue
    if (!origText.has(tn)) origText.set(tn, orig)
    nodes.push(tn)
  }
  const attrTargets: { el: Element; attr: string; val: string }[] = []
  document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach((el) => {
    if (skippableAncestor(el)) return
    for (const a of ATTRS) {
      const cur = el.getAttribute(a)
      if (!cur || skipText(cur)) continue
      const store = origAttr.get(el) ?? {}
      if (!(a in store)) { store[a] = cur; origAttr.set(el, store) }
      attrTargets.push({ el, attr: a, val: store[a]! })
    }
  })
  // 2) assicura le traduzioni
  const need = new Set<string>()
  const m = memOf(lang)
  for (const tn of nodes) { const o = origText.get(tn)!; if (!m.get(o)) need.add(o) }
  for (const at of attrTargets) { if (!m.get(at.val)) need.add(at.val) }
  if (need.size) await ensureTranslations(lang, [...need])
  if (curLang !== lang) return // lingua cambiata durante l'attesa
  // 3) applica (in pausa dall'observer per non rientrare)
  withObserverPaused(() => {
    for (const tn of nodes) { const o = origText.get(tn)!; const tr = m.get(o); if (tr && tn.nodeValue !== tr) { tn.nodeValue = tr; translatedNodes.add(tn) } }
    for (const at of attrTargets) { const tr = m.get(at.val); if (tr && at.el.getAttribute(at.attr) !== tr) { at.el.setAttribute(at.attr, tr); translatedAttrEls.add(at.el) } }
  })
}

function scheduleFlush() {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { void translatePass() }, 300)
}

function startObserver() {
  if (observer) return
  observer = new MutationObserver(() => scheduleFlush())
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}
function stopObserver() { observer?.disconnect(); observer = null }

function restoreItalian() {
  stopObserver()
  translatedNodes.forEach((tn) => { const o = origText.get(tn); if (o != null && tn.isConnected) tn.nodeValue = o })
  translatedNodes.clear()
  translatedAttrEls.forEach((el) => { const store = origAttr.get(el); if (store && el.isConnected) for (const a in store) el.setAttribute(a, store[a]!) })
  translatedAttrEls.clear()
}

// API pubblica: imposta la lingua di visualizzazione.
export function setAutoLang(lang: string) {
  curLang = lang
  if (lang === 'it') { restoreItalian(); return }
  loadLS(lang)
  startObserver()
  void translatePass()
}
