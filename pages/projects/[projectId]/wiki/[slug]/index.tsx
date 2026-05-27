export const dynamic = 'force-dynamic'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal } from '@/components/ui'
import { useWikiPage } from '@/hooks/useWikiPage'
import { useUpdateWikiPage, useDeleteWikiPage, useRestoreWikiVersion } from '@/hooks/useWikiMutations'
import { useWikiVersions } from '@/hooks/useWikiVersions'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'
import { WikiTableOfContents, useActiveHeading } from '@/components/wiki/WikiTableOfContents'
import { WikiMarkdown } from '@/components/wiki/WikiMarkdown'
import { WikiVersionHistory } from '@/components/wiki/WikiVersionHistory'
import { ExportDialog } from '@/components/exports/ExportDialog'
import type { ExportFormat } from '@/lib/exporters/pdf'
import { elementToPDF } from '@/lib/exporters/pdf'

export default function WikiPageViewPage() {
  const router = useRouter()
  const { projectId, slug } = router.query

  const { data: wikiPage, isLoading, error } = useWikiPage(projectId as string | undefined, slug as string | undefined)
  const updateWikiPage = useUpdateWikiPage()
  const deleteWikiPage = useDeleteWikiPage()
  const { user: currentUser } = useCurrentUser()

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [viewVersion, setViewVersion] = useState<{ version: number; content: string } | null>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const { data: versions } = useWikiVersions(projectId as string | undefined, slug as string | undefined)
  const restoreVersion = useRestoreWikiVersion()

  // Parse headings from content for Table of Contents
  const headings = useMemo(() => {
    if (!wikiPage?.content) return []
    const regex = /^(#{1,6})\s+(.+)$/gm
    const result: { level: number; text: string; id: string }[] = []
    let match
    while ((match = regex.exec(wikiPage.content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      result.push({ level, text, id })
    }
    return result
  }, [wikiPage?.content])

  const headingIds = useMemo(() => headings.map(h => h.id), [headings])
  const activeHeading = useActiveHeading(headingIds)

  const handleStartEdit = () => {
    if (wikiPage) {
      setEditTitle(wikiPage.title)
      setEditContent(wikiPage.content)
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditContent('')
  }

  const handleSaveEdit = async () => {
    if (!wikiPage) return

    try {
      await updateWikiPage.mutateAsync({
        id: wikiPage.id,
        data: {
          title: editTitle !== wikiPage.title ? editTitle : undefined,
          content: editContent,
        },
      })
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update wiki page:', err)
    }
  }

  const handleDelete = async () => {
    if (!wikiPage) return

    try {
      await deleteWikiPage.mutateAsync(wikiPage.id)
      router.push(`/projects/${projectId}/wiki`)
    } catch (err) {
      console.error('Failed to delete wiki page:', err)
    }
  }

  const handleViewVersion = (version: { version: number; content: string }) => {
    setViewVersion(version)
  }

  const handleRestoreVersion = async (version: number) => {
    if (!wikiPage) return

    try {
      await restoreVersion.mutateAsync({
        projectId: projectId as string,
        slug: slug as string,
        version,
      })
      setIsHistoryModalOpen(false)
      setViewVersion(null)
    } catch (err) {
      console.error('Failed to restore version:', err)
    }
  }

  // ── Export Wiki Page ─────────────────────────────────────────────────────────
  const handleExport = async (format: ExportFormat) => {
    if (!wikiPage) return

    setIsExporting(true)
    try {
      if (format === 'pdf') {
        // Find the wiki content element and convert to PDF
        const contentEl = document.querySelector('[data-wiki-content]') as HTMLElement
        if (contentEl) {
          await elementToPDF(contentEl, {
            filename: `wiki-${wikiPage.slug}`,
            title: wikiPage.title,
            scale: 2,
          })
        }
      }
    } catch (error) {
      console.error('Failed to export wiki page:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (!projectId || !slug) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading wiki page...</div>
      </AuthenticatedLayout>
    )
  }

  if (error || !wikiPage) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load wiki page</p>
          <Link href={`/projects/${projectId}/wiki`} className="text-blue-600 hover:text-blue-500">
            Back to Wiki
          </Link>
        </div>
      </AuthenticatedLayout>
    )
  }

  const isOwnerOrAdmin = currentUser?.id === wikiPage.authorId || currentUser?.isSystemAdmin

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}/wiki`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Wiki
          </Link>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold text-gray-900 w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Page title"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{wikiPage.title}</h1>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>By {wikiPage.author?.name ?? 'Unknown'}</span>
                <span>•</span>
                <span>Version {wikiPage.version}</span>
                <span>•</span>
                <span>Updated {formatDate(wikiPage.updatedAt)}</span>
              </div>
              {wikiPage.parent && (
                <div className="mt-1 text-sm text-gray-500">
                  Child of:{' '}
                  <Link
                    href={`/projects/${projectId}/wiki/${wikiPage.parent.slug}`}
                    className="text-blue-600 hover:text-blue-500"
                  >
                    {wikiPage.parent.title}
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsExportDialogOpen(true)}>
                Export
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsHistoryModalOpen(true)}>
                History
              </Button>
              {isOwnerOrAdmin && !isEditing && (
                <>
                  <Button variant="secondary" size="sm" onClick={handleStartEdit}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Children Section */}
        {wikiPage.children && wikiPage.children.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Child Pages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wikiPage.children.map((child: { id: string; slug: string; title: string }) => (
                <Link
                  key={child.id}
                  href={`/projects/${projectId}/wiki/${child.slug}`}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <span className="text-blue-600 hover:text-blue-800 font-medium">
                    {child.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main Content + Sidebar */}
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={20}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Page content (Markdown supported)"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveEdit}
                    isLoading={updateWikiPage.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none" data-wiki-content>
                {wikiPage.content ? (
                  <WikiMarkdown content={wikiPage.content} className="text-gray-700" />
                ) : (
                  <div className="text-gray-400 italic">No content yet.</div>
                )}
              </div>
            )}
          </div>

          {/* Table of Contents Sidebar */}
          {headings.length > 0 && !isEditing && (
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-6">
                <WikiTableOfContents headings={headings} activeId={activeHeading} />
              </div>
            </div>
          )}
        </div>

        {/* Project Info */}
        {wikiPage.project && (
          <div className="mt-6 text-sm text-gray-500">
            Part of: {wikiPage.project.name} ({wikiPage.project.identifier})
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Delete Wiki Page"
        description="Are you sure you want to delete this wiki page? This action cannot be undone."
      >
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteWikiPage.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Version History Modal */}
      <Modal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        title="Version History"
        description={viewVersion ? `Viewing version ${viewVersion.version}` : undefined}
        className="max-w-lg"
      >
        {viewVersion ? (
          <div className="mt-4">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-60 overflow-y-auto">
                {viewVersion.content}
              </pre>
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={() => setViewVersion(null)}>
                Back to List
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleRestoreVersion(viewVersion.version)}
                isLoading={restoreVersion.isPending}
              >
                Restore This Version
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <WikiVersionHistory
              versions={versions ?? []}
              currentVersion={wikiPage.version}
              onViewVersion={(v) => setViewVersion({ version: v.version, content: v.content })}
              onRestore={handleRestoreVersion}
              isRestoring={restoreVersion.isPending}
            />
          </div>
        )}
      </Modal>

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExport}
        title="Export Wiki Page"
        description="Choose a format to export this wiki page."
        isLoading={isExporting}
      />
    </AuthenticatedLayout>
  )
}