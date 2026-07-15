import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { installErrorReporting } from './lib/errorReporting'
import { hardReloadOnce } from './lib/lazyWithRetry'
import './index.css'

// Pulisci il parametro usa-e-getta `_r` (aggiunto dall'hard-reload di recupero
// chunk) così l'URL resta pulito e i router non lo vedono.
try {
  const u = new URL(window.location.href)
  if (u.searchParams.has('_r')) {
    u.searchParams.delete('_r')
    window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
  }
} catch { /* no-op */ }

// Monitoraggio errori client (errori JS + promise non gestite) → pannello admin.
installErrorReporting()

// Backstop: se un import dinamico (chunk) fallisce dopo un deploy, Vite emette
// 'vite:preloadError' → hard-reload una sola volta per prendere i nuovi chunk
// (bypassando anche le cache delle webview in-app). Evita la "pagina bianca"
// cliccando una sezione subito dopo un aggiornamento.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  hardReloadOnce()
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
