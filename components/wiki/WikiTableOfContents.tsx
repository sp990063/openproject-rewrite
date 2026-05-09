import React from 'react'

interface WikiTableOfContentsProps {
  headings: Array<{
    level: number
    text: string
    id: string
  }>
  activeId?: string
}

export function WikiTableOfContents({ headings, activeId }: WikiTableOfContentsProps) {
  if (!headings || headings.length === 0) {
    return null
  }

  return (
    <nav className="wiki-toc text-sm" aria-label="Table of contents">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        On This Page
      </h4>
      <ul className="space-y-1.5 border-l-2 border-gray-200">
        {headings.map((heading, index) => (
          <TocItem
            key={index}
            heading={heading}
            isActive={activeId === heading.id}
          />
        ))}
      </ul>
    </nav>
  )
}

function TocItem({
  heading,
  isActive,
}: {
  heading: { level: number; text: string; id: string }
  isActive: boolean
}) {
  const indent = (heading.level - 1) * 12

  return (
    <li style={{ paddingLeft: `${indent}px` }}>
      <a
        href={`#${heading.id}`}
        className={`block py-0.5 transition-colors ${
          isActive
            ? 'text-blue-600 font-medium'
            : 'text-gray-600 hover:text-blue-600'
        }`}
      >
        {heading.text}
      </a>
    </li>
  )
}

// ─── Hook for tracking active section ────────────────────────────────────────

export function useActiveHeading(headingIds: string[]): string | undefined {
  const [activeId, setActiveId] = React.useState<string>()

  React.useEffect(() => {
    if (headingIds.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    )

    headingIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [headingIds])

  return activeId
}
