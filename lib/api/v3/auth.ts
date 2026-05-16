/**
 * API Key Authentication Helper for OpenProject API v3
 * Validates Authorization: Bearer <apikey> header
 */
import { prisma } from '@/lib/prisma'
import { NextApiRequest } from 'next'

export interface ApiAuthResult {
  userId: string | null
  error: string | null
}

/**
 * Validate API key from request header
 * Returns userId if valid, null otherwise
 */
export async function validateApiKey(req: NextApiRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, error: 'Missing or invalid Authorization header' }
  }

  const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

  if (!apiKey) {
    return { userId: null, error: 'API key is empty' }
  }

  try {
    const user = await prisma.user.findFirst({
      where: { apiKey },
      select: { id: true },
    })

    if (!user) {
      return { userId: null, error: 'Invalid API key' }
    }

    return { userId: user.id, error: null }
  } catch (error) {
    console.error('Error validating API key:', error)
    return { userId: null, error: 'Internal server error' }
  }
}
