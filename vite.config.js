// vite.config.js
// Vite dev server for the new pure-vanilla frontend.
//
// Key responsibilities:
//   1. Serve frontend/index.html as SPA entry (β pages).
//   2. Proxy all /api/* requests to the running Next.js dev server
//      (port 3000) so the vanilla frontend can talk to the same
//      156 API routes that power the existing React UI.
//   3. Build to frontend/dist/ (gitignored) for production cutover.
//
// Usage:
//   # Terminal 1: backend + existing pages (Next.js)
//   npm run dev            # http://localhost:3000
//
//   # Terminal 2: new vanilla frontend
//   npm run dev:fe         # http://localhost:5173
//
// Workflow: user opens http://localhost:5173 → Vite serves index.html
// → router.js mounts /dashboard → api-client.js fetches /api/* which
// is proxied to localhost:3000 → existing Next.js API routes return JSON.

import { defineConfig } from 'vite'
import path from 'node:path'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001'

export default defineConfig({
  root: 'frontend',
  publicDir: 'assets',
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    hmr: false,  // Disable HMR — vanilla doesn't need fast-refresh; SSE keeps process loop open and breaks Playwright sessions
    proxy: {
      // All API + auth traffic → existing Next.js backend.
      // Session cookies flow through normally (same-origin via proxy).
      // Use '^/api/' (not '/api') so /api-client.js, /api-keys.txt, etc.
      // are NOT intercepted as backend traffic. The Next.js backend only
      // has /api/* routes, so ^/api/ is correct.
      '^/api/': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '^/auth/': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'frontend/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@fe': path.resolve(__dirname, 'frontend'),
    },
  },
  // Disable PostCSS — we hand-rolled all CSS, and the root
  // postcss.config.mjs (Tailwind v4) is incompatible with Vite's
  // CSS plugin. Setting css.postcss to a no-op config avoids Vite
  // walking up to the root config.
  css: {
    postcss: {
      plugins: [],
    },
  },
  // Disable HMR for now — vanilla doesn't need fast-refresh semantics
  // and this avoids Vite injecting a websocket we don't use.
  clearScreen: false,
})
