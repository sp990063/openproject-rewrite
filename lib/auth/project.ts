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

/**
 * Resolve a meetingId to its parent projectId and assert the user is a
 * member of that project. Returns the projectId on success.
 *
 * For routes like `/api/meetings/[id]/...` that only carry the meetingId
 * in the URL — we still need project-membership to gate access.
 */
export async function assertMeetingProjectMembership(
  meetingId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!meetingId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Meeting ID is required')
  }
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { projectId: true },
  })
  if (!meeting) {
    throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
  }
  await assertProjectMembership(meeting.projectId, userId, isSystemAdmin)
  return meeting.projectId
}

/**
 * Same as assertMeetingProjectMembership but for agenda items — resolves
 * agendaId → meeting → project, asserts project membership.
 */
export async function assertMeetingAgendaProjectMembership(
  agendaId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!agendaId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Agenda ID is required')
  }
  const agenda = await prisma.meetingAgendaItem.findUnique({
    where: { id: agendaId },
    select: { meetingId: true, meeting: { select: { projectId: true } } },
  })
  if (!agenda) {
    throw new ApiError(404, 'AGENDA_ITEM_NOT_FOUND', 'Agenda item not found')
  }
  await assertProjectMembership(agenda.meeting.projectId, userId, isSystemAdmin)
  return agenda.meeting.projectId
}

/**
 * Same as assertMeetingProjectMembership but for meeting minutes — resolves
 * minutesId → meeting → project, asserts project membership.
 */
export async function assertMeetingMinutesProjectMembership(
  minutesId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!minutesId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Minutes ID is required')
  }
  const minutes = await prisma.meetingMinutes.findUnique({
    where: { id: minutesId },
    select: { meetingId: true, meeting: { select: { projectId: true } } },
  })
  if (!minutes) {
    throw new ApiError(404, 'MINUTES_NOT_FOUND', 'Meeting minutes not found')
  }
  await assertProjectMembership(minutes.meeting.projectId, userId, isSystemAdmin)
  return minutes.meeting.projectId
}

/**
 * Same as assertMeetingProjectMembership but for meeting attendees — resolves
 * attendeeId → meeting → project, asserts project membership.
 */
export async function assertMeetingAttendeeProjectMembership(
  attendeeId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!attendeeId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Attendee ID is required')
  }
  const attendee = await prisma.meetingAttendee.findUnique({
    where: { id: attendeeId },
    select: { meetingId: true, meeting: { select: { projectId: true } } },
  })
  if (!attendee) {
    throw new ApiError(404, 'ATTENDEE_NOT_FOUND', 'Meeting attendee not found')
  }
  await assertProjectMembership(attendee.meeting.projectId, userId, isSystemAdmin)
  return attendee.meeting.projectId
}


/**
 * Resolve a wikiPageId to its parent projectId and assert the user is a
 * member of that project. Returns the projectId on success.
 *
 * For routes like `/api/wiki/[id]` that only carry the wikiPageId in
 * the URL — we still need project-membership to gate access.
 */
export async function assertWikiPageProjectMembership(
  wikiPageId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<string> {
  if (!wikiPageId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Wiki page ID is required')
  }
  const page = await prisma.wikiPage.findUnique({
    where: { id: wikiPageId },
    select: { projectId: true },
  })
  if (!page) {
    throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
  }
  await assertProjectMembership(page.projectId, userId, isSystemAdmin)
  return page.projectId
}

/**
 * Resolve a wiki slug to its parent projectId and assert the user is a
 * member of that project. Returns { projectId, pageId } on success.
 *
 * Slugs are unique per project (projectId_slug) but the URL route only
 * carries `slug` — we still need to verify the user is a member of the
 * project that owns the page. If the slug is ambiguous across projects
 * the first match is used and the caller (forums or pages UI) should
 * also pass projectId via query to disambiguate.
 */
export async function assertWikiPageBySlugProjectMembership(
  slug: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<{ projectId: string; pageId: string }> {
  if (!slug) {
    throw new ApiError(400, 'BAD_REQUEST', 'Wiki page slug is required')
  }
  const page = await prisma.wikiPage.findFirst({
    where: { slug },
    select: { id: true, projectId: true },
  })
  if (!page) {
    throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
  }
  await assertProjectMembership(page.projectId, userId, isSystemAdmin)
  return { projectId: page.projectId, pageId: page.id }
}
