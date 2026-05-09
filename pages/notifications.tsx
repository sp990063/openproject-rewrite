'use client'
import React, { useState } from 'react'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useNotifications, useUnreadCount } from '@/hooks/useNotifications'
import { useMarkAllNotificationsRead } from '@/hooks/useNotificationMutations'
import { NotificationItem } from '@/components/notifications'

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const perPage = 20
  const { data, isLoading } = useNotifications({ page, perPage })
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllRead = useMarkAllNotificationsRead()

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  const { notifications = [], meta } = data?.data ?? { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 0 } }

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              onClick={handleMarkAllRead}
              isLoading={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <p>No notifications yet</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {meta.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}