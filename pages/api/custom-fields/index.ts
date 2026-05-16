import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) {
    return res.status(403).json({ error: 'Admin only' })
  }

  if (req.method === 'GET') {
    const fields = await prisma.customField.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ fields })
  }

  if (req.method === 'POST') {
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

    if (!name || !fieldFormat || !entityType) {
      return res.status(400).json({ error: 'Missing required fields: name, fieldFormat, entityType' })
    }

    const validFormats = ['string', 'int', 'float', 'bool', 'date', 'list', 'user', 'version']
    if (!validFormats.includes(fieldFormat)) {
      return res.status(400).json({ error: `Invalid fieldFormat. Must be one of: ${validFormats.join(', ')}` })
    }

    const validEntityTypes = ['WorkPackage', 'Project', 'User']
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` })
    }

    const field = await prisma.customField.create({
      data: {
        name,
        fieldFormat,
        possibleValues: possibleValues ?? [],
        defaultValue: defaultValue ?? null,
        required: required ?? false,
        searchable: searchable ?? false,
        filterable: filterable ?? false,
        editable: editable ?? true,
        visible: visible ?? true,
        entityType,
      },
    })

    return res.status(201).json({ field })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
