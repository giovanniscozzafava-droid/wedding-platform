import { useEffect, useState } from 'react'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Question, QuestionnaireSection } from '@/lib/eventQuestions'

type Props = {
  sections: QuestionnaireSection[]
  initial?: Record<string, unknown>
  onChange?: (answers: Record<string, unknown>) => void
}

export function QuestionnaireForm({ sections, initial, onChange }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial ?? {})

  useEffect(() => {
    onChange?.(answers)
  }, [answers, onChange])

  function setField(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }))
  }

  function toggleMulti(key: string, opt: string) {
    setAnswers((a) => {
      const arr = Array.isArray(a[key]) ? (a[key] as string[]) : []
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]
      return { ...a, [key]: next }
    })
  }

  function setTags(key: string, raw: string) {
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean)
    setAnswers((a) => ({ ...a, [key]: tags }))
  }

  return (
    <div className="space-y-6">
      {sections.map((sec) => (
        <section key={sec.title}>
          <h3 className="font-display text-lg mb-3">{sec.title}</h3>
          <div className="space-y-4">
            {sec.questions.map((q) => (
              <FieldRender key={q.key} q={q}
                value={answers[q.key]}
                onChange={(v) => setField(q.key, v)}
                onToggleMulti={(opt) => toggleMulti(q.key, opt)}
                onSetTags={(s) => setTags(q.key, s)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FieldRender({ q, value, onChange, onToggleMulti, onSetTags }: {
  q: Question
  value: unknown
  onChange: (v: unknown) => void
  onToggleMulti: (opt: string) => void
  onSetTags: (raw: string) => void
}) {
  const id = `q-${q.key}`
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {q.label}{q.required && <span className="text-[rgb(var(--rose-500))] ml-1">*</span>}
      </Label>
      {q.help && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">{q.help}</p>}
      {q.type === 'text' && (
        <Input id={id} required={q.required} placeholder={q.placeholder}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {q.type === 'textarea' && (
        <Textarea id={id} rows={3} required={q.required} placeholder={q.placeholder}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {q.type === 'number' && (
        <Input id={id} type="number" min="0" required={q.required} placeholder={q.placeholder}
          value={(value as number | string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />
      )}
      {q.type === 'date' && (
        <Input id={id} type="date" required={q.required}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {q.type === 'select' && (
        <Select id={id} required={q.required}
          value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— seleziona —</option>
          {(q.options ?? []).map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </Select>
      )}
      {q.type === 'multiselect' && (
        <div className="flex flex-wrap gap-1.5">
          {(q.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : []
            const active = arr.includes(o)
            return (
              <button key={o} type="button" onClick={() => onToggleMulti(o)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                style={{
                  background: active ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-elev))',
                  color: active ? 'white' : 'rgb(var(--fg-muted))',
                  borderColor: 'rgb(var(--border))',
                }}>
                {o.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
      )}
      {q.type === 'tags' && (
        <Input id={id} placeholder={q.placeholder ?? 'separa con virgole'}
          value={Array.isArray(value) ? (value as string[]).join(', ') : ((value as string | undefined) ?? '')}
          onChange={(e) => onSetTags(e.target.value)} />
      )}
    </div>
  )
}
