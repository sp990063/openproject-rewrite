// lib/crypto.ts
// Secure random token generation for invites, password reset, etc.
//
// Uses Node's built-in `crypto.randomBytes` (NOT Math.random, NOT
// Date.now-based) so tokens are cryptographically unpredictable. Tokens
// are URL-safe base64 — no padding, no `+`/`/` characters that would
// need URL encoding.

import { randomBytes } from 'crypto'

/**
 * Generate a URL-safe random token of `byteLength` random bytes.
 *
 * Default 32 bytes = 256 bits of entropy, which is the OWASP
 * recommendation for short-lived bearer tokens (invite links, magic
 * links, password reset URLs).
 *
 * Output is base64url-encoded (RFC 7515 §2): `A-Z a-z 0-9 - _`,
 * no padding. 32 bytes → 43-character string.
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}
