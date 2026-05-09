// pages/api/health.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // Check database
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    checks.database = { ok: false, error: e instanceof Error ? e.message : 'DB error' };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
