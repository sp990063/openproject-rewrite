/**
 * Integration helpers for dispatching webhooks after activity events.
 * Import this in API routes that create/update/delete resources.
 */

import { dispatchToWebhooks } from './dispatcher'

/**
 * Webhook payload structure for work package events.
 */
interface WorkPackageWebhookPayload {
  action: 'created' | 'updated' | 'deleted'
  workPackage: {
    id: string
    projectId: string
    subject: string
    statusId: string
    typeId: string
    [key: string]: unknown
  }
}

/**
 * Webhook payload structure for project events.
 */
interface ProjectWebhookPayload {
  action: 'created' | 'updated'
  project: {
    id: string
    name: string
    identifier: string
    [key: string]: unknown
  }
}

/**
 * Webhook payload structure for member events.
 */
interface MemberWebhookPayload {
  action: 'added' | 'removed'
  member: {
    id: string
    projectId: string
    userId: string
    roleId: string
    [key: string]: unknown
  }
}

/**
 * Webhook payload structure for time entry events.
 */
interface TimeEntryWebhookPayload {
  action: 'created'
  timeEntry: {
    id: string
    workPackageId: string
    userId: string
    hours: number
    [key: string]: unknown
  }
}

/**
 * Dispatch work_package.created webhook.
 */
export async function dispatchWorkPackageCreated(
  workPackage: WorkPackageWebhookPayload['workPackage']
): Promise<void> {
  await dispatchToWebhooks(
    'work_package.created',
    {
      action: 'created',
      workPackage,
    } as WorkPackageWebhookPayload,
    workPackage.projectId
  )
}

/**
 * Dispatch work_package.updated webhook.
 */
export async function dispatchWorkPackageUpdated(
  workPackage: WorkPackageWebhookPayload['workPackage'],
  changes?: Record<string, { old: unknown; new: unknown }>
): Promise<void> {
  await dispatchToWebhooks(
    'work_package.updated',
    {
      action: 'updated',
      workPackage,
      changes,
    } as WorkPackageWebhookPayload & { changes?: Record<string, { old: unknown; new: unknown }> },
    workPackage.projectId
  )
}

/**
 * Dispatch work_package.deleted webhook.
 */
export async function dispatchWorkPackageDeleted(
  workPackage: { id: string; projectId: string; subject: string }
): Promise<void> {
  await dispatchToWebhooks(
    'work_package.deleted',
    {
      action: 'deleted',
      workPackage,
    } as WorkPackageWebhookPayload,
    workPackage.projectId
  )
}

/**
 * Dispatch project.created webhook.
 */
export async function dispatchProjectCreated(
  project: ProjectWebhookPayload['project']
): Promise<void> {
  await dispatchToWebhooks('project.created', {
    action: 'created',
    project,
  } as ProjectWebhookPayload)
}

/**
 * Dispatch project.updated webhook.
 */
export async function dispatchProjectUpdated(
  project: ProjectWebhookPayload['project'],
  changes?: Record<string, { old: unknown; new: unknown }>
): Promise<void> {
  await dispatchToWebhooks('project.updated', {
    action: 'updated',
    project,
    changes,
  } as ProjectWebhookPayload & { changes?: Record<string, { old: unknown; new: unknown }> })
}

/**
 * Dispatch member.added webhook.
 */
export async function dispatchMemberAdded(
  member: MemberWebhookPayload['member']
): Promise<void> {
  await dispatchToWebhooks('member.added', {
    action: 'added',
    member,
  } as MemberWebhookPayload, member.projectId)
}

/**
 * Dispatch member.removed webhook.
 */
export async function dispatchMemberRemoved(
  member: MemberWebhookPayload['member']
): Promise<void> {
  await dispatchToWebhooks('member.removed', {
    action: 'removed',
    member,
  } as MemberWebhookPayload, member.projectId)
}

/**
 * Dispatch time_entry.created webhook.
 */
export async function dispatchTimeEntryCreated(
  timeEntry: TimeEntryWebhookPayload['timeEntry'],
  projectId: string
): Promise<void> {
  await dispatchToWebhooks(
    'time_entry.created',
    {
      action: 'created',
      timeEntry,
    } as TimeEntryWebhookPayload,
    projectId
  )
}
