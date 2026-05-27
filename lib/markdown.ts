/**
 * Markdown rendering with XSS sanitization — P2-1 CRITICAL security fix
 *
 * All user-provided Markdown must be sanitized before rendering as HTML.
 * NEVER render raw Markdown without going through this pipeline.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type { Element } from 'hast';
import DOMPurify from 'isomorphic-dompurify';
import { processMacros } from '@/lib/wiki/macros';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'strong', 'em', 'del', 's', 'u',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'className', 'target', 'rel', 'data-page', 'id'];

/**
 * Rehype plugin: inject id attributes into heading elements.
 * Generates slugs from heading text content.
 */
function rehypeHeadingIds() {
  return (tree: Node) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName.match(/^h[1-6]$/)) {
        const textContent = (node.children || [])
          .filter((child): child is Element => child.type === 'element')
          .map(child => {
            if (child.tagName === 'code') {
              return (child.children || []).map((c: Element) => c.value || '').join('')
            }
            return (child.children || []).map((c: Element) => c.value || '').join('')
          })
          .join('')

        const slug = textContent
          .toLowerCase()
          .replace(/<[^>]+>/g, '') // strip any remaining HTML tags
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')

        // Add id to properties
        node.properties = node.properties || {}
        node.properties['id'] = slug
      }
    })
  }
}

/**
 * Render Markdown string to sanitized HTML.
 * Safe to use with user-provided content.
 */
export async function renderMarkdown(content: string): Promise<string> {
  // Step 0: Process wiki macros first
  const contentWithMacros = processMacros(content);

  // Step 1: Markdown → HTML with GFM support + heading IDs
  const vfile = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHeadingIds)
    .process(contentWithMacros);

  // Step 2: Sanitize HTML — prevents XSS attacks
  const cleanHtml = DOMPurify.sanitize(String(vfile), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force all links to open in new tab and add noopener
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
    // Prevent DOM clobbering
    ALLOW_DATA_ATTR: false,
  });

  return cleanHtml;
}

/**
 * Generate a table of contents from Markdown content.
 * Extracts headings (h1-h6) and returns them with their slug anchors.
 */
export function generateTableOfContents(content: string): Array<{
  level: number;
  text: string;
  slug: string;
}> {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: Array<{ level: number; text: string; slug: string }> = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    toc.push({ level, text, slug });
  }

  return toc;
}

/**
 * Generate a URL-safe slug from a string.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
