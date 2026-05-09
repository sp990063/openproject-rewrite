export type NotificationReason =
  | 'mentioned' | 'assigned' | 'responsible' | 'watched'
  | 'created' | 'updated' | 'commented' | 'deleted';

export type ResourceType = 'work_package' | 'wiki_page' | 'forum_thread' | 'meeting' | 'document';

export interface Notification {
  id: string;
  userId: string;
  reason: NotificationReason;
  projectId: string;
  projectName: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceSubject: string;
  actorId: string;
  actorName: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationSetting {
  id: string;
  userId: string;
  projectId: string | null;
  notificationType: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  digestEnabled: boolean;
}

export const NOTIFICATION_REASONS: Record<NotificationReason, string> = {
  mentioned: 'mentioned you',
  assigned: 'assigned you to',
  responsible: 'made you responsible for',
  watched: 'updated a watched item in',
  created: 'created',
  updated: 'updated',
  commented: 'commented on',
  deleted: 'deleted',
};

export const EMAIL_NOTIFICATION_TYPES = {
  'work_package_assigned': { label: 'When assigned to a work package', category: 'Work Packages' },
  'work_package_mentioned': { label: 'When mentioned in a work package', category: 'Work Packages' },
  'work_package_commented': { label: 'When someone comments on your work package', category: 'Work Packages' },
  'work_package_updated': { label: 'When a watched work package is updated', category: 'Work Packages' },
  'wiki_page_mentioned': { label: 'When mentioned in a wiki page', category: 'Wiki' },
  'forum_thread_replied': { label: 'When someone replies to your thread', category: 'Forums' },
  'meeting_invited': { label: 'When invited to a meeting', category: 'Meetings' },
  'meeting_reminder': { label: 'Meeting reminder (1 hour before)', category: 'Meetings' },
} as const;
