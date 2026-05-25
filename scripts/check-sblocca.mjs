import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
const SUPA_URL='https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
const admin=createClient(SUPA_URL, SKEY,{auth:{persistSession:false}})
const fornFoto='747707fe-03be-4bb8-95b8-17b43b465526'
// Crea un BUSY in giugno 2026 (mese visualizzato di default)
await admin.from('supplier_availability').upsert({fornitore_id:fornFoto,date:'2026-06-15',status:'BUSY',notes:'TEST E2E SBLOCCA'},{onConflict:'fornitore_id,date'})
console.log('busy creato 2026-06-15')

const RUN_DIR = process.argv[2] || '/tmp'
const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext()
const page=await ctx.newPage()
await page.goto('https://planfully.it/login',{waitUntil:'networkidle'})
await page.locator('button:has-text("Accetta")').first().click({timeout:3000}).catch(()=>{})
await page.getByLabel(/email/i).fill('forn-mini-foto@planfully-demo.it')
await page.getByLabel(/password/i).fill('Beta2026!')
await page.getByRole('button',{name:/^Accedi$/i}).click()
await page.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:15000})
await page.goto('https://planfully.it/disponibilita',{waitUntil:'networkidle'})
await new Promise(r=>setTimeout(r,2500))
// Navigate forward to June 2026
const nextBtn = page.locator('button').filter({hasText:/^›|next/i}).or(page.getByRole('button',{name:/successivo|next/i}))
// Click next month enough times to reach June
for (let i=0;i<2;i++){await page.locator('button:has(svg)').nth(1).click().catch(()=>{}); await new Promise(r=>setTimeout(r,500))}
await page.screenshot({path: path.join(RUN_DIR,'D-12-forn-disp-busy.png'),fullPage:true})
const txt = await page.locator('body').innerText()
console.log('Has "Sblocca":', /sblocca/i.test(txt))
console.log('Has "BUSY/occupato":', /occupato|busy/i.test(txt))
// Try click on day 15
const day15 = page.locator('button:has-text("15")').first()
if (await day15.count()>0) {
  // Don't click (would toggle), just inspect
}
// Cleanup
await admin.from('supplier_availability').delete().eq('fornitore_id',fornFoto).eq('date','2026-06-15')
await browser.close()
console.log('done')
