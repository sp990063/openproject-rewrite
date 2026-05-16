/**
 * Webhook event types supported by the system.
 * Used to filter which events a webhook receives.
 */

export const WEBHOOK_EVENTS = [
  'work_package.created',
  'work_package.updated',
  'work_package.deleted',
  'project.created',
  'project.updated',
  'member.added',
  'member.removed',
  'forum_thread.created',
  'wiki_page.created',
  'time_entry.created',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

/**
 * Map of event types to their human-readable descriptions.
 */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEvent, string> = {
  'work_package.created': 'Work package created',
  'work_package.updated': 'Work package updated',
  'work_package.deleted': 'Work package deleted',
  'project.created': 'Project created',
  'project.updated': 'Project updated',
  'member.added': 'Member added to project',
  'member.removed': 'Member removed from project',
  'forum_thread.created': 'Forum thread created',
  'wiki_page.created': 'Wiki page created',
  'time_entry.created': 'Time entry created',
}

/**
 * Check if an event string is a valid WebhookEvent.
 */
export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return WEBHOOK_EVENTS.includes(event as WebhookEvent)
}
