/**
 * XSS-safe Markdown rendering pipeline.
 *
 * Two-stage sanitization:
 *  1. unified + remark-parse + remark-gfm + remark-rehype → raw HTML from MD
 *  2. DOMPurify (isomorphic — same API on server + client) → safe HTML
 *
 * Spec reference: openproject-rewrite-phase4-spec.md §2.0
 * Critical security: NEVER use `dangerouslySetInnerHTML` with unsanitized
 * content. ALL wiki Markdown MUST go through `renderMarkdown()`.
 *
 * Usage:
 *   const html = await renderMarkdown(markdownSource)
 *   return <div dangerouslySetInnerHTML={{ __html: html }} />
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import DOMPurify from 'isomorphic-dompurify'

/**
 * ALLOWED_TAGS — the safe subset of HTML for wiki content.
 * No <script>, no <iframe>, no <style>, no <object>, no event handlers.
 */
const ALLOWED_TAGS: string[] = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'strong', 'em', 'del', 's', 'u',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
]

/**
 * ALLOWED_ATTR — restricted to safe presentation + link attributes.
 * No `on*` event attrs, no `style` (CSS injection), no `id` (DOM collision).
 */
const ALLOWED_ATTR: string[] = [
  'href', 'src', 'alt', 'title',
  'class', 'className', 'target', 'rel',
]

/**
 * Render Markdown source to safe HTML.
 *
 * @param content - Raw Markdown source (user input)
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`
 */
export async function renderMarkdown(content: string): Promise<string> {
  // Stage 1: parse Markdown → HTML
  const vfile = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content)

  const rawHtml = String(vfile)

  // Stage 2: sanitize HTML (XSS prevention)
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Disallow data: and javascript: URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })

  return cleanHtml
}

/**
 * Render Markdown synchronously on the client. Use only for preview where
 * the source is already known-safe (e.g. previewing a form field, not
 * rendering server-trusted content).
 *
 * Server-side rendering should always use `renderMarkdown` (async).
 */
export function renderMarkdownSync(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}
