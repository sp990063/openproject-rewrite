import { describe, it, expect } from 'vitest'
import { createTotpSecret, generateTotpToken, generateTotpUri, verifyTotpToken } from '@/lib/2fa/totp'

describe('TOTP', () => {
  describe('createTotpSecret', () => {
    it('generates a secret string', () => {
      const secret = createTotpSecret()
      expect(typeof secret).toBe('string')
      expect(secret.length).toBeGreaterThan(10)
    })

    it('generates unique secrets', () => {
      const s1 = createTotpSecret()
      const s2 = createTotpSecret()
      expect(s1).not.toBe(s2)
    })
  })

  describe('generateTotpToken', () => {
    it('generates a 6-digit token', () => {
      const secret = createTotpSecret()
      const token = generateTotpToken(secret)
      expect(typeof token).toBe('string')
      expect(token.length).toBe(6)
      expect(/^\d{6}$/.test(token)).toBe(true)
    })

    it('generates valid tokens with custom options', () => {
      const secret = createTotpSecret()
      const token = generateTotpToken(secret, { digits: 6, algorithm: 'SHA1', period: 30 })
      expect(/^\d{6}$/.test(token)).toBe(true)
    })
  })

  describe('generateTotpUri', () => {
    it('generates an otpauth URI', () => {
      const secret = createTotpSecret()
      const uri = generateTotpUri(secret, 'test@example.com')
      expect(uri).toContain('otpauth://totp/')
      expect(uri).toContain('secret=' + secret)
      expect(uri).toContain('OpenProject')
    })

    it('uses custom issuer', () => {
      const secret = createTotpSecret()
      const uri = generateTotpUri(secret, 'test@example.com', { issuer: 'CustomApp' })
      expect(uri).toContain('CustomApp')
    })
  })

  describe('verifyTotpToken', () => {
    it('verifies a valid token', () => {
      const secret = createTotpSecret()
      const token = generateTotpToken(secret)
      const valid = verifyTotpToken(token, secret)
      expect(valid).toBe(true)
    })

    it('rejects an invalid token', () => {
      const secret = createTotpSecret()
      const valid = verifyTotpToken('000000', secret)
      expect(valid).toBe(false)
    })

    it('rejects a token for wrong secret', () => {
      const secret1 = createTotpSecret()
      const secret2 = createTotpSecret()
      const token = generateTotpToken(secret1)
      const valid = verifyTotpToken(token, secret2)
      expect(valid).toBe(false)
    })
  })
})
