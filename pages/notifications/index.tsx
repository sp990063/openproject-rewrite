export const dynamic = 'force-dynamic'

import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useNotifications } from '@/hooks/useNotifications'
import { useMarkNotificationAsRead, useMarkAllNotificationsRead } from '@/hooks/useNotificationMutations'
import { formatDate } from '@/lib/utils'
import { BellIcon, CheckIcon } from 'lucide-react'

function NotificationIcon({ reason }: { reason: string }) {
  const icons: Record<string, string> = {
    mentioned: '💬',
    assigned: '📋',
    responsible: '⭐',
    watched: '👁',
    created: '✨',
    updated: '📝',
    commented: '💬',
    deleted: '🗑',
  }
  return <span className="text-xl">{icons[reason] ?? '🔔'}</span>
}

function getNotificationLink(notification: any): string {
  const { resourceType, resourceId, projectId } = notification
  const base = `/projects/${projectId}`
  switch (resourceType) {
    case 'work_package': return `${base}/work-packages/${resourceId}`
    case 'wiki_page': return `${base}/wiki/${resourceId}`
    case 'forum_thread': return `${base}/forums/${resourceId}`
    case 'meeting': return `${base}/meetings/${resourceId}`
    case 'document': return `${base}/documents`
    case 'news': return `${base}/news/${resourceId}`
    default: return base
  }
}


export default function NotificationsPage() {
  const router = useRouter()
  const { data, isLoading } = useNotifications(1)
  const markAsRead = useMarkNotificationAsRead()
  const markAllRead = useMarkAllNotificationsRead()

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id)
    }
    router.push(getNotificationLink(notification))
  }

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  const notifications = data?.data ?? []
  const meta = data?.meta

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {meta?.unreadCount !== undefined && (
              <p className="text-sm text-gray-500 mt-1">
                {meta.unreadCount} unread
              </p>
            )}
          </div>
          {meta?.unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckIcon className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <BellIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No notifications yet</p>
              <p className="text-sm text-gray-400 mt-1">
                You&apos;ll be notified when someone mentions you or assigns work to you.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <NotificationIcon reason={notification.reason} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{notification.actorName}</span>
                        {' '}
                        {notification.reason === 'mentioned' && 'mentioned you'}
                        {notification.reason === 'assigned' && 'assigned you to'}
                        {notification.reason === 'responsible' && 'made you responsible for'}
                        {notification.reason === 'watched' && 'changed a watched item'}
                        {notification.reason === 'created' && 'created'}
                        {notification.reason === 'updated' && 'updated'}
                        {notification.reason === 'commented' && 'commented on'}
                        {notification.reason === 'deleted' && 'deleted'}
                        {' '}
                        <span className="font-medium text-gray-900">
                          {notification.resourceSubject || notification.resourceType}
                        </span>
                      </p>
                      {notification.projectName && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          in {notification.projectName}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: meta.totalPages }, (_, i) => (
              <button
                key={i}
                className={`px-3 py-1 rounded text-sm ${
                  meta.page === i + 1
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
                onClick={() => {/* TODO: implement pagination */}}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
