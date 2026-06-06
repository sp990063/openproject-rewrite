// pages/api/csp-report.ts
// Receives Content-Security-Policy violation reports from browsers.
// Browsers POST a `application/csp-report` or `application/json` body
// containing a `csp-report` object (legacy) or `csp_report` object (newer).
import type { NextApiRequest, NextApiResponse } from 'next'
import * as Sentry from '@sentry/nextjs'

export const config = {
  api: {
    bodyParser: {
      // CSP reports are small; just allow JSON
      sizeLimit: '10kb',
    },
  },
}

interface CspReport {
  'blocked-uri'?: string
  'violated-directive'?: string
  'original-policy'?: string
  'document-uri'?: string
  'source-file'?: string
  'line-number'?: number
  'column-number'?: number
  'effective-directive'?: string
  'disposition'?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Browsers may send either format:
  //   Legacy:  { "csp-report": { ... } }
  //   New:     { "csp_report": { ... } }  (Report-To API)
  const body = (req.body ?? {}) as Record<string, unknown>
  const report: CspReport | undefined =
    (body['csp-report'] as CspReport | undefined) ??
    (body['csp_report'] as CspReport | undefined) ??
    (Array.isArray(body) ? (body[0] as CspReport | undefined) : undefined)

  if (!report) {
    // No report payload — respond 204 anyway to avoid retries
    res.status(204).end()
    return
  }

  // Sanitize: cap the lengths to avoid log injection / huge payloads
  const sanitize = (v: unknown, max = 2000): string | undefined => {
    if (typeof v !== 'string') return undefined
    return v.length > max ? v.slice(0, max) : v
  }

  const safe: CspReport = {
    'blocked-uri': sanitize(report['blocked-uri']),
    'violated-directive': sanitize(report['violated-directive']),
    'effective-directive': sanitize(report['effective-directive']),
    'document-uri': sanitize(report['document-uri']),
    'source-file': sanitize(report['source-file']),
    'disposition': sanitize(report['disposition']),
    'line-number':
      typeof report['line-number'] === 'number'
        ? report['line-number']
        : undefined,
    'column-number':
      typeof report['column-number'] === 'number'
        ? report['column-number']
        : undefined,
  }

  // Log to server console for development visibility
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[CSP] Violation:', safe)
  }

  // Report to Sentry (no-op if Sentry isn't initialized / DSN missing)
  try {
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage('CSP Violation', {
        level: 'warning',
        tags: {
          csp_violation: 'true',
          directive: safe['effective-directive'] ?? safe['violated-directive'],
        },
        extra: {
          blockedUri: safe['blocked-uri'],
          violatedDirective: safe['violated-directive'],
          effectiveDirective: safe['effective-directive'],
          documentUri: safe['document-uri'],
          sourceFile: safe['source-file'],
          lineNumber: safe['line-number'],
          columnNumber: safe['column-number'],
          disposition: safe['disposition'],
        },
      })
    }
  } catch {
    // Never let Sentry errors break the report endpoint
  }

  // 204 No Content — browsers expect no body
  res.status(204).end()
}
