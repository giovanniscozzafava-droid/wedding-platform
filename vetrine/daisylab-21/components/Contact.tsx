'use client'

import { useState } from 'react'
import { brand } from '@/lib/data'

type Status = 'idle' | 'sending' | 'ok' | 'err'

export function Contact() {
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setErrMsg('')
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Errore invio')
      }
      setStatus('ok')
      form.reset()
    } catch (err) {
      setStatus('err')
      setErrMsg(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <section id="contatti" className="py-24">
      <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep mb-4">Contatti</p>
          <h2 className="font-display text-4xl md:text-5xl">Raccontami il vostro matrimonio</h2>
          <div className="mt-6 w-16 h-px bg-gold-deep" />
          <p className="mt-8 text-lg leading-relaxed text-ink-soft">
            Scrivimi data dell&apos;evento, numero di ospiti e i pezzi che ti interessano.
            Rispondo entro 24 ore con un preventivo personalizzato.
          </p>

          <dl className="mt-10 space-y-5 text-sm">
            <div className="flex gap-4">
              <dt className="w-24 text-ink-soft uppercase tracking-wider">Sede</dt>
              <dd>{brand.city}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 text-ink-soft uppercase tracking-wider">Instagram</dt>
              <dd>
                <a href={brand.links.instagram} target="_blank" rel="noopener" className="underline decoration-gold-deep underline-offset-4 hover:text-gold-deep">
                  {brand.links.instagramHandle}
                </a>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 text-ink-soft uppercase tracking-wider">Sito</dt>
              <dd>
                <a href={brand.links.website} target="_blank" rel="noopener" className="underline decoration-gold-deep underline-offset-4 hover:text-gold-deep">
                  daisylab21.it
                </a>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-24 text-ink-soft uppercase tracking-wider">Planner</dt>
              <dd>{brand.capostipite.name} · {brand.capostipite.city}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="bg-cream-2/50 rounded-2xl p-8 border border-ink/5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Nome" name="name" required />
            <Field label="Email" name="email" type="email" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Telefono" name="phone" type="tel" />
            <Field label="Data evento" name="eventDate" type="date" />
          </div>
          <Field label="Numero ospiti" name="guests" type="number" />
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-soft mb-2">Messaggio *</label>
            <textarea
              name="message"
              required
              rows={5}
              className="w-full rounded-xl border border-ink/10 bg-cream px-4 py-3 outline-none focus:border-gold-deep transition-colors"
              placeholder="Cosa ti serve per il vostro evento?"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input type="checkbox" name="privacy" required className="mt-1 accent-gold-deep" />
            <span>Acconsento al trattamento dei dati per ricevere risposta (privacy by design, nessun marketing).</span>
          </label>

          <button type="submit" disabled={status === 'sending'} className="btn btn-primary w-full disabled:opacity-60">
            {status === 'sending' ? 'Invio in corso…' : 'Invia richiesta'}
          </button>

          {status === 'ok' && (
            <p className="text-sm bg-sage/20 text-sage-deep rounded-lg px-4 py-3">
              Grazie! Ho ricevuto la richiesta, ti rispondo entro 24h.
            </p>
          )}
          {status === 'err' && (
            <p className="text-sm bg-rose/20 text-rose rounded-lg px-4 py-3">
              {errMsg || 'Qualcosa non va. Riprova o scrivimi su Instagram.'}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

function Field({ label, name, type = 'text', required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-ink-soft mb-2">
        {label}{required && ' *'}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-ink/10 bg-cream px-4 py-3 outline-none focus:border-gold-deep transition-colors"
      />
    </div>
  )
}
