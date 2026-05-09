import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { sprintId } = req.query

  if (req.method === 'GET') {
    const workPackages = await prisma.workPackage.findMany({
      where: { sprintId: sprintId as string },
      include: { status: true, type: true, assignee: true },
    })
    return res.json({ workPackages })
  }

  if (req.method === 'PATCH') {
    const { workPackageId, statusId, position } = req.body
    const wp = await prisma.workPackage.update({
      where: { id: workPackageId },
      data: { ...(statusId && { statusId }), ...(position !== undefined && { position }) },
      include: { status: true, type: true, assignee: true },
    })
    return res.json({ workPackage: wp })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
