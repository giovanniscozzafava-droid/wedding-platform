import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'SERVICE_ROLE_KEY_REMOVED__ROTATE_AND_USE_ENV',
  { auth: { persistSession: false } })
const { data: cats } = await sb.from('budget_categories').select('id, entry_id, name, planned_amount')
console.log(`${cats.length} cats trovate`)
let inserted = 0
for (const c of cats) {
  const entries = []
  for (let e = 0; e < 3; e++) {
    entries.push({
      category_id: c.id, entry_id: c.entry_id,
      description: `${c.name} — acconto ${e + 1}`,
      amount: Number(c.planned_amount) / 3,
      paid: e < 2,
      paid_at: e < 2 ? new Date().toISOString().slice(0, 10) : null,
    })
  }
  const { error } = await sb.from('budget_entries').insert(entries)
  if (error) console.error(`${c.name}: ${error.message}`)
  else inserted += 3
}
console.log(`✓ ${inserted} budget_entries`)
