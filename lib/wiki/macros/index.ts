/**
 * Wiki Macro Registry
 * 
 * Macros are special tags that can be used in wiki pages to embed dynamic content.
 * Syntax: {{macro_name(args)}}
 */

export interface MacroDefinition {
  name: string
  description: string
  syntax: string
  example: string
}

export const MACRO_DEFINITIONS: MacroDefinition[] = [
  {
    name: 'include',
    description: 'Embed another wiki page',
    syntax: '{{include(PageName)}}',
    example: '{{include(Getting Started)}}',
  },
  {
    name: 'issue',
    description: 'Inline work package link',
    syntax: '{{issue#123}}',
    example: '{{issue#123}}',
  },
  {
    name: 'child_pages',
    description: 'List child pages',
    syntax: '{{child_pages}}',
    example: '{{child_pages}}',
  },
  {
    name: 'parent_page',
    description: 'Link to parent page',
    syntax: '{{parent_page}}',
    example: '{{parent_page}}',
  },
]

/**
 * Process wiki macros in content before markdown rendering.
 * Returns the content with macros replaced by their output.
 */
export function processMacros(content: string): string {
  let processed = content

  // {{include(PageName)}} - embed another wiki page
  processed = processed.replace(
    /\{\{include\(([^)]+)\)\}\}/g,
    (_match, pageName) => `<div class="wiki-macro wiki-macro-include" data-page="${pageName.trim()}"><em>Included page: ${pageName.trim()}</em></div>`
  )

  // {{issue#123}} - inline work package link
  processed = processed.replace(
    /\{\{issue#(\d+)\}\}/g,
    (_match, issueId) => `<a href="/work-packages/${issueId}" class="wiki-macro wiki-macro-issue">#${issueId}</a>`
  )

  // {{child_pages}} - list child pages
  processed = processed.replace(
    /\{\{child_pages\}\}/g,
    `<div class="wiki-macro wiki-macro-child-pages"><em>Child pages list</em></div>`
  )

  // {{parent_page}} - link to parent page
  processed = processed.replace(
    /\{\{parent_page\}\}/g,
    `<div class="wiki-macro wiki-macro-parent-page"><a href="#" class="wiki-macro-parent-link">Parent page</a></div>`
  )

  return processed
}

/**
 * Extract macro names from content (for validation/listing).
 */
export function extractMacros(content: string): string[] {
  const macroRegex = /\{\{(\w+)(?:#\d+|\([^)]*\))?\}\}/g
  const macros: string[] = []
  let match

  while ((match = macroRegex.exec(content)) !== null) {
    macros.push(match[1])
  }

  return macros
}
