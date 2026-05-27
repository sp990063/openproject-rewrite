'use client'
import { useState, useEffect, useRef } from 'react'
import { renderMarkdown } from '@/lib/markdown'

interface WikiMarkdownProps {
  content: string
  className?: string
  projectId?: string
  slug?: string
  parentSlug?: string
}

/**
 * Client-side Markdown renderer with XSS sanitization.
 * Uses DOMPurify to sanitize HTML before rendering.
 * Safe for user-provided Markdown content.
 *
 * Detects async macro placeholders (include, child_pages, parent_page)
 * and fetches their content client-side.
 */
export function WikiMarkdown({ content, className, projectId, slug, parentSlug }: WikiMarkdownProps) {
  const [html, setHtml] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [macroKey, setMacroKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    renderMarkdown(content).then((sanitizedHtml) => {
      if (!cancelled) {
        setHtml(sanitizedHtml)
        setMacroKey(prev => prev + 1)
      }
    })
    return () => { cancelled = true }
  }, [content])

  // Fetch content for async macro placeholders after HTML is rendered
  useEffect(() => {
    if (!html || !containerRef.current) return

    const container = containerRef.current

    // Handle wiki-macro-include - fetch included page content
    const includePlaceholders = container.querySelectorAll('.wiki-macro-include[data-page]')
    includePlaceholders.forEach(async (el) => {
      const pageName = (el as HTMLElement).dataset.page
      if (!pageName || !projectId) return

      const linkEl = el.querySelector('a') || el
      linkEl.textContent = 'Loading...'

      try {
        const response = await fetch(`/api/projects/${projectId}/wiki/by-slug?slug=${encodeURIComponent(pageName)}`)
        if (response.ok) {
          const page = await response.json()
          const includedHtml = await renderMarkdown(page.content || '*Page is empty*')
          el.innerHTML = `<div class="wiki-included-content">${includedHtml}</div>`
        } else {
          el.innerHTML = `<em class="text-red-500">Page not found: ${pageName}</em>`
        }
      } catch {
        el.innerHTML = `<em class="text-red-500">Failed to load: ${pageName}</em>`
      }
    })

    // Handle wiki-macro-child-pages - populated from wiki page data
    // This is handled by the parent wiki page component
    const childPagesPlaceholders = container.querySelectorAll('.wiki-macro-child-pages')
    childPagesPlaceholders.forEach((el) => {
      el.innerHTML = `<em class="text-gray-400">Child pages listed below</em>`
    })

    // Handle wiki-macro-parent-page - update with actual parent slug if available
    const parentPagePlaceholders = container.querySelectorAll('.wiki-macro-parent-page')
    parentPagePlaceholders.forEach((el) => {
      if (parentSlug && projectId) {
        (el as HTMLElement).dataset.parentPage = parentSlug
        const link = el.querySelector('a')
        if (link) {
          link.href = `/projects/${projectId}/wiki/${parentSlug}`
          link.textContent = 'Parent page'
        }
      }
    })
  }, [html, macroKey, projectId, parentSlug])

  if (!html) {
    return <div ref={containerRef} className={className} />
  }

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
