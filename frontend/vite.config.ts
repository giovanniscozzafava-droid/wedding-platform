import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router') || id.match(/[\\/]react[\\/]/)) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('framer-motion')) return 'vendor-motion'
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('purify')) return 'vendor-pdf'
            if (id.includes('@tanstack')) return 'vendor-query'
            if (id.includes('lucide-react') || id.includes('sonner')) return 'vendor-ui'
          }
          return undefined
        },
      },
    },
  },
})
