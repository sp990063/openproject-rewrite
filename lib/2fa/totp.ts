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

// Alias for the API route that uses generateTOTPSecret
export function generateTOTPSecret(): string {
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

// Alias for the API route that uses generateTOTPURI
export function generateTOTPURI(
  secret: string,
  email: string,
  issuer: string = 'OpenProject'
): string {
  return generateURI({
    secret,
    name: email,
    issuer,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
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

// Alias for the API route that uses verifyTOTP
export function verifyTOTP(token: string, secret: string): boolean {
  return verifyTotpToken(token, secret)
}

// QR code generation (returns data URL)
export async function generateQRCodeDataURL(uri: string): Promise<string> {
  // Dynamic import to avoid issues with edge runtime
  const QRCode = await import('qrcode')
  return QRCode.toDataURL(uri)
}
