import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

// Load .env for test environment
// NOTE: .env.test intentionally omitted — file does not exist in this repo.
// Tests inherit DATABASE_URL (and other vars) from the project's regular .env,
// which dotenv falls back to gracefully when the target file is absent.
// Addresses TT-1 (Phase 3 Sprint 10).
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['.next/**', 'node_modules/**', 'pages/api/__tests__/**', '__tests__/api/routes-integration.test.ts', '__tests__/api/auth-guard.test.ts'],
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://cwlai@/openproject_rewrite?host=/var/run/postgresql&schema=public',
    },
  },
})
