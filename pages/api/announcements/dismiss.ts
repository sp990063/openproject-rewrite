import { withRoute } from '@/lib/api/withRoute'

/**
 * POST /api/announcements/dismiss
 *
 * Note: This endpoint marks an announcement as dismissed in localStorage
 * per user. Since localStorage is client-side, we don't actually persist
 * anything server-side. The client stores dismissed announcement IDs in
 * localStorage and checks against them.
 *
 * This endpoint exists as a placeholder for future server-side
 * dismissal tracking. B-3.3: wrapped in withRoute HOF for parity with
 * the rest of the announcements module — auth gate added so an
 * anonymous client cannot poll for "dismissed" acknowledgements.
 */
export default withRoute<unknown, unknown, unknown>(
  async ({ res }) => {
    return res.status(200).json({ success: true, data: { dismissed: true } })
  },
  {
    methods: ['POST'],
  }
)
