import React from 'react'

interface WikiEmptyStateProps {
  projectId: string
  onCreatePage?: () => void
}

export function WikiEmptyState({ projectId, onCreatePage }: WikiEmptyStateProps) {
  return (
    <div className="wiki-empty-state text-center py-16 px-4">
      {/* Icon */}
      <div className="mb-6">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <h2 className="text-lg font-medium text-gray-900 mb-2">No Wiki Pages Yet</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Create your first wiki page to document your project, share knowledge, and collaborate with your team.
      </p>

      {/* Action */}
      {onCreatePage && (
        <button
          onClick={onCreatePage}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create First Page
        </button>
      )}

      {/* Tips */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
        <Tip
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
          title="Write in Markdown"
          description="Use familiar Markdown syntax for formatting"
        />
        <Tip
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          title="Organize with Hierarchy"
          description="Create parent and child pages for structure"
        />
        <Tip
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="Track Changes"
          description="View version history and restore previous content"
        />
      </div>
    </div>
  )
}

function Tip({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ─── Compact variant for inline use ───────────────────────────────────────────

export function WikiEmptyStateCompact({ onCreatePage }: { onCreatePage?: () => void }) {
  return (
    <div className="text-center py-8 px-4">
      <p className="text-gray-400 text-sm mb-2">No wiki pages</p>
      {onCreatePage && (
        <button
          onClick={onCreatePage}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          Create the first one
        </button>
      )}
    </div>
  )
}
