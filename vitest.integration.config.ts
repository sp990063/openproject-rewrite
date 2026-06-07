// vitest.integration.config.ts
// =====================================================================
// Separate vitest config for INTEGRATION tests that need a running dev
// server. The default vitest.config.ts EXCLUDES these tests from `npm
// test` because they require a server on TEST_API_URL. Run them via:
//
//   TEST_API_URL=http://localhost:3333 npm run test:integration
//
// Or run just the auth guard:
//
//   TEST_API_URL=http://localhost:3333 npm run test:auth-guard
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env.test') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node', // integration tests need real fetch + fs
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // NOTE: auth-guard.test.ts and routes-integration.test.ts NOT excluded
    exclude: ['.next/**', 'node_modules/**', 'pages/api/__tests__/**'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://cwlai@/openproject_rewrite?host=/var/run/postgresql&schema=public',
    },
  },
})
