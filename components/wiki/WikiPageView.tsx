import React, { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import type { WikiPageWithMeta, WikiPageVersion } from '@/types/wiki'
import { renderMarkdown } from '@/lib/markdown'

interface WikiPageViewProps {
  page: WikiPageWithMeta
  versions?: WikiPageVersion[]
  onEdit: () => void
  onShowHistory?: () => void
}

export function WikiPageView({ page, versions, onEdit, onShowHistory }: WikiPageViewProps) {
  const [showToc, setShowToc] = useState(true)
  const [renderedContent, setRenderedContent] = useState('')

  const toc = useMemo(() => extractTableOfContents(page.content), [page.content])

  // Ctrl+F / Cmd+F support for in-page search using window.find()
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        if (typeof window !== 'undefined') {
          window.find()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false
    renderMarkdown(page.content).then((html) => {
      if (!cancelled) setRenderedContent(html)
    })
    return () => { cancelled = true }
  }, [page.content])

  return (
    <div className="wiki-page-view">
      {/* Header */}
      <header className="mb-6">
        {/* Breadcrumb */}
        {page.parent && (
          <div className="text-sm text-gray-500 mb-2">
            <Link href={`/projects/${page.projectId}/wiki/${page.parent.slug}`} className="hover:text-blue-600">
              {page.parent.title}
            </Link>
            <span className="mx-2">/</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">{page.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onShowHistory && (
              <button
                onClick={onShowHistory}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                History
              </button>
            )}
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span>
            By <span className="font-medium">{page.author?.name ?? 'Unknown'}</span>
          </span>
          <span>·</span>
          <span title={format(new Date(page.updatedAt), 'MMM d, yyyy HH:mm')}>
            Updated {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
          </span>
          <span>·</span>
          <span>Version {page.version}</span>
          {page.versionCount > 0 && (
            <>
              <span>·</span>
              <span>{page.versionCount} revision{page.versionCount === 1 ? '' : 's'}</span>
            </>
          )}
        </div>

        {/* Children navigation */}
        {page.children && page.children.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Child Pages</h3>
            <div className="flex flex-wrap gap-2">
              {page.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/projects/${page.projectId}/wiki/${child.slug}`}
                  className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {child.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Content area with optional TOC */}
      <div className="flex gap-8">
        <article className="flex-1 min-w-0">
          {/* Rendered content — sanitized via renderMarkdown (XSS-safe) */}
          <div className="prose prose-slate max-w-none">
            {renderedContent ? (
              <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
            ) : (
              /* Show raw content while rendering to avoid layout flash */
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{page.content}</pre>
            )}
          </div>
        </article>

        {/* Table of Contents */}
        {showToc && toc.length > 0 && (
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-4">
              <TableOfContents headings={toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

// ─── Table of Contents ────────────────────────────────────────────────────────

interface TocHeading {
  level: number
  text: string
  id: string
}

function TableOfContents({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null

  return (
    <nav className="text-sm">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        On This Page
      </h4>
      <ul className="space-y-2 border-l-2 border-gray-200">
        {headings.map((heading, index) => (
          <li key={index} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
            <a
              href={`#${heading.id}`}
              className="block text-gray-600 hover:text-blue-600 transition-colors py-0.5"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ─── Markdown heading extraction ──────────────────────────────────────────────

function extractTableOfContents(content: string): TocHeading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: TocHeading[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    headings.push({ level, text, id })
  }

  return headings
}
