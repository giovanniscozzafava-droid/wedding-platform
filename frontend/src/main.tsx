import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import './index.css'

// Backstop: se un import dinamico (chunk) fallisce dopo un deploy, Vite emette
// 'vite:preloadError' → ricarica la pagina una sola volta per prendere i nuovi
// chunk. Evita la "pagina bianca" cliccando una sezione subito dopo un aggiornamento.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  try {
    if (sessionStorage.getItem('pf_chunk_reloaded') === '1') return
    sessionStorage.setItem('pf_chunk_reloaded', '1')
  } catch { /* no-op */ }
  location.reload()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster
          position="top-right"
          theme="system"
          richColors
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              borderRadius: '12px',
            },
          }}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
)
