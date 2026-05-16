import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'

const updateBrandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const isAdmin = await isSystemAdmin(session.user.id)
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden - Admin only' })
  }

  switch (req.method) {
    case 'GET':
      return getBranding(req, res)
    case 'PUT':
      return updateBranding(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PUT'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getBranding(req: NextApiRequest, res: NextApiResponse) {
  try {
    let branding = await prisma.branding.findUnique({
      where: { id: 'default' },
    })

    // Create default branding if it doesn't exist
    if (!branding) {
      branding = await prisma.branding.create({
        data: { id: 'default' },
      })
    }

    return res.status(200).json(branding)
  } catch (error) {
    console.error('Error fetching branding:', error)
    return res.status(500).json({ error: 'Failed to fetch branding' })
  }
}

async function updateBranding(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = updateBrandingSchema.parse(req.body)

    const branding = await prisma.branding.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })

    return res.status(200).json(branding)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating branding:', error)
    return res.status(500).json({ error: 'Failed to update branding' })
  }
}
