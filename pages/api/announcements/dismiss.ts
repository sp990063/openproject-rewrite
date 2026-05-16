import { NextApiRequest, NextApiResponse } from 'next'

/**
 * POST /api/announcements/dismiss
 * 
 * Note: This endpoint marks an announcement as dismissed in localStorage per user.
 * Since localStorage is client-side, we don't actually persist anything server-side.
 * The client stores dismissed announcement IDs in localStorage and checks against them.
 * 
 * This endpoint exists as a placeholder for future server-side dismissal tracking.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // For now, dismissal is handled client-side via localStorage.
  // Return success as acknowledgment.
  return res.status(200).json({ dismissed: true })
}
