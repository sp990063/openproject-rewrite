// pages/api/projects/[projectId]/forums/[forumId]/posts/[postId]/vote.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 88-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ../../_membership.ts) (was: inline member.findUnique)
//   - Uniform error envelope via ApiError
//   - Vote toggle logic preserved (no schema changes)
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../../_membership'

export default withRoute(
  async ({ req, res, session, query }) => {
    const projectId = query.projectId as string
    const forumId = query.forumId as string
    const postId = query.postId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    if (!forumId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
    }
    if (!postId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Post ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }

    await assertProjectMembershipWithProject(projectId, session.user.id, isAdmin)

    // Verify post exists and belongs to a thread in this forum
    const post = await prisma.forumPost.findFirst({
      where: {
        id: postId,
        thread: { forumId },
      },
      include: { thread: { select: { forumId: true } } },
    })
    if (!post) {
      throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
    }

    // Toggle vote
    const existingVote = await prisma.forumVote.findUnique({
      where: {
        postId_userId: { postId, userId: session.user.id },
      },
    })
    let voteScore: number
    if (existingVote) {
      // Remove vote (toggle off)
      await prisma.forumVote.delete({
        where: { id: existingVote.id },
      })
      voteScore = post.voteScore - 1
    } else {
      // Add vote (toggle on)
      await prisma.forumVote.create({
        data: { postId, userId: session.user.id },
      })
      voteScore = post.voteScore + 1
    }
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { voteScore },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        votes: { where: { userId: session.user.id } },
      },
    })
    const hasVoted = updatedPost.votes.length > 0
    return res.status(200).json({ post: updatedPost, hasVoted, voteScore })
  },
  {
    methods: ['POST'],
  }
)
