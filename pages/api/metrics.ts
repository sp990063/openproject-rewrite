// pages/api/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { register } from '@/lib/metrics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metrics = await register.metrics();
    res.setHeader('Content-Type', register.contentType);
    return res.send(metrics);
  } catch (e) {
    console.error('[Metrics] Failed to collect metrics:', e);
    return res.status(500).send('Failed to collect metrics');
  }
}
