import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

// Load .env for test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/openproject_rewrite_test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/lib/prisma': path.resolve(__dirname, './lib/prisma.ts'),
      '@/lib/auth': path.resolve(__dirname, './lib/auth.ts'),
    },
  },
})
