import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Gli e2e sono Playwright (.spec.ts sotto e2e/): NON vanno eseguiti da vitest (hanno un
    // runner diverso e richiedono un server) → si lanciano con `npm run test:e2e`.
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/e2e/**', '**/*.e2e.*'],
  },
})
