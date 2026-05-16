/**
 * Sentry error tracking initialization
 * Phase 6
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Only capture errors in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  
  // Don't re-throw captured exceptions (Next.js handles them)
  rethrowAfterCapture: false,
})
