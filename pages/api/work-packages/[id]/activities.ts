// pages/api/work-packages/[id]/activities.ts
// Phase 7 Sprint A2: refactored to withRoute HOF + project-membership RBAC
// (was: direct handler with getServerSession+401, see Phase 7 Sprint A1
// 050bdbc for the auth-only fix). Behavior change vs A1:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check (NEW: was 200 with data)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute } from '@/lib/api/withRoute'
import { assertWorkPackageViewPermission } from '@/lib/auth/workPackage'

export default withRoute(
  async ({ req, res, session, query }) => {
    const id = (query as { id?: string }).id
    if (!id) {
      // withRoute's paramsSchema could validate this, but we keep the
      // runtime check for direct-call safety.
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Work package ID is required' },
      })
    }

    // RBAC: user must be a project member (or system admin) to see activities
    await assertWorkPackageViewPermission(id, session.user.id, !!session.user.isSystemAdmin)

    const activities = await prisma.activity.findMany({
      where: { workPackageId: id },
      include: {
        workPackage: {
          select: {
            id: true,
            subject: true,
            statusId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Resolve userId -> user name/email via a separate efficient query
    const userIds = [...new Set(activities.map((a) => a.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const activitiesWithUsers = activities.map((a) => ({
      ...a,
      user: userMap[a.userId] ?? { id: a.userId, name: 'Unknown', email: '', avatarUrl: null },
    }))

    return res.status(200).json({ success: true, data: activitiesWithUsers })
  },
  {
    methods: ['GET'],
  }
)
