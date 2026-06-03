import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter, Italianno } from 'next/font/google'
import { brand } from '@/lib/data'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})
const italianno = Italianno({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
})

export const metadata: Metadata = {
  title: `${brand.name} · ${brand.tagline}`,
  description: brand.bio,
  openGraph: {
    title: `${brand.name} · ${brand.tagline}`,
    description: brand.bio,
    images: [{ url: brand.logo }],
    locale: 'it_IT',
    type: 'website',
  },
  icons: { icon: brand.logo },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${cormorant.variable} ${inter.variable} ${italianno.variable}`}>
      <body>{children}</body>
    </html>
  )
}
