/**
 * URL-safe slug generation for wiki pages, forums, etc.
 *
 * Rules:
 *  - Lowercase
 *  - ASCII only (non-ASCII stripped, not transliterated — keep it simple)
 *  - Whitespace → hyphens
 *  - Collapse multiple hyphens
 *  - Trim leading/trailing hyphens
 *  - Max length 80 chars
 *  - Fallback: 'untitled' if input is all non-ASCII
 *
 * NOT collision-aware: caller is responsible for detecting
 * `@@unique([projectId, slug])` violations and appending `-2`, `-3`, etc.
 */
const MAX_SLUG_LENGTH = 80
const FALLBACK_SLUG = 'untitled'

export function generateSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    // Strip diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // Replace any non a-z0-9 with hyphen
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Cap length
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '') // re-trim after slice

  return slug || FALLBACK_SLUG
}

/**
 * Given a base slug and a set of existing slugs, return a unique
 * slug by appending `-2`, `-3`, etc.
 *
 * @param base - The preferred slug
 * @param existing - Set (or array) of slugs already in use
 * @returns A slug guaranteed not to be in `existing`
 */
export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const used = new Set(existing)
  if (!used.has(base)) return base

  let i = 2
  while (used.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
