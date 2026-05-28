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
            if (id.includes('@tiptap') || id.includes('prosemirror')) return undefined
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('react-dom') || id.match(/node_modules[\\/](\.pnpm[\\/])?react@?[\d.]*[\\/]/) || id.match(/node_modules[\\/]react[\\/]/)) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('framer-motion')) return 'vendor-motion'
            // jspdf / html2canvas / dompurify NON in manualChunks: lasciamo
            // che Vite li code-split via dynamic import in pdf-export.ts
            // (altrimenti finiscono in modulepreload del critical path).
            if (id.includes('@tanstack')) return 'vendor-query'
            if (id.includes('lucide-react') || id.includes('sonner')) return 'vendor-ui'
            // tiptap/prosemirror: lasciamo a Vite (lazy split via RichTextEditor)
          }
          return undefined
        },
      },
    },
  },
})
