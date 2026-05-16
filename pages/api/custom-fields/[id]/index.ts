import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid id' })
  }

  if (req.method === 'GET') {
    const field = await prisma.customField.findUnique({ where: { id } })
    if (!field) return res.status(404).json({ error: 'Custom field not found' })
    return res.json({ field })
  }

  if (req.method === 'PUT') {
    const {
      name,
      fieldFormat,
      possibleValues,
      defaultValue,
      required,
      searchable,
      filterable,
      editable,
      visible,
      entityType,
    } = req.body

    const validFormats = ['string', 'int', 'float', 'bool', 'date', 'list', 'user', 'version']
    if (fieldFormat && !validFormats.includes(fieldFormat)) {
      return res.status(400).json({ error: `Invalid fieldFormat. Must be one of: ${validFormats.join(', ')}` })
    }

    const validEntityTypes = ['WorkPackage', 'Project', 'User']
    if (entityType && !validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` })
    }

    const field = await prisma.customField.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(fieldFormat !== undefined && { fieldFormat }),
        ...(possibleValues !== undefined && { possibleValues }),
        ...(defaultValue !== undefined && { defaultValue }),
        ...(required !== undefined && { required }),
        ...(searchable !== undefined && { searchable }),
        ...(filterable !== undefined && { filterable }),
        ...(editable !== undefined && { editable }),
        ...(visible !== undefined && { visible }),
        ...(entityType !== undefined && { entityType }),
      },
    })

    return res.json({ field })
  }

  if (req.method === 'DELETE') {
    await prisma.customField.delete({ where: { id } })
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
