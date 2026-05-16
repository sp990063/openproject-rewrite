'use client'

import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ActivityItem } from './ActivityItem'

interface Activity {
  id: string
  projectId: string
  userId: string
  subjectType: string
  subjectId: string
  action: string
  details: unknown
  mentionIds: string[]
  reference: unknown
  isArchived: boolean
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  comments: Array<{
    id: string
    userId: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      avatarUrl: string | null
    }
  }>
}

interface ActivityFeedProps {
  activities: Activity[]
  isLoading: boolean
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivitySkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}
