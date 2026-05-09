// lib/2fa/backup-codes.ts — Generate and verify backup codes
import crypto from 'crypto'

const CODE_LENGTH = 10
const CODE_COUNT = 10
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < CODE_COUNT; i++) {
    const buf = crypto.randomBytes(CODE_LENGTH)
    const code = Array.from(buf, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
    codes.push(code)
  }
  return codes
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex')
}

export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const normalized = hashBackupCode(code)
  return hashedCodes.includes(normalized)
}

export function remainingCodes(hashedCodes: string[]): number {
  return hashedCodes.filter(c => c !== 'USED').length
}
