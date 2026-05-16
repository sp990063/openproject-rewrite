import { NextApiRequest, NextApiResponse } from 'next'

/**
 * OpenProject API v3 - API version info endpoint
 * GET /api/v3
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      error: 'Method not allowed',
      message: `GET is the only allowed method, got ${req.method}`,
    })
  }

  return res.status(200).json({
    apiVersion: 'v3',
    implemented: true,
    formats: ['json'],
    _links: {
      self: {
        href: '/api/v3',
        templated: false,
      },
    },
  })
}
