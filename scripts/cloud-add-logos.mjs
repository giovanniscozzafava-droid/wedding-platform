#!/usr/bin/env node
/** Aggiunge brand_logo_url avatar SVG identicon ai fornitori beta. */
import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://zfwlkvqxfzvubmfyxofs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M',
  { auth: { persistSession: false } })

const PALETTES = ['C49A5C', '1A2E4F', '7E6633', 'D4A5A5', '9CAF88', '8B4513', 'B19CD9', '1F3A5F']

const { data } = await sb.from('profiles').select('id, full_name, business_name, role, subrole').in('role', ['FORNITORE', 'LOCATION', 'WEDDING_PLANNER'])
let n = 0
for (const p of data) {
  const seed = (p.business_name ?? p.full_name ?? 'X').slice(0, 30)
  const color = PALETTES[Math.abs(hash(seed)) % PALETTES.length]
  // DiceBear "shapes" o "initials". Uso initials, leggibile.
  const logoUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${color}&fontWeight=700&fontSize=42&textColor=ffffff`
  const { error } = await sb.from('profiles').update({ brand_logo_url: logoUrl, brand_primary_color: '#' + color }).eq('id', p.id)
  if (!error) { n++; console.log(`  ✓ ${p.business_name ?? p.full_name}`) }
}
console.log(`\n${n} loghi aggiornati`)
function hash(s) { let h = 0; for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return h }
