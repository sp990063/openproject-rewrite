// pages/projects/[projectId]/wiki/index.tsx
//
// Wiki index page — list all wiki pages in a project.
//
// Sprint 1 wiring:
//   - usePermission('wiki.edit') gates the "New page" button
//   - Pre-existing useWikiPages hook (refactored to project-scoped API)
//   - Pre-existing useCreateWikiPage mutation (refactored to project-scoped API)
//   - Pre-existing WikiPageList component (expects WikiPageWithMeta shape)
//   - AuthenticatedLayout shell (Pages Router compat shim → AppShell)
export const dynamic = 'force-dynamic'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input, Textarea } from '@/components/ui'
import { WikiPageList } from '@/components/wiki'
import { usePermission } from '@/hooks/use-permission'
import { useWikiPages } from '@/hooks/useWikiPages'
import { useCreateWikiPage } from '@/hooks/useWikiMutations'

export default function WikiIndexPage() {
  const router = useRouter()
  const projectId =
    typeof router.query.projectId === 'string' ? router.query.projectId : undefined

  const canEdit = usePermission(projectId, 'wiki.edit')
  const { data: pages = [], isLoading } = useWikiPages(projectId)

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const createMutation = useCreateWikiPage()

  const handleCreate = useCallback(() => {
    if (!projectId) return
    if (!newTitle.trim()) {
      setCreateError('Title is required')
      return
    }
    createMutation.mutate(
      { projectId, title: newTitle.trim(), content: newContent },
      {
        onSuccess: (created) => {
          setShowCreate(false)
          setNewTitle('')
          setNewContent('')
          setCreateError(null)
          router.push(`/projects/${projectId}/wiki/${created.slug}`)
        },
        onError: (err: Error) => {
          setCreateError(err.message)
        },
      },
    )
  }, [projectId, newTitle, newContent, createMutation, router])

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text-default">Wiki</h1>
            <p className="text-sm text-text-muted mt-1">
              Project documentation with Markdown support
            </p>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => {
                setShowCreate(true)
                setCreateError(null)
              }}
            >
              New page
            </Button>
          )}
        </div>

        {/* List */}
        <WikiPageList
          pages={pages as never}
          projectId={projectId ?? ''}
          isLoading={isLoading}
        />

        {/* Create modal */}
        <Modal
          open={showCreate}
          onOpenChange={(open) => {
            if (!createMutation.isPending && !open) {
              setShowCreate(false)
              setCreateError(null)
            }
          }}
          title="Create wiki page"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-default mb-1">
                Title
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Page title..."
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-default mb-1">
                Content (Markdown)
              </label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="# Heading 1&#10;&#10;Write your content here..."
                rows={12}
                disabled={createMutation.isPending}
                className="font-mono text-sm"
              />
            </div>
            {createError && (
              <p className="text-sm text-error">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false)
                  setCreateError(null)
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newTitle.trim()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create page'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AuthenticatedLayout>
  )
}
