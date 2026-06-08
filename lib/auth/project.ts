/**
 * lib/auth/project.ts
 * =====================================================================
 * Project-level permission helpers for use inside `withRoute` HOF route
 * handlers and direct API handlers. Extracted from the repeated
 * `prisma.member.findUnique({ where: { userId_projectId: ... } })`
 * pattern that appears in 9+ project-scoped routes (forums, documents,
 * etc.) so multiple routes can share the same RBAC logic.
 *
 * Pattern: same shape as `lib/auth/workPackage.ts` (Phase 7 A2). Throws
 * `ApiError` on denial, which the withRoute HOF formats into a uniform
 * error envelope.
 *
 * Usage:
 *   // When you already have projectId in the URL/query
 *   await assertProjectMembership(projectId, session.user.id, !!session.user.isSystemAdmin)
 *
 *   // When the route only has forumId/threadId/etc — resolves to projectId first
 *   const projectId = await assertForumProjectMembership(forumId, session.user.id, !!session.user.isSystemAdmin)
 */

import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/withRoute'

/**
 * Check the user is a member of the given project (or a system admin).
 * Throws ApiError(404) if the project doesn't exist, ApiError(403) if
 * the user is not a member.
 */
export async function assertProjectMembership(
  projectId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<void> {
  if (isSystemAdmin) return
  if (!projectId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })
  if (!project) {
    throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
  }
  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
    select: { id: true },
  })
  if (!member) {
    throw new ApiError(403, 'FORBIDDEN', 'You must be a project member to access this resource')
  }
}

/**
 * Resolve a forumId to its parent projectId and assert the user is a
 * member of that project. Returns the projectId on success (callers
 * often need it for further queries). Throws ApiError on denial.
 *
 * For routes like `/api/forums/[id]` that only carry the forumId in
 * the URL — we still need project-membership to gate access.
 */
export async function assertForumProjectMembership(
  forumId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!forumId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
  }
  const forum = await prisma.forum.findUnique({
    where: { id: forumId },
    select: { projectId: true },
  })
  if (!forum) {
    throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
  }
  await assertProjectMembership(forum.projectId, userId, isSystemAdmin)
  return forum.projectId
}

/**
 * Same as assertForumProjectMembership but for threads — resolves
 * thread → forum → project, asserts project membership.
 */
export async function assertThreadProjectMembership(
  threadId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<{ projectId: string; forumId: string }> {
  if (!threadId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Thread ID is required')
  }
  const thread = await prisma.forumThread.findUnique({
    where: { id: threadId },
    select: { forumId: true, forum: { select: { projectId: true } } },
  })
  if (!thread) {
    throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
  }
  await assertProjectMembership(thread.forum.projectId, userId, isSystemAdmin)
  return { projectId: thread.forum.projectId, forumId: thread.forumId }
}

/**
 * Same as assertThreadProjectMembership but for posts — resolves
 * post → thread → forum → project, asserts project membership.
 */
export async function assertPostProjectMembership(
  postId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<{ projectId: string; forumId: string; threadId: string }> {
  if (!postId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Post ID is required')
  }
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: {
      threadId: true,
      thread: { select: { forumId: true, forum: { select: { projectId: true } } } },
    },
  })
  if (!post) {
    throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
  }
  await assertProjectMembership(post.thread.forum.projectId, userId, isSystemAdmin)
  return {
    projectId: post.thread.forum.projectId,
    forumId: post.thread.forumId,
    threadId: post.threadId,
  }
}
