'use client'
import { useState, useEffect } from 'react'
import { renderMarkdown } from '@/lib/markdown'

interface WikiMarkdownProps {
  content: string
  className?: string
}

/**
 * Client-side Markdown renderer with XSS sanitization.
 * Uses DOMPurify to sanitize HTML before rendering.
 * Safe for user-provided Markdown content.
 */
export function WikiMarkdown({ content, className }: WikiMarkdownProps) {
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    renderMarkdown(content).then((sanitizedHtml) => {
      if (!cancelled) {
        setHtml(sanitizedHtml)
      }
    })
    return () => { cancelled = true }
  }, [content])

  if (!html) {
    return <div className={className} />
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
