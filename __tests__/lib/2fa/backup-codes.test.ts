import { describe, it, expect } from 'vitest'
import {
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  remainingCodes,
} from '@/lib/2fa/backup-codes'

describe('BackupCodes', () => {
  describe('generateBackupCodes', () => {
    it('generates 10 codes', () => {
      const codes = generateBackupCodes()
      expect(codes).toHaveLength(10)
    })

    it('each code is 10 characters', () => {
      const codes = generateBackupCodes()
      codes.forEach(code => {
        expect(code.length).toBe(10)
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true)
      })
    })

    it('generates unique codes', () => {
      const codes = generateBackupCodes()
      const unique = new Set(codes)
      expect(unique.size).toBe(10)
    })
  })

  describe('hashBackupCode', () => {
    it('normalizes input to uppercase', () => {
      const h1 = hashBackupCode('abc123')
      const h2 = hashBackupCode('ABC123')
      expect(h1).toBe(h2)
    })

    it('removes non-alphanumeric', () => {
      const h1 = hashBackupCode('A1B2C3')
      const h2 = hashBackupCode('A1-B2-C3')
      expect(h1).toBe(h2)
    })

    it('returns hex string', () => {
      const hash = hashBackupCode('TESTCODE1')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifyBackupCode', () => {
    it('verifies correct code', () => {
      const codes = generateBackupCodes()
      const hashed = codes.map(c => hashBackupCode(c))
      const valid = verifyBackupCode(codes[0], hashed)
      expect(valid).toBe(true)
    })

    it('rejects wrong code', () => {
      const codes = generateBackupCodes()
      const hashed = codes.map(c => hashBackupCode(c))
      const valid = verifyBackupCode('XXXXXXXXXX', hashed)
      expect(valid).toBe(false)
    })

    it('ignores already-used code', () => {
      const codes = generateBackupCodes()
      const hashed = codes.map(c => hashBackupCode(c))
      hashed[0] = 'USED'
      const valid = verifyBackupCode(codes[0], hashed)
      expect(valid).toBe(false)
    })
  })

  describe('remainingCodes', () => {
    it('counts non-USED codes', () => {
      const hashed = ['USED', 'USED', 'abc123', 'def456', 'USED']
      expect(remainingCodes(hashed)).toBe(2)
    })

    it('returns 0 for all used', () => {
      const hashed = ['USED', 'USED', 'USED']
      expect(remainingCodes(hashed)).toBe(0)
    })
  })
})
