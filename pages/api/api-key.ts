import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v3Error } from '@/lib/api/v3/response-formatter'
import crypto from 'crypto'

/**
 * OpenProject API v3 - API Key management
 * POST /api/api-key - Generate new API key
 * GET /api/api-key - List user's API keys
 * DELETE /api/api-key - Revoke an API key
 * 
 * Note: Stores API key in User.apikey field (simplified for compatibility)
 */

/**
 * Generate a random API key
 */
function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.id) {
    return res.status(401).json(v3Error('Unauthorized', 'Authentication required'))
  }

  switch (req.method) {
    case 'GET':
      return listApiKeys(req, res, session.user.id)
    case 'POST':
      return generateApiKeyHandler(req, res, session.user.id)
    case 'DELETE':
      return revokeApiKey(req, res, session.user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      return res.status(405).json(v3Error('methodNotAllowed', `Method ${req.method} not allowed`))
  }
}

/**
 * GET - List API keys (returns masked keys)
 */
async function listApiKeys(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { apiKey: true, updatedAt: true },
    })

    if (!user) {
      return res.status(404).json(v3Error('NotFound', 'User not found'))
    }

    // Return masked key info (not the actual key)
    const keyInfo = user.apiKey
      ? {
          hasKey: true,
          keyPrefix: user.apiKey.substring(0, 8) + '...',
          createdAt: user.updatedAt,
        }
      : { hasKey: false }

    return res.status(200).json({
      _type: 'APIKey',
      userId,
      ...keyInfo,
    })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to list API keys'))
  }
}

/**
 * POST - Generate new API key
 */
async function generateApiKeyHandler(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const newKey = generateApiKey()

    await prisma.user.update({
      where: { id: userId },
      data: { apiKey: newKey },
    })

    return res.status(201).json({
      _type: 'APIKey',
      userId,
      apiKey: newKey, // Only returned on creation
      message: 'Store this key securely. It will not be shown again.',
    })
  } catch (error) {
    console.error('Error generating API key:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to generate API key'))
  }
}

/**
 * DELETE - Revoke API key
 */
async function revokeApiKey(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { keyId } = req.query

    // For simplicity, we only support one key per user
    // The keyId param is ignored but accepted for compatibility
    await prisma.user.update({
      where: { id: userId },
      data: { apiKey: null },
    })

    return res.status(200).json({
      _type: 'APIKey',
      userId,
      revoked: true,
      message: 'API key has been revoked.',
    })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to revoke API key'))
  }
}
