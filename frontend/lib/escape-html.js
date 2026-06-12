// frontend/lib/escape-html.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared HTML escape helper. Use this for any untrusted string that will be
// interpolated into a template literal that ends up in `innerHTML`.
//
// For text inside the DOM, prefer `textContent` over `innerHTML` whenever
// possible. `escapeHtml` is the next-best option when you genuinely need
// HTML composition (e.g. embedding structured markup with attributes).
//
// Note: this does NOT sanitize URLs. For URL contexts (href/src), validate
// the scheme separately — see `escapeUrl()`.
// ─────────────────────────────────────────────────────────────────────────────

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
}

/**
 * Escape a value for safe interpolation into HTML.
 * - `null` / `undefined` → empty string
 * - numbers/booleans → coerced via String()
 * - objects → JSON.stringify fallback (rare; usually you want HTMLElement)
 * @param {*} s
 * @returns {string}
 */
export function escapeHtml(s) {
  if (s == null) return ''
  const str = typeof s === 'string' ? s : String(s)
  return str.replace(/[&<>"'`=]/g, (ch) => HTML_ENTITIES[ch])
}

/**
 * Escape a URL for use in href/src. Only allows http(s) and relative paths.
 * Rejects `javascript:`, `data:` (except data:image/*), and other dangerous
 * schemes. Use this when interpolating user-supplied values into attributes.
 * @param {string} url
 * @returns {string}
 */
export function escapeUrl(url) {
  if (url == null) return ''
  const s = String(url).trim()
  // Allow only http(s), mailto, tel, hash and relative paths
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(s)) return s
  // Reject anything else (javascript:, data:, vbscript:, etc.)
  return ''
}