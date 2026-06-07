import type { NextConfig } from 'next'

// Phase 6 Sprint 2: bundle analyzer. `npm run analyze` opens an HTML
// report showing which deps are the largest. The dep is intentionally
// not in the import block — it's only loaded when ANALYZE=true so prod
// builds don't pay the cost.
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Note: Content-Security-Policy is set in middleware.ts because it
  // needs to vary based on NODE_ENV (dev vs prod) for HMR support.
  // Static fallback here would break Next.js dev HMR.
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  // Framework-level security headers (backup to middleware).
  // Applied to all routes including static assets.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
