import { prisma } from '@/lib/prisma'

/**
 * Emit an activity record for the unified activity feed.
 * Call this inside every CRUD API that creates/updates/deletes activities.
 *
 * @param params - Activity creation parameters
 * @returns The created Activity record
 */
export async function emitActivity(params: {
  projectId: string
  userId: string
  subjectType: ActivitySubjectType
  subjectId: string
  action: ActivityAction
  details?: Record<string, unknown>
  reference: ActivityReference
  mentionIds?: string[]
}): Promise<void> {
  const { projectId, userId, subjectType, subjectId, action, details, reference, mentionIds = [] } = params

  // Create the activity record
  await prisma.activity.create({
    data: {
      projectId,
      userId,
      subjectType,
      subjectId,
      action,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      reference: reference as object,
      mentionIds,
      isArchived: false,
    },
  })

  // If there are @mentions, create notifications for mentioned users
  if (mentionIds.length > 0) {
    const notifications = mentionIds.map((mentionedUserId) => ({
      userId: mentionedUserId,
      reason: 'mentioned',
      projectId,
      projectName: reference.projectName ?? '',
      resourceType: subjectType,
      resourceId: subjectId,
      resourceSubject: reference.subject,
      actorId: userId,
      actorName: reference.actorName ?? '',
    }))

    // Batch insert notifications
    await prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    })
  }
}

// ── Type definitions ─────────────────────────────────────────

export type ActivitySubjectType =
  | 'work_package'
  | 'wiki_page'
  | 'forum_post'
  | 'forum_thread'
  | 'document'
  | 'meeting'
  | 'news'
  | 'time_entry'
  | 'member'
  | 'version'

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'commented' | 'viewed'

export interface ActivityReference {
  type: string
  id: string
  subject: string
  projectName?: string
  actorName?: string
}

/**
 * Generate a subjectId from a model ID.
 * Format: "{type}-{id}" e.g., "wp-123", "wiki-my-page"
 */
export function makeSubjectId(type: ActivitySubjectType, id: string): string {
  const prefix = SUBJECT_PREFIXES[type] ?? type
  return `${prefix}-${id}`
}

const SUBJECT_PREFIXES: Record<ActivitySubjectType, string> = {
  work_package: 'wp',
  wiki_page: 'wiki',
  forum_post: 'fp',
  forum_thread: 'ft',
  document: 'doc',
  meeting: 'mtg',
  news: 'news',
  time_entry: 'te',
  member: 'mem',
  version: 'ver',
}

/**
 * Parse a subjectId back to (type, id).
 */
export function parseSubjectId(subjectId: string): { type: ActivitySubjectType; id: string } | null {
  const [prefix, ...rest] = subjectId.split('-')
  const id = rest.join('-')
  const type = Object.entries(SUBJECT_PREFIXES).find(([, p]) => p === prefix)?.[0] as ActivitySubjectType | undefined
  if (!type || !id) return null
  return { type, id }
}
