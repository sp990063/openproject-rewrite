// lib/2fa/totp.ts — TOTP 2FA using otplib v12+ API
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib'

export interface TotpOptions {
  issuer?: string
  name?: string
  algorithm?: string
  digits?: number
  period?: number
}

export function createTotpSecret(): string {
  return generateSecret()
}

export function generateTotpToken(secret: string, options: TotpOptions = {}): string {
  return generateSync({
    secret,
    algorithm: (options.algorithm ?? 'SHA1').toUpperCase() as 'SHA1' | 'SHA256' | 'SHA512',
    digits: options.digits ?? 6,
    period: options.period ?? 30,
  })
}

export function generateTotpUri(
  secret: string,
  email: string,
  options: TotpOptions = {}
): string {
  return generateURI({
    secret,
    name: email,
    issuer: options.issuer ?? 'OpenProject',
    algorithm: (options.algorithm ?? 'SHA1').toUpperCase() as 'SHA1' | 'SHA256' | 'SHA512',
    digits: options.digits ?? 6,
    period: options.period ?? 30,
  })
}

export function verifyTotpToken(
  token: string,
  secret: string,
  options: TotpOptions = {}
): boolean {
  const result = verifySync({
    token,
    secret,
    algorithm: (options.algorithm ?? 'SHA1').toUpperCase() as 'SHA1' | 'SHA256' | 'SHA512',
    digits: options.digits ?? 6,
    period: options.period ?? 30,
  })
  return result.valid === true
}
