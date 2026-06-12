// vitest.fe.config.js
// Vitest config for the new vanilla frontend tests.
// Kept separate from the existing __tests__/api config so the two
// test suites (server-side API tests + client-side JS tests) don't
// collide on globals/setup.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./frontend/test/setup.js'],
    include: ['frontend/test/unit/**/*.test.js'],
    root: '.',
  },
  resolve: {
    alias: {
      '@fe': path.resolve(__dirname, 'frontend'),
    },
  },
})
