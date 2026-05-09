// lib/sentry.ts
// Phase 6: Sentry error tracking initialization
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Don't send errors in development
  enabled: process.env.NODE_ENV !== 'development',
  // Capture async stack traces
  attachStacktrace: true,
  // Normalize paths to avoid exposing machine-specific info
  normalizeDepth: 5,
});

export default Sentry;
