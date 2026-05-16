/**
 * Instrumentation hook for Next.js
 * Used for tracing and performance monitoring
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    })
  }
}
