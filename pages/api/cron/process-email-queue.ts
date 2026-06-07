// pages/api/cron/process-email-queue.ts
//
// Phase 5 Sprint 3: manual trigger for the email-queue drain.
//
// Why this endpoint exists:
//   lib/email/index.ts exports `processEmailQueue(prisma, batchSize)` but
//   the function is never called automatically. The pre-existing
//   `lib/notifications/email.ts` is just a thin wrapper that uses
//   `sendEmail` directly. We need *some* path that drains the
//   `email_queue` table — otherwise the `prisma.emailQueue.create()`
//   calls in `lib/email/index.ts` accumulate forever.
//
//   This route is the entry point. In production it's hit by a cron
//   job (e.g. Vercel Cron / GitHub Actions schedule) every minute. In
//   local dev you can `curl -X POST http://localhost:3333/api/cron/process-email-queue`
//   to flush the queue manually.
//
// Auth: shared secret in the `Authorization: Bearer <CRON_SECRET>` header.
//   The route is NOT protected by NextAuth session — cron jobs don't
//   log in. Set `CRON_SECRET` in your env. If unset, the route
//   refuses all calls (defence in depth).
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { processEmailQueue } from '@/lib/email'

const BATCH_SIZE = 10

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // CRON_SECRET gate. Defence in depth: even on a misconfigured prod
  // where someone forgets to set the env, the route fails closed.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' })
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await processEmailQueue(prisma, BATCH_SIZE)
    // processEmailQueue returns { processed, results } where results is
    // an array of Promise.allSettled outcomes. We return a small
    // summary so the cron logs are useful.
    const succeeded = result.results.filter(
      (r: PromiseSettledResult<{ success: boolean }>) =>
        r.status === 'fulfilled' && r.value.success
    ).length
    const failed = result.results.length - succeeded
    return res.status(200).json({
      processed: result.processed,
      succeeded,
      failed,
    })
  } catch (error) {
    console.error('[cron/process-email-queue] failed:', error)
    return res.status(500).json({ error: 'Failed to process email queue' })
  }
}
