import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * Build a strict Content-Security-Policy value.
 * - Same-origin by default
 * - Allow Upstash Redis pubsub websocket endpoints (real-time)
 * - Allow Sentry ingest endpoints (error reporting)
 * - Allows 'unsafe-eval' in dev for Next.js HMR
 * - Allows 'unsafe-inline' for styles (Tailwind injects inline styles)
 */
function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== 'production'

  const sentryHosts = [
    'https://*.sentry.io',
    'https://*.ingest.sentry.io',
  ]

  const upstashHosts = [
    // Upstash Redis pub/sub REST + WebSocket
    'https://*.upstash.io',
    'wss://*.upstash.io',
  ]

  const directives: string[] = [
    `default-src 'self'`,
    // Scripts: same-origin + Sentry (lazy-loaded) + unsafe-eval in dev (HMR)
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} ${sentryHosts.join(' ')}`,
    // Styles: same-origin + 'unsafe-inline' (Tailwind + inline styles in components)
    `style-src 'self' 'unsafe-inline'`,
    // Images: same-origin + data URIs + blobs + https (gravatar, S3, etc.)
    `img-src 'self' data: blob: https:`,
    // Fonts: same-origin + data URIs
    `font-src 'self' data:`,
    // XHR/fetch/websocket: same-origin + Sentry + Upstash
    `connect-src 'self' ${sentryHosts.join(' ')} ${upstashHosts.join(' ')}`,
    // Media: same-origin
    `media-src 'self'`,
    // Objects: deny all (Flash, Java, etc.)
    `object-src 'none'`,
    // Frames: same-origin only (no third-party iframes)
    `frame-src 'self'`,
    // Embedding: deny all (combined with X-Frame-Options: DENY)
    `frame-ancestors 'none'`,
    // Form submissions: same-origin only
    `form-action 'self'`,
    // <base> tag: same-origin only
    `base-uri 'self'`,
    // Web app manifest: same-origin
    `manifest-src 'self'`,
    // Service workers: same-origin + blob (workbox uses blobs)
    `worker-src 'self' blob:`,
    // Upgrade all insecure requests to HTTPS
    `upgrade-insecure-requests`,
    // Block all mixed content
    `block-all-mixed-content`,
    // Reporting
    `report-uri /api/csp-report`,
  ]

  return directives.filter(Boolean).join('; ')
}

/**
 * Apply comprehensive security headers to a NextResponse.
 * These are applied to ALL responses (including redirects).
 */
function applySecurityHeaders(res: NextResponse, _req: NextRequest): NextResponse {
  // 1. HSTS — 1 year, include subdomains, preload-ready
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // 2. Content Security Policy
  res.headers.set('Content-Security-Policy', buildCsp())

  // 3. Clickjacking protection
  res.headers.set('X-Frame-Options', 'DENY')

  // 4. MIME sniffing protection
  res.headers.set('X-Content-Type-Options', 'nosniff')

  // 5. Referrer policy
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 6. Permissions Policy — disable powerful browser features
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // 7. Cross-Origin isolation
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // 8. DNS prefetch control — disable to prevent information leaks
  res.headers.set('X-DNS-Prefetch-Control', 'off')

  // 9. Remove identifying headers
  res.headers.delete('X-Powered-By')
  res.headers.delete('Server')

  return res
}

export async function middleware(req: NextRequest) {
  // Apply security headers to ALL responses first
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })
  applySecurityHeaders(res, req)

  // Use getToken from next-auth/jwt (not the full auth() wrapper)
  // This avoids triggering @auth/core's internal page rendering in middleware
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isLoggedIn = !!token
  const pathname = req.nextUrl.pathname
  const isOnProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/projects')
  const isOnAuthRoute = pathname.startsWith('/login')

  if (isOnAuthRoute && isLoggedIn) {
    const redirectRes = NextResponse.redirect(new URL('/dashboard', req.url))
    return applySecurityHeaders(redirectRes, req)
  }

  if (isOnProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const redirectRes = NextResponse.redirect(loginUrl)
    return applySecurityHeaders(redirectRes, req)
  }

  return res
}

export const config = {
  // Exclude /api/auth/* from middleware so NextAuth handlers run without middleware interference.
  // Also exclude Next.js internals and static assets.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
