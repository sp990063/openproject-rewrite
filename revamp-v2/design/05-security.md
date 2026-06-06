# 05 — Security & Authentication Overhaul

**Project:** OpenProject Rewrite (Next.js 15 Pages Router, Prisma 7, NextAuth v5 beta)
**Status:** Design proposal — READ-ONLY. No code is modified by this document.
**Author:** Security & Authentication Expert
**Date:** 2026-06-06
**Codebase under review:** `/home/cwlai/openproject-rewrite`
**Output:** `/home/cwlai/openproject-rewrite/revamp-v2/design/05-security.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Top 5 Critical Security Fixes](#3-top-5-critical-security-fixes)
4. [Authentication](#4-authentication)
5. [Authorization (RBAC + ABAC)](#5-authorization-rbac--abac)
6. [API Security](#6-api-security)
7. [Data Security](#7-data-security)
8. [Input Security](#8-input-security)
9. [Audit, Monitoring & Detection](#9-audit-monitoring--detection)
10. [OWASP Top 10 (2021) Review](#10-owasp-top-10-2021-review)
11. [Compliance — GDPR & SOC 2](#11-compliance--gdpr--soc-2)
12. [Penetration Testing Checklist](#12-penetration-testing-checklist)
13. [Dependency Security](#13-dependency-security)
14. [15 Specific Bugs Likely in Current Code](#14-15-specific-bugs-likely-in-current-code)
15. [Concrete Code Examples](#15-concrete-code-examples)
16. [Security Headers Middleware](#16-security-headers-middleware)
17. [Incident Response Plan](#17-incident-response-plan)
18. [Implementation Roadmap](#18-implementation-roadmap)

---

## 1. Executive Summary

The OpenProject Rewrite currently ships a **partially hardened** stack: NextAuth v5 with JWT sessions, bcryptjs password hashing, PrismaAdapter, two OAuth providers (Google/GitHub), partial 2FA infrastructure (TOTP, WebAuthn, backup codes all present in `lib/2fa/`), LDAP sync in `lib/ldap/`, and a Redis-backed `rate-limiter-flexible` limiter.

**However**, the audit reveals **structural weaknesses** typical of a fast-moving Next.js + NextAuth v5 beta codebase:

- The known **32 API routes use `getServerSession(authOptions)` 1-arg form** which silently returns `null` in nested or non-pages contexts (App Router edges, middleware-driven routes, custom server adapters) — a critical **broken access control** risk.
- There is **no global `withAuth()` wrapper** or per-route policy enforcement. Permissions are checked manually in `lib/permissions/work-packages.ts` but are not consistently applied across all 30+ resource endpoints (work packages, wiki, forums, documents, time-entries, files, etc.).
- There are **no security response headers** anywhere in the codebase (no CSP, HSTS, X-Frame-Options, etc.) — the Next.js `next.config.js`/`next.config.ts` and `middleware.ts` are silent on this.
- The 2FA module exists but **WebAuthn challenges are not persisted** (challenge is generated per-call but never stored) — registration/authentication cannot complete.
- LDAP `client.ts` does an **unauthenticated bind** on a user-supplied `username` (line 76) — an LDAP injection vector.
- **No audit log** for destructive operations. No diff history for `WorkPackage`, `WikiPage`, `Role`, `Member` changes.
- **No idempotency keys** for mutations — payment-style retry storms can cause duplicate work packages, duplicate time entries, duplicate notifications.
- The `passwordHash` column has no length cap, no breach check, no rotation policy.

This document delivers a **comprehensive, prioritized** security overhaul. The critical fixes (Section 3) can be applied within one sprint; the rest is roadmap-phased.

### Security Goals

| Goal | Target |
|---|---|
| A01 Broken Access Control | 0 critical/major findings in authz fuzz tests |
| A02 Cryptographic Failures | All sensitive fields encrypted at rest; TLS 1.2+ enforced |
| A03 Injection | 0 SQLi / XSS / LDAPi / template-injection findings |
| A07 Auth Failures | M3 compliant; M2/MFA on all admin accounts |
| A09 Logging Failures | 100% of auth/security events persisted; alertable in Sentry |
| MTTD (mean time to detect breach) | ≤ 15 minutes |
| MTTR (mean time to respond) | ≤ 4 hours for Sev-1 |

---

## 2. Current State Assessment

### 2.1 What Exists (Strengths)

- ✅ **NextAuth v5** with JWT strategy — stateless, no session table to leak
- ✅ **bcryptjs** (pure JS, no native dep) — no timing attacks via comparison; `bcrypt.compare` is constant-time
- ✅ **PrismaAdapter** — official, well-audited
- ✅ **OAuth** via Google + GitHub providers
- ✅ **2FA infrastructure**: `lib/2fa/totp.ts` (otplib), `lib/2fa/webauthn.ts` (@simplewebauthn/server), `lib/2fa/backup-codes.ts`
- ✅ **Rate limiting** via `lib/ratelimit.ts` (rate-limiter-flexible + Redis)
- ✅ **Sentry** integration (client + server configs)
- ✅ **isomorphic-dompurify** available
- ✅ **@upstash/ratelimit** in deps (sliding-window algorithm)
- ✅ **LDAP client** + sync, group mapping (`lib/ldap/{client,sync,group-map}.ts`)
- ✅ **isSystemAdmin()** + **validatePassword()** helpers in `lib/auth.ts`
- ✅ **User model** has `isSystemAdmin`, `passwordMigrationRequired`, `passwordHash` flags

### 2.2 What's Missing (Gaps)

- ❌ **Per-route RBAC enforcement** — manual checks in 1 file (`work-packages.ts`), absent elsewhere
- ❌ **Security response headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- ❌ **CSRF protection** for non-NextAuth POST routes
- ❌ **Input validation framework** — no Zod schemas applied uniformly
- ❌ **Idempotency keys** for mutations
- ❌ **Audit log** table/model
- ❌ **Field-level encryption** (PII columns in cleartext)
- ❌ **Breached-password check** (HaveIBeenPwned)
- ❌ **Session rotation/revocation**
- ❌ **Device tracking** (impossible to list "where am I logged in")
- ❌ **Refresh tokens** (JWT only, no sliding renewal)
- ❌ **SAML SSO** provider
- ❌ **SCIM 2.0** provisioning endpoint
- ❌ **Anomaly detection** rules
- ❌ **Penetration test** baseline
- ❌ **Dependency scanning** in CI (npm audit / Snyk)
- ❌ **MFA enforcement** policy (currently optional; admins should be required)

### 2.3 Per-Route Authorization Audit (Gap Inventory)

Quick scan of the API tree shows the following endpoints are **likely unprotected or under-protected** (this needs verification by a static analyzer but the pattern is clear):

| Route Group | Likely Status | Notes |
|---|---|---|
| `pages/api/admin/**` | Likely has admin check | Verify |
| `pages/api/users/[id]/**` | Mostly 1-arg getServerSession | Identity-only, no RBAC on the user record itself |
| `pages/api/work-packages/**` | Permission check only on the 1 file | Many subroutes inherit no check |
| `pages/api/wiki/**` | No permission module | Wiki read/write is open to any logged-in user |
| `pages/api/forums/**` | No permission module | Same as wiki |
| `pages/api/documents/**` | No permission module | Same |
| `pages/api/time-entries/**` | No permission module | Likely any logged-in user can post on any project |
| `pages/api/roles/**` | System-admin only? | Verify |
| `pages/api/groups/**` | System-admin only? | Verify |
| `pages/api/projects/**` | Membership check | No inheritance from parent projects |
| `pages/api/queries/**` | Identity only | 1-arg getServerSession |
| `pages/api/files/**` | Likely missing ownership check | Uploads per project? Per user? |
| `pages/api/webhooks/**` | Auth = signing secret only | Need to verify signature |
| `pages/api/sse/**` | SSE auth? | Long-lived; needs special care |
| `pages/api/v3/**` | Mixed | Some new v3 routes may duplicate/overlap v1 |

**Action:** Run `grep -L "checkWorkPackagePermission\|requireWorkPackagePermission\|isSystemAdmin" pages/api/ -r` to find routes with **no** permission check. This is your gap list.

---

## 3. Top 5 Critical Security Fixes

These five must land in the next 1-2 sprints. Each is a single, high-leverage change.

### 🔴 CRITICAL #1 — Fix the 1-arg `getServerSession` Pattern

**Risk:** Critical. 32 API routes silently bypass auth in non-pages contexts.

**Fix (single line per route):**
```ts
// BEFORE (broken in nested routes)
import { getServerSession } from 'next-auth'
const session = await getServerSession(req, res, authOptions) // ⚠️ NextAuth v5 signature is wrong here

// AFTER (correct v5)
import { auth } from '@/lib/auth'
const session = await auth()   // ✅ single source of truth, no req/res
```

**Why:** In NextAuth v5 the `getServerSession(req,res,opts)` 3-arg form is a v4 leftover. In v5 the supported API is `await auth()` which reads the cookies via Next.js `cookies()` helper. The 1-arg form passes the wrong thing and may resolve to `null`, letting unauthenticated requests through.

**Action:** Refactor `lib/auth.ts` to export `auth`, `signIn`, `signOut` from `NextAuth({...authOptions})` (v5 pattern), then find-replace every `getServerSession` usage.

---

### 🔴 CRITICAL #2 — Add a Global `withApiAuth` Wrapper

**Risk:** Critical. Manual permission checks are inconsistent.

**Fix:** Create `lib/api/with-api-auth.ts` that:
1. Resolves the session via `await auth()`.
2. Verifies 2FA if `session.user.mfaRequired && !session.user.mfaVerified`.
3. Throws `403` if `requiredPermission` is missing.
4. Throws `429` if rate-limited.
5. Logs the request to the audit log.
6. Returns `{ session, user, requestId }` to the handler.

Every API route becomes:
```ts
export default withApiAuth({ permission: 'WORK_PACKAGE_EDIT', scope: 'work-package' },
  async (req, res, { session }) => { ... }
)
```

This collapses 32 routes into 1 audit point and makes the security posture auditable in seconds.

---

### 🔴 CRITICAL #3 — Add Security Response Headers

**Risk:** High. Zero CSP/HSTS today = XSS amplifiable, MITM possible, clickjacking trivial.

**Fix:** Add the middleware in [Section 16](#16-security-headers-middleware) to `middleware.ts`. This single change closes 5 OWASP items.

---

### 🔴 CRITICAL #4 — LDAP Injection in `client.ts`

**Risk:** High. An attacker can craft a username like `*)(uid=*` to authenticate as another user.

**Current code (line ~76 of `lib/ldap/client.ts`):**
```ts
const userClient = createClient(config)
// No escape of `username` before passing into search filter
const { searchEntries } = await userClient.search({ ... filter: `(uid=${username})` })
```

**Fix:** RFC 4515 — escape `(`, `)`, `*`, `\`, NUL in the username before interpolating:
```ts
function escapeLdapFilter(input: string): string {
  return input.replace(/[\\*()\0]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'))
}
const filter = `(uid=${escapeLdapFilter(username)})`
```

Also: **never use the user's input as the bind DN directly.** Search anonymously, then bind with the DN you found.

---

### 🔴 CRITICAL #5 — Persist WebAuthn Challenges

**Risk:** High. WebAuthn registration/authentication is currently non-functional AND introduces a challenge-replay risk if the challenge is ever logged.

**Current code (`lib/2fa/webauthn.ts`):**
```ts
challenge: randomChallenge()  // generated but never stored
// later: verifyRegistration({ response, expectedChallenge: ??? })
```

**Fix:** Store the challenge in Redis (5-minute TTL, single-use):
```ts
await redis.setex(`webauthn:challenge:${userId}`, 300, challenge)
```
On verify, read it, compare, then `redis.del()`. The challenge must be one-shot and bound to the user.

---

## 4. Authentication

### 4.1 NextAuth v5 Best Practices

The current setup is on the right track (JWT strategy, PrismaAdapter, OAuth providers). The remaining work:

#### 4.1.1 Migrate to v5 idiom

`lib/auth.ts` currently uses a v4-style export:
```ts
export const authOptions = { ... }
export default NextAuth(authOptions)
```

For v5, refactor to:
```ts
// lib/auth.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },        // 8h
  pages: { signIn: '/login' },
  providers: [ /* ... */ ],
  callbacks: { /* ... */ },
  events: {
    signIn:      async ({ user, account, isNewUser }) => audit('AUTH_LOGIN', { user, account, isNewUser }),
    signOut:     async ({ session }) => audit('AUTH_LOGOUT', { session }),
    createUser:  async ({ user }) => audit('USER_CREATED', { user }),
  },
})
```

Then the API route `[...nextauth].ts` becomes:
```ts
export { GET, POST } from '@/lib/auth'   // re-export handlers
```

And the middleware uses `await auth()` instead of `getToken`.

#### 4.1.2 Session & Token Hardening

```ts
session: {
  strategy: 'jwt',
  maxAge: 8 * 60 * 60,                 // 8h sliding window
  updateAge: 60 * 60,                  // refresh JWT every 1h
},
jwt: {
  maxAge: 8 * 60 * 60,
},
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production' ? '__Secure-auth.session-token' : 'auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  },
},
```

#### 4.1.3 `jwt` callback — enrichment + rotation

```ts
async jwt({ token, user, account, trigger, session }) {
  if (user) {
    token.id = user.id
    token.mfaVerified = false
    token.isSystemAdmin = (user as any).isSystemAdmin ?? false
  }
  if (account) token.provider = account.provider

  // Sliding rotation: bump `iat` on every request after the first 30m
  const now = Math.floor(Date.now() / 1000)
  if (token.iat && now - (token.iat as number) > 30 * 60) {
    token.iat = now
  }

  // Allow re-fetching admin flag (admin can be revoked)
  if (trigger === 'update' && session?.refreshAdminFlag) {
    const u = await prisma.user.findUnique({ where: { id: token.id as string }, select: { isSystemAdmin: true } })
    token.isSystemAdmin = u?.isSystemAdmin ?? false
  }
  return token
}
```

#### 4.1.4 Account linking + provider trust

Multiple providers may share an email. Link accounts by verified email:
```ts
async signIn({ user, account, profile }) {
  if (account?.provider === 'credentials') {
    return true  // credentials are already verified
  }
  // OAuth: only allow if the provider's email is verified
  if (!profile?.email_verified && account?.provider !== 'ldap') {
    return false
  }
  return true
}
```

### 4.2 Password Policy

| Rule | Value | Rationale |
|---|---|---|
| Min length | **12** (NIST 800-63B baseline) | Length > complexity |
| Max length | 128 | bcrypt's 72-byte limit; longer inputs silently truncated |
| Complexity | None required | Length + breach check is sufficient |
| Breach check | **Required** via HIBP k-Anonymity API | Catches "Password1!" |
| Disallow common | Top 1k (e.g., `top10k.txt`) | Cheap blocklist |
| Reuse | Last 5 passwords | Prevents rotate-back |
| Rotation | **Forced 90d for admins**, 365d for users, never for breach | NIST 800-63B §5.1.1.2 |
| Storage | bcrypt **cost 12** (or argon2id) | OWASP recommends 12+ |
| Reset token | crypto.randomBytes(32).toString('base64url') | 256 bits of entropy |
| Reset link TTL | 1h, single-use | Invalidate after use |
| Min timing | Constant-time `bcrypt.compare` | Already in use |

#### 4.2.1 HIBP Integration (k-Anonymity, no plaintext leaves the server)

```ts
// lib/security/haveibeenpwned.ts
import { createHash } from 'crypto'

export async function isPasswordPwned(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },     // hides result count
  })
  if (!res.ok) return false                  // fail open: don't lock people out
  const text = await res.text()
  return text.split('\n').some((line) => line.startsWith(suffix))
}
```

**Important:** `fail open` is correct here — HIBP being down shouldn't break logins. Log the failure to Sentry.

#### 4.2.2 Password change flow

```ts
// pages/api/users/me/password.ts
export default withApiAuth(async (req, res, { session }) => {
  if (req.method !== 'POST') return res.status(405).end()
  const { current, next } = PasswordChangeSchema.parse(req.body)

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  if (!await bcrypt.compare(current, user.passwordHash)) {
    await recordSecurityEvent('PASSWORD_CHANGE_REJECTED', session.user.id, { reason: 'current_mismatch' })
    return res.status(401).json({ code: 'INVALID_CREDENTIALS' })
  }
  if (await isPasswordPwned(next)) {
    return res.status(400).json({ code: 'PASSWORD_PWNED' })
  }
  if (await isInRecentPasswords(session.user.id, next, 5)) {
    return res.status(400).json({ code: 'PASSWORD_RECENTLY_USED' })
  }

  const newHash = await bcrypt.hash(next, 12)
  await prisma.$transaction([
    prisma.userPasswordHistory.create({ data: { userId: user.id, hash: newHash } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
  ])

  // Invalidate all other sessions
  await prisma.session.deleteMany({ where: { userId: user.id, NOT: { sessionToken: getCurrentSessionToken(req) } } })
  await recordSecurityEvent('PASSWORD_CHANGED', user.id)
  return res.status(204).end()
})
```

### 4.3 Multi-Factor Authentication

#### 4.3.1 TOTP (RFC 6238)

Already implemented in `lib/2fa/totp.ts` with `otplib`. Strengthen:
- Algorithm: **SHA256** (drop SHA1) — supported by all modern authenticators
- Digits: 6
- Period: 30s
- Window: ±1 step (totp drift tolerance)
- Replay protection: store the last-accepted counter per user; reject reuse

```ts
async function verifyTotpWithReplayGuard(userId: string, token: string, secret: string) {
  const ok = verifyTotpToken(token, secret, { algorithm: 'SHA256' })
  if (!ok) return false
  // Replay guard via Redis: SETNX key with 60s TTL
  const step = Math.floor(Date.now() / 1000 / 30)
  const set = await redis.set(`totp:used:${userId}:${step}`, '1', 'EX', 60, 'NX')
  return set === 'OK'
}
```

#### 4.3.2 WebAuthn (FIDO2)

Currently in `lib/2fa/webauthn.ts`. The implementation needs the challenges persisted (see CRITICAL #5). Additional hardening:

- **Attestation:** `attestationType: 'none'` (correct for second factor — we don't need to attest the device)
- **User verification:** `userVerification: 'preferred'` for 2FA, `required` for passwordless
- **Resident keys:** `residentKey: 'preferred'` for passwordless
- **Backup-eligible flags:** Store `backupEligible`, `backupState` per credential
- **Sign count:** Verify the counter increases (cloned-key detection)

```ts
// On verify
const cred = await prisma.webAuthnCredential.findUnique({ where: { id: response.id } })
if (cred.signCount > 0 && response.authenticatorData.signCount <= cred.signCount) {
  throw new Error('Possible cloned authenticator')
}
await prisma.webAuthnCredential.update({
  where: { id: cred.id },
  data: { lastUsedAt: new Date(), signCount: response.authenticatorData.signCount },
})
```

#### 4.3.3 SMS (Discouraged but Supported for Legacy)

NIST 800-63B discourages SMS. Provide it but warn users:
- Use a reputable provider (Twilio Verify, AWS SNS with fraud guard)
- Enforce rate limit: 1 code per 30s, max 3 attempts per code, 5 codes per phone per day
- Bind codes to a phone fingerprint (browser + IP + UA hash) and detect SIM-swap signals

```ts
// lib/2fa/sms.ts
import { Twilio } from 'twilio'
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

export async function sendSmsCode(phone: string, code: string) {
  await client.messages.create({
    body: `OpenProject code: ${code}. Do not share.`,
    from: process.env.TWILIO_FROM_NUMBER,
    to: phone,
  })
}
```

#### 4.3.4 Backup Codes

Already in `lib/2fa/backup-codes.ts`. Strengthen:
- 10 codes, 8 chars each, **cryptographically random**
- Hash with bcrypt before storage
- Single-use: mark `usedAt` on consume
- Regenerate invalidates the previous set

```ts
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcryptjs'

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString('hex').match(/.{1,4}/g)!.join('-')
  ) // 4-4-4 format
}
```

#### 4.3.5 MFA Enforcement Policy

| Role | MFA Required | Grace Period |
|---|---|---|
| System admin | **Yes, hard** | None |
| Project admin | Yes, hard | 7 days after role grant |
| Member | Optional | — |
| Anonymous | No | — |

```ts
// In jwt callback
if (user && (user as any).isSystemAdmin && !token.mfaEnabled) {
  // Return a partial token — UI forces enrollment
  token.mfaRequired = true
}
```

### 4.4 Session Management

| Control | Value |
|---|---|
| Access token lifetime | 8h |
| Idle timeout | 30 min (no activity → expire) |
| Refresh strategy | Sliding window; JWT `iat` rotates after 30m |
| Absolute timeout | 8h (re-auth required after) |
| Concurrent sessions | 5 per user (revoke oldest on exceed) |
| Session revocation | On password change: kill all other sessions |
| Device tracking | `UserAgent` + `IP` + hash; user can list/revoke |
| Cookie flags | `HttpOnly; Secure; SameSite=Lax; Path=/` |
| CSRF | Double-submit cookie (NextAuth handles) |

#### 4.4.1 Session Model (DB-backed for revocation)

Currently the project is JWT-only. Add a server-side record for **revocation**:

```prisma
model SessionRecord {
  id           String   @id @default(cuid())
  userId       String
  sessionToken String   @unique  // opaque, stored hashed
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userAgent    String?
  ipAddress    String?
  fingerprint  String?  // SHA-256 of (UA + accept-lang + screen)
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  lastSeenAt   DateTime @default(now())
  revokedAt    DateTime?
  revokedReason String?
  isCurrent    Boolean  @default(false)

  @@index([userId, expiresAt])
  @@index([fingerprint])
}
```

The JWT `sessionToken` becomes an **opaque ID** in the cookie (not the JWT itself). On every request, the middleware:
1. Reads the cookie.
2. Hashes it.
3. Looks up the `SessionRecord`.
4. Verifies `!revokedAt && expiresAt > now`.
5. Updates `lastSeenAt`.

This is a hybrid approach: JWT for stateless validation, DB for **revocation**. This is the same pattern as Auth0's "session tokens."

#### 4.4.2 Device Management UI

```tsx
// pages/settings/sessions.tsx
export default function SessionsPage() {
  const { data: sessions } = useQuery(['sessions'], api.listMySessions)
  const revoke = useMutation(api.revokeSession)
  return (
    <Table>
      {sessions?.map(s => (
        <Row key={s.id} isCurrent={s.isCurrent}>
          <Cell>{s.userAgent}</Cell>
          <Cell>{s.ipAddress}</Cell>
          <Cell>{formatDistanceToNow(s.lastSeenAt)}</Cell>
          <Cell>
            {!s.isCurrent && <Button onClick={() => revoke.mutate(s.id)}>Revoke</Button>}
            {s.isCurrent && <Badge>Current</Badge>}
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
```

### 4.5 OAuth 2.0 Providers

Current: Google + GitHub. Recommended additions:

| Provider | Use Case | Notes |
|---|---|---|
| Google | Consumer/SMB | Already in place |
| GitHub | Dev teams | Already in place |
| GitLab | Dev teams with self-hosted | Add |
| Microsoft | Enterprise | Add (Entra ID) |
| Keycloak | Enterprise self-hosted | Add (OIDC) |
| Apple | Consumer iOS | Optional |
| Auth0 | Multi-tenant | Optional |

#### 4.5.1 Provider Configuration Pattern

```ts
// lib/auth/providers.ts
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import GitlabProvider from 'next-auth/providers/gitlab'
import AzureADProvider from 'next-auth/providers/azure-ad'
import KeycloakProvider from 'next-auth/providers/keycloak'

export const oauthProviders = [
  GoogleProvider({
    clientId: requiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    authorization: { params: { prompt: 'consent', access_type: 'offline' } },
  }),
  GitHubProvider({
    clientId: requiredEnv('GITHUB_CLIENT_ID'),
    clientSecret: requiredEnv('GITHUB_CLIENT_SECRET'),
  }),
  GitlabProvider({
    clientId: requiredEnv('GITLAB_CLIENT_ID'),
    clientSecret: requiredEnv('GITLAB_CLIENT_SECRET'),
  }),
  AzureADProvider({
    clientId: requiredEnv('AZURE_AD_CLIENT_ID'),
    clientSecret: requiredEnv('AZURE_AD_CLIENT_SECRET'),
    tenantId: requiredEnv('AZURE_AD_TENANT_ID'),
  }),
  KeycloakProvider({
    clientId: requiredEnv('KEYCLOAK_CLIENT_ID'),
    clientSecret: requiredEnv('KEYCLOAK_CLIENT_SECRET'),
    issuer: requiredEnv('KEYCLOAK_ISSUER'),
  }),
]
```

**For each provider, you MUST**:
- Store the OAuth client secret in AWS Secrets Manager / Vault, **not** in `.env`
- Set the redirect URI to the **production** domain only (no wildcards)
- Use `state` parameter (NextAuth does this automatically)
- Verify the `id_token` signature (NextAuth does this)
- For organizations: support OIDC `groups` claim → map to internal roles

### 4.6 SAML SSO (Enterprise)

For enterprises that require SAML 2.0 (Okta, OneLogin, ADFS):

**Library:** `@node-saml/node-saml` (successor to `passport-saml`)

```ts
// pages/api/auth/saml/[idp]/login.ts
import { SAML } from '@node-saml/node-saml'
export default async function handler(req, res) {
  const { idp } = req.query
  const idpConfig = await prisma.samlIdentityProvider.findUniqueOrThrow({ where: { slug: idp as string } })
  const saml = new SAML(idpConfig.samlConfig)
  const url = await saml.getAuthorizeUrlAsync('', '', {})
  res.redirect(url)
}
```

**SAML Configuration model:**
```prisma
model SamlIdentityProvider {
  id          String   @id @default(cuid())
  slug        String   @unique  // e.g. "acme-corp"
  displayName String
  entryPoint  String   // IdP SSO URL
  issuer      String   // SP entity ID
  cert        String   // IdP signing cert (PEM)
  privateKey  String   // SP signing/encryption key (PEM, encrypted at rest)
  signatureAlgorithm String @default("sha256")
  digestAlgorithm    String @default("sha256")
  wantAssertionsSigned  Boolean @default(true)
  signAuthnRequests     Boolean @default(true)
  defaultRoleId    String?  // auto-assign role to new JIT users
  attributeMap     Json     // { email: "Email", firstName: "FirstName", groups: "Group" }
  createdAt        DateTime @default(now())
}
```

**JIT Provisioning:** On successful SAML response:
1. Extract NameID, attributes
2. Find or create User (match by `email` or `nameId`)
3. Map SAML groups → internal roles
4. Issue NextAuth session

### 4.7 LDAP / Active Directory Bind Authentication

Currently `lib/ldap/client.ts` has the structure but needs hardening:

#### 4.7.1 LDAP Injection Prevention

See CRITICAL #4 above. Always escape RFC 4515 filter characters and RFC 4514 DN characters.

#### 4.7.2 Anonymous Search → Authenticated Bind

```ts
async function authenticateLdapUser(config: LdapConfig, username: string, password: string) {
  // 1. Search anonymously (or via service account) for the user's DN
  const searchClient = createClient(config)
  await searchClient.bind(config.bindDN, config.bindPassword)
  const { searchEntries } = await searchClient.search({
    base: config.searchBase,
    scope: 'sub',
    filter: `(&(objectClass=user)(uid=${escapeLdapFilter(username)}))`,
  })
  if (searchEntries.length !== 1) return null
  const userDN = searchEntries[0].dn

  // 2. Bind as the user
  const userClient = createClient(config)
  try {
    await userClient.bind(userDN, password)
    return { dn: userDN, attributes: searchEntries[0] }
  } catch (err) {
    return null  // invalid password
  }
}
```

**Never** pass user input as the bind DN directly.

#### 4.7.3 LDAP Configuration Storage

LDAP credentials belong in the secret manager, encrypted at rest. Do not store in `prisma.ldapConfiguration.password` as plaintext.

#### 4.7.4 Multiple LDAP Sources

For enterprises with multiple forests, allow chaining. Resolve by `domain` suffix in the email (`@corp.example.com` → LDAP server A).

### 4.8 SCIM 2.0 Provisioning

For automated user provisioning from Okta/Azure AD/Google Workspace:

#### 4.8.1 Endpoints

```
POST   /api/scim/v2/Users              # create
GET    /api/scim/v2/Users              # list (filter, startIndex, count)
GET    /api/scim/v2/Users/{id}         # read
PUT    /api/scim/v2/Users/{id}         # replace
PATCH  /api/scim/v2/Users/{id}         # partial update
DELETE /api/scim/v2/Users/{id}         # deactivate (soft delete in OP)
POST   /api/scim/v2/Groups             # create group
PATCH  /api/scim/v2/Groups/{id}        # change members
```

#### 4.8.2 Auth

SCIM endpoints authenticate with a **bearer token** per tenant:

```ts
// middleware: /api/scim/** requires Authorization: Bearer <scim-token>
const token = req.headers.authorization?.replace('Bearer ', '')
const scimConfig = await prisma.scimConfig.findFirst({ where: { tokenHash: hashScimToken(token) } })
if (!scimConfig) return res.status(401).end()
```

Tokens are generated once, shown to the admin, then stored hashed. No recovery — admin must regenerate.

#### 4.8.3 Schema (User)

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "alice@acme.com",
  "name": { "givenName": "Alice", "familyName": "Smith" },
  "emails": [{ "value": "alice@acme.com", "primary": true }],
  "active": true,
  "externalId": "okta-12345"
}
```

Map SCIM `active: false` → set `User.status = 'locked'`. Do not hard-delete.

---

## 5. Authorization (RBAC + ABAC)

### 5.1 Model: Hybrid RBAC + ABAC

**RBAC** (Role-Based Access Control) for coarse project membership:
- User → Member → Role → Permissions

**ABAC** (Attribute-Based Access Control) for fine-grained conditions:
- A user can edit a work package **IF** `role.permissions ⊇ WORK_PACKAGE_EDIT` **AND** `wp.projectId ∈ user's projects` **AND** `wp.status NOT IN ('closed')` **AND** `user.id = wp.author OR user.role.isReporter`.

#### 5.1.1 Permission Constants

```ts
// lib/permissions/constants.ts
export const PERMISSIONS = {
  // Project
  PROJECT_VIEW: 'project.view',
  PROJECT_EDIT: 'project.edit',
  PROJECT_DELETE: 'project.delete',
  PROJECT_CREATE: 'project.create',
  // Work package
  WORK_PACKAGE_VIEW: 'work_package.view',
  WORK_PACKAGE_CREATE: 'work_package.create',
  WORK_PACKAGE_EDIT: 'work_package.edit',
  WORK_PACKAGE_DELETE: 'work_package.delete',
  WORK_PACKAGE_COMMENT: 'work_package.comment',
  WORK_PACKAGE_ASSIGN: 'work_package.assign',
  // Wiki
  WIKI_VIEW: 'wiki.view',
  WIKI_EDIT: 'wiki.edit',
  WIKI_DELETE: 'wiki.delete',
  // Forum
  FORUM_VIEW: 'forum.view',
  FORUM_POST: 'forum.post',
  FORUM_MODERATE: 'forum.moderate',
  // Time
  TIME_ENTRY_LOG_OWN: 'time_entry.log_own',
  TIME_ENTRY_LOG_ANY: 'time_entry.log_any',
  TIME_ENTRY_APPROVE: 'time_entry.approve',
  // Admin
  ADMIN_USERS: 'admin.users',
  ADMIN_ROLES: 'admin.roles',
  ADMIN_SETTINGS: 'admin.settings',
  ADMIN_AUDIT_LOG: 'admin.audit_log',
  ADMIN_SECURITY: 'admin.security',
} as const
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
```

#### 5.1.2 Built-in Roles

| Role | Permissions |
|---|---|
| **Anonymous** | (none) |
| **Member** | view own projects, log time |
| **Reporter** | + create WP, comment |
| **Developer** | + edit assigned WP, view wiki |
| **Project Manager** | + edit any WP, manage members, edit wiki |
| **Project Admin** | + delete WP, manage project settings |
| **System Admin** | + everything (global) |

### 5.2 Permission Inheritance

Subprojects inherit parent project membership **unless explicitly overridden**:

```ts
async function getEffectiveRoles(userId: string, projectId: string): Promise<Role[]> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { parent: true },
  })

  // Direct membership
  const direct = await prisma.member.findMany({
    where: { userId, projectId },
    include: { role: true },
  })
  if (direct.length > 0) return direct.map(d => d.role)

  // Group membership (user is in a group that's a member)
  const groupMembers = await prisma.member.findMany({
    where: {
      projectId,
      principalType: 'GROUP',
      principal: { in: await getUserGroupIds(userId) },
    },
    include: { role: true },
  })
  if (groupMembers.length > 0) return groupMembers.map(g => g.role)

  // Inherit from parent (if not explicitly opted out)
  if (project.parentId && project.inheritMembers) {
    return getEffectiveRoles(userId, project.parentId)
  }

  return []
}
```

`Project.inheritMembers Boolean @default(true)` — set false to make a subproject private.

### 5.3 Resource-Level Permissions

Some resources have ownership semantics:
- **Work package author** can edit their own WP regardless of role
- **Wiki page author** can edit their own wiki page
- **Forum post author** can edit their own post (within 30 min) and delete always

```ts
// lib/permissions/check.ts
type Policy = (ctx: { user, resource?, action, request }) => boolean | PolicyResult

const policies: Record<Permission, Policy> = {
  WORK_PACKAGE_EDIT: async ({ user, resource: wp }) => {
    if (!wp) return false
    if (wp.authorId === user.id) return true
    return hasRolePermissionOnProject(user.id, wp.projectId, 'WORK_PACKAGE_EDIT')
  },
  // ...
}
```

### 5.4 Custom Roles

Custom roles are stored in DB. The `permissions` field is a `String[]` (Postgres array). The UI exposes a permission matrix (role × permission checkboxes).

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String
  position    Int      // sort order
  permissions String[] // array of permission strings
  builtin     Boolean  @default(false)  // built-in roles can't be deleted
  assignable  Boolean  @default(true)
  members     Member[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Note on validation:** Server must reject unknown permission strings. Maintain an allowlist:
```ts
const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS))
```

### 5.5 Permission Decision Point (PDP) Library

Centralize all permission checks in `lib/permissions/check.ts`:

```ts
interface AccessRequest {
  user: { id: string; isSystemAdmin: boolean }
  action: Permission
  resource?: { type: string; id: string; ownerId?: string; projectId?: string; status?: string }
}

export async function can(req: AccessRequest): Promise<boolean> {
  if (req.user.isSystemAdmin) return true
  if (!req.resource) return hasGlobalPermission(req.user.id, req.action)
  return evaluatePolicy(req.action, req.user, req.resource)
}

export async function authorizeOrThrow(req: AccessRequest): Promise<void> {
  if (!(await can(req))) {
    await recordSecurityEvent('ACCESS_DENIED', req.user.id, { action: req.action, resource: req.resource })
    throw new ForbiddenError(`Missing permission: ${req.action}`)
  }
}
```

**Rule:** No API route ever calls `getServerSession` and then does the work. It calls `authorizeOrThrow({ user, action, resource })`. The `getServerSession` call is a single line in `withApiAuth`.

### 5.6 Global Roles (System Admin)

```ts
// lib/permissions/global.ts
const GLOBAL_PERMISSIONS = new Set([
  'admin.users', 'admin.roles', 'admin.settings', 'admin.audit_log', 'admin.security',
])

async function hasGlobalPermission(userId: string, action: Permission): Promise<boolean> {
  if (!GLOBAL_PERMISSIONS.has(action)) return false
  return isSystemAdmin(userId)
}
```

### 5.7 Authorization Gap Analysis (Current Code)

**Action:** Run this audit script to find routes with no permission check:

```bash
# Find API routes that don't import any permission helper
for f in $(find pages/api -name "*.ts" -not -name "[...nextauth].ts" -not -name "health*"); do
  if ! grep -qE "checkWorkPackagePermission|requireWorkPackagePermission|isSystemAdmin|authorizeOrThrow" "$f"; then
    echo "GAP: $f"
  fi
done
```

**Expected gaps (before fix):** most routes in `wiki/`, `forums/`, `documents/`, `time-entries/`, `groups/`, `queries/`, etc.

**After:** every API route imports and uses `withApiAuth` (which transitively calls `authorizeOrThrow`).

---

## 6. API Security

### 6.1 Rate Limiting

The current `lib/ratelimit.ts` is a single global limiter (10 req/s per IP). This is too coarse. Per-endpoint tiers:

| Tier | Limit | Scope | Endpoints |
|---|---|---|---|
| **Auth** | 5 / 15min | IP | `POST /api/auth/callback/credentials`, `POST /api/auth/2fa/verify` |
| **Login** | 10 / hour | email | `POST /api/auth/callback/credentials` |
| **Mutation** | 30 / min | user | `POST /api/work-packages`, `PATCH /api/work-packages/[id]` |
| **Read** | 300 / min | user | `GET /api/work-packages` |
| **Search** | 60 / min | user | `GET /api/search` |
| **Export** | 5 / hour | user | `GET /api/exports/*` |
| **Webhooks** | 100 / min | source IP | `POST /api/webhooks/[id]` |
| **SCIM** | 1000 / hour | tenant | `* /api/scim/*` |
| **Global** | 600 / 10min | IP | All API |

#### 6.1.1 Implementation with @upstash/ratelimit (already in deps)

```ts
// lib/ratelimit/limiters.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const limiters = {
  auth:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'),  prefix: 'rl:auth' }),
  login:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'),  prefix: 'rl:login' }),
  mutation:new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'),  prefix: 'rl:mut' }),
  read:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(300, '1 m'), prefix: 'rl:read' }),
  search:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'),  prefix: 'rl:srch' }),
  export:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'),   prefix: 'rl:exp' }),
}

export async function rateLimit(
  scope: keyof typeof limiters,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  return limiters[scope].limit(identifier)
}
```

**Fail closed for auth, fail open for read** — losing Redis should not break the app for read traffic, but should not allow unlimited auth attempts.

```ts
const result = await rateLimit('auth', ip).catch(() => ({ success: true })) // fail open
if (!result.success) return res.status(429).json({ code: 'RATE_LIMITED', reset: result.reset })
```

### 6.2 CORS Strict Allowlist

**Current state:** Likely `Access-Control-Allow-Origin: *` or no CORS configured. Both are bad for an API serving authenticated requests.

```ts
// lib/api/cors.ts
const ALLOWED_ORIGINS = new Set([
  process.env.APP_URL!,
  'https://app.openproject.com',
  'https://staging.openproject.com',
  // mobile apps can use null origin with no credentials
])

export function corsHeaders(req: NextApiRequest): Record<string, string> {
  const origin = req.headers.origin
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
```

**Never** reflect arbitrary origins. **Never** use `*` with credentials.

### 6.3 CSP, HSTS, and Friends

See [Section 16](#16-security-headers-middleware) for the middleware implementation.

### 6.4 Request Size Limits

```ts
// lib/api/body-limit.ts
export const BODY_LIMITS = {
  '/api/files/upload':      50 * 1024 * 1024,  // 50 MB
  '/api/avatars/upload':     2 * 1024 * 1024,  // 2 MB
  '/api/wiki/attachments':  20 * 1024 * 1024,  // 20 MB
  default:                   1 * 1024 * 1024,  // 1 MB
}
```

Apply in middleware or in the route handler:
```ts
const declared = Number(req.headers['content-length'] ?? 0)
const limit = BODY_LIMITS[req.url ?? '/'] ?? BODY_LIMITS.default
if (declared > limit) return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE' })
```

For streaming uploads, use multipart parser that aborts at limit.

### 6.5 Idempotency Keys

Required for `POST /api/work-packages`, `POST /api/time-entries`, `POST /api/comments`, `POST /api/payments` (if any), `POST /api/webhooks/outgoing`.

```ts
// lib/api/idempotency.ts
import { createHash } from 'crypto'

const redis = Redis.fromEnv()

export async function withIdempotency(
  req: NextApiRequest,
  scope: string,
  handler: () => Promise<{ status: number; body: unknown }>
): Promise<{ status: number; body: unknown }> {
  const key = req.headers['idempotency-key'] as string | undefined
  if (!key) return handler()  // no key, run normally (caller accepts the risk)

  const fingerprint = createHash('sha256').update(scope + ':' + key).digest('hex')
  const cacheKey = `idem:${fingerprint}`

  // Try to acquire the lock
  const set = await redis.set(cacheKey, 'pending', 'EX', 86400, 'NX')  // 24h TTL
  if (set !== 'OK') {
    // Existing entry — return cached response
    const cached = await redis.get(`idem:resp:${fingerprint}`)
    if (cached) {
      return JSON.parse(cached)
    }
    throw new Error('CONCURRENT_REQUEST')  // request is in flight
  }

  try {
    const result = await handler()
    await redis.set(`idem:resp:${fingerprint}`, JSON.stringify(result), 'EX', 86400)
    return result
  } catch (err) {
    await redis.del(cacheKey)  // clear on failure so caller can retry
    throw err
  }
}
```

Client pattern:
```ts
// Client sends the same Idempotency-Key for retries
await fetch('/api/work-packages', {
  method: 'POST',
  headers: { 'Idempotency-Key': requestId },
  body: JSON.stringify(data),
})
```

### 6.6 API Versioning

Already partial: `pages/api/v3/` exists. Recommendation:
- `/api/v3/*` — current stable
- `/api/v4/*` — under development, behind feature flag
- Never break v3; add new fields, deprecate old with `Sunset` header

```ts
res.setHeader('Deprecation', 'true')
res.setHeader('Sunset', 'Sat, 01 Jan 2028 00:00:00 GMT')
res.setHeader('Link', '</api/v4/work-packages>; rel="successor-version"')
```

---

## 7. Data Security

### 7.1 Encryption at Rest

PostgreSQL options:
1. **Disk-level** (AWS RDS, GCP Cloud SQL): enables TDE by default
2. **Column-level**: `pgcrypto` for sensitive fields
3. **Application-level** (recommended for PII): encrypt before write, decrypt on read

#### 7.1.1 pgcrypto for PII Columns

```sql
-- Migration
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User"
  ADD COLUMN phone_encrypted BYTEA,
  ADD COLUMN address_encrypted BYTEA;

-- Use a dedicated encryption key (from KMS, not env)
-- pgp_sym_encrypt takes the data + passphrase; we use a server-side key
```

But **better:** application-level encryption with envelope encryption. The DB never sees the key.

#### 7.1.2 Application-Level Field Encryption

```ts
// lib/security/field-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { getDataKey } from './kms'   // wraps AWS KMS, Vault, etc.

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

export async function encryptField(plaintext: string, context: Record<string, string> = {}): Promise<Buffer> {
  const dataKey = await getDataKey('pii')   // 32 bytes, cached for 1h
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, dataKey, iv)
  cipher.setAAD(Buffer.from(JSON.stringify(context)))
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // [version:1][iv:12][tag:16][ciphertext]
  return Buffer.concat([Buffer.from([1]), iv, tag, enc])
}

export async function decryptField(ciphertext: Buffer, context: Record<string, string> = {}): Promise<string> {
  const version = ciphertext[0]
  if (version !== 1) throw new Error('Unsupported ciphertext version')
  const iv = ciphertext.subarray(1, 13)
  const tag = ciphertext.subarray(13, 29)
  const dataKey = await getDataKey('pii')
  const decipher = createDecipheriv(ALGO, dataKey, iv)
  decipher.setAuthTag(tag)
  decipher.setAAD(Buffer.from(JSON.stringify(context)))
  const dec = Buffer.concat([decipher.update(ciphertext.subarray(29)), decipher.final()])
  return dec.toString('utf8')
}
```

#### 7.1.3 KMS Integration

**AWS KMS:**
```ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms'
const kms = new KMSClient({})
const cache = new Map<string, { key: Buffer; expires: number }>()

export async function getDataKey(keyId: string): Promise<Buffer> {
  const cached = cache.get(keyId)
  if (cached && cached.expires > Date.now()) return cached.key
  const { Plaintext, CiphertextBlob } = await kms.send(new GenerateDataKeyCommand({
    KeyId: process.env.KMS_KEY_ID,
    KeySpec: 'AES_256',
    EncryptionContext: { purpose: keyId },
  }))
  cache.set(keyId, { key: Buffer.from(Plaintext!), expires: Date.now() + 60 * 60 * 1000 })
  return Buffer.from(Plaintext!)
}
```

#### 7.1.4 Fields to Encrypt

| Model.Field | Encrypt? | Why |
|---|---|---|
| `User.email` | Hash (HMAC) for search; encrypt for display | Email is PII |
| `User.phone` | Encrypt | PII |
| `User.address` | Encrypt | PII |
| `User.ipAddress` (audit log) | Hash (HMAC) | Privacy |
| `User.passwordHash` | bcrypt | Already |
| `User.twoFactorSecret` | Encrypt at rest | Critical |
| `User.backupCodes` | bcrypt | Already? Verify |
| `ApiKey.token` | bcrypt or argon2 | Server stores only hash |
| `Webhook.secret` | Encrypt | Used for HMAC signing |
| `OAuthAccount.accessToken` | Encrypt at rest | PII / privileged |
| `OAuthAccount.refreshToken` | Encrypt at rest | Privileged |
| `Project.description` | Not encrypted | Public to members |
| `WorkPackage.description` | Not encrypted | Public to members |

#### 7.1.5 Email Search Without Decryption

For "search users by email" without decrypting every email:
- Store `email_hash = HMAC-SHA256(email, search_key)` where `search_key` is a separate KMS key
- The hash is deterministic and searchable
- The `email` field is encrypted with a different key (display)

This is a **blind index** pattern. Tradeoff: hash compromise reveals all emails.

### 7.2 Encryption in Transit

| Hop | Protocol | TLS Version |
|---|---|---|
| Browser ↔ Next.js | HTTPS | TLS 1.3 (1.2 minimum) |
| Next.js ↔ Postgres | TLS | TLS 1.3 (verify-full mode) |
| Next.js ↔ Redis | TLS | TLS 1.3 (if Upstash) |
| Next.js ↔ S3 | HTTPS | TLS 1.3 |
| Next.js ↔ SMTP | STARTTLS | TLS 1.3 |
| Next.js ↔ Webhook consumers | HTTPS | TLS 1.2+ |

**Prisma TLS:**
```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // For Prisma 7, sslmode is in the URL: ?sslmode=verify-full&sslrootcert=...
}
```
Or in `DATABASE_URL`: `postgresql://user:pass@host:5432/db?sslmode=verify-full`

### 7.3 API Token Storage

**API tokens** (`ApiKey.token` or `PersonalAccessToken.token`) are bearer credentials. Store only the hash:

```ts
// Generation
export function generateApiToken(): { plain: string; hash: string } {
  const plain = `op_pat_${randomBytes(32).toString('base64url')}`  // ~43 chars
  const hash = argon2.hash(plain)  // argon2id
  return { plain, hash }
}

// Verification
export async function verifyApiToken(plain: string): Promise<User | null> {
  // Constant-time loop over all tokens is bad. Use prefix index.
  const prefix = plain.slice(0, 12)  // "op_pat_xxxx"
  const candidates = await prisma.apiKey.findMany({
    where: { tokenPrefix: prefix },
    select: { id: true, userId: true, tokenHash: true, expiresAt: true, scopes: true },
  })
  for (const c of candidates) {
    if (c.expiresAt && c.expiresAt < new Date()) continue
    if (await argon2.verify(c.tokenHash, plain)) {
      return prisma.user.findUniqueOrThrow({ where: { id: c.userId } })
    }
  }
  return null
}
```

The **prefix** is indexed, so verification is O(log N) not O(N). Argon2id is preferred over bcrypt here because tokens are high-entropy (unlike passwords) and argon2 is faster at high memory cost — making brute force impractical.

**Why argon2id over bcrypt for tokens:**
- bcrypt truncates at 72 bytes (irrelevant for tokens but indicative of age)
- argon2id is memory-hard, slowing GPU attacks
- OWASP 2024 recommends argon2id for new applications

### 7.4 Secret Management

**Never** commit secrets to git. **Never** log secrets.

| Secret | Storage | Rotation |
|---|---|---|
| `NEXTAUTH_SECRET` | AWS Secrets Manager / Vault | 90d |
| `DATABASE_URL` | Secrets Manager | 90d |
| `REDIS_URL` | Secrets Manager | 90d |
| `S3_*` | Secrets Manager | 180d |
| OAuth client secrets | Secrets Manager (per provider) | 180d |
| SMTP password | Secrets Manager | 180d |
| Webhook signing secret | DB (encrypted) | 90d |
| User 2FA secret | DB (encrypted) | On regeneration |
| KMS data keys | AWS KMS | Auto-rotation 365d |
| SSL/TLS certs | ACM / cert-manager | 90d (auto-renew) |

```ts
// lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
const sm = new SecretsManagerClient({})
const cache = new Map<string, { value: string; expires: number }>()

export async function getSecret(name: string): Promise<string> {
  const cached = cache.get(name)
  if (cached && cached.expires > Date.now()) return cached.value
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: name }))
  cache.set(name, { value: SecretString!, expires: Date.now() + 5 * 60 * 1000 })  // 5min cache
  return SecretString!
}
```

**Boot-time validation:**
```ts
// instrumentation.ts
const required = ['NEXTAUTH_SECRET', 'DATABASE_URL', 'REDIS_URL', 'ENCRYPTION_KEY_ID']
for (const key of required) {
  if (!process.env[key]) {
    Sentry.captureMessage(`Missing required env var: ${key}`, 'error')
    throw new Error(`Missing required env var: ${key}`)
  }
}
```

---

## 8. Input Security

### 8.1 Zod Validation on ALL Inputs

Single rule: **the first line of every API route parses `req.body` through a Zod schema**. No exceptions. The backend expert already specified this; this section reinforces it with the security angle.

```ts
// lib/schemas/work-package.ts
import { z } from 'zod'

export const WorkPackageCreateSchema = z.object({
  subject: z.string().min(3).max(255),
  description: z.string().max(65_535).transform(sanitizeHtml),  // auto-sanitize
  typeId: z.string().cuid(),
  statusId: z.string().cuid(),
  priorityId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  estimatedHours: z.number().positive().max(10_000).nullable().optional(),
  customFields: z.record(z.string().cuid(), z.union([z.string(), z.number(), z.boolean()])).optional(),
}).strict()  // .strict() rejects unknown keys
.refine(d => !d.dueDate || !d.startDate || d.dueDate >= d.startDate, {
  message: 'dueDate must be after startDate',
  path: ['dueDate'],
})

export type WorkPackageCreate = z.infer<typeof WorkPackageCreateSchema>
```

**Why `.strict()`:** Catches typos and prevents mass-assignment. If the client sends `isSystemAdmin: true` in the body, Zod strips it (or with `.strict()`, rejects the request).

#### 8.1.1 Common Patterns

```ts
// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1).max(1000),
  pageSize: z.coerce.number().int().positive().default(20).max(100),
  sortBy: z.enum(['createdAt', 'updatedAt', 'subject']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// IDs
export const IdSchema = z.object({ id: z.string().cuid() })

// File upload metadata
export const FileUploadMetaSchema = z.object({
  filename: z.string().min(1).max(255).refine(s => !/[\\\/]/.test(s), 'No path separators'),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(50 * 1024 * 1024),
})
```

### 8.2 DOMPurify for Rich Text

`isomorphic-dompurify` is already in deps. The pattern:

```ts
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
                      'ul', 'ol', 'li', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'rel', 'target']
const FORBID_ATTR = ['style', 'onerror', 'onload', 'onclick']  // XSS vectors

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  })
}
```

**Apply to:**
- Work package description
- Wiki page body
- Forum post body
- Comment body
- Document body
- User bio / signature

**Apply at write time, not read time** (write-side is the contract; reads don't need to re-sanitize).

#### 8.2.1 Markdown Sanitization

If you accept Markdown, sanitize the rendered HTML, not the Markdown source:
```ts
import { marked } from 'marked'
const html = marked.parse(markdown)
const safe = DOMPurify.sanitize(html)
```

**Never** use `dangerouslySetInnerHTML` without sanitization.

### 8.3 SQL Injection Prevention

**Status:** Prisma 7 uses parameterized queries by default. **Verify with:**
```bash
# This should produce 0 hits (Prisma should not interpolate user input into SQL)
grep -rn "\$queryRaw\|\$executeRaw" pages/ | grep -v "Prisma.sql" | grep -v "// "
```

**Rules:**
1. **Prefer `prisma.findMany` over `$queryRaw`** unless you need joins or features Prisma can't express.
2. **If using `$queryRaw`**, always use `Prisma.sql\`...\`` tagged templates:
   ```ts
   // ✅ Safe
   const users = await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${email}`
   // ❌ Vulnerable
   const users = await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE email = '${email}'`)
   ```
3. **Order/column names from user input**: validate against an allowlist (column name can't be parameterized):
   ```ts
   const ALLOWED_SORT_COLUMNS = new Set(['createdAt', 'updatedAt', 'subject'])
   if (!ALLOWED_SORT_COLUMNS.has(sortBy)) throw new BadRequestError('Invalid sortBy')
   const orderBy = { [sortBy]: sortOrder }   // safe: key is from allowlist
   ```

### 8.4 XSS Prevention

Layers:
1. **React's default escaping** (covers 90%)
2. **DOMPurify** for any `dangerouslySetInnerHTML`
3. **CSP** to block inline scripts (defense-in-depth)
4. **HttpOnly cookies** for session (JS can't steal)
5. **URL validation** for `href`/`src`:
   ```ts
   const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
   function safeUrl(url: string): string {
     try {
       const u = new URL(url)
       if (!SAFE_PROTOCOLS.has(u.protocol)) return '#'
       return u.toString()
     } catch { return '#' }
   }
   ```

### 8.5 CSRF Protection

**Status:** NextAuth handles CSRF for its own callback routes (double-submit cookie pattern). **Gap:** custom POST endpoints outside NextAuth are unprotected.

**Solution:** Apply a CSRF middleware to all state-changing routes.

```ts
// lib/api/csrf.ts
import { createHmac, timingSafeEqual } from 'crypto'

const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'

export function csrfProtection(req: NextApiRequest): boolean {
  // Safe methods don't need CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? '')) return true

  const cookie = req.cookies[CSRF_COOKIE]
  const header = req.headers[CSRF_HEADER] as string | undefined
  if (!cookie || !header) return false

  // Cookie is HMAC-signed
  const expected = signCsrfToken(cookie.split('.')[0])
  const provided = header

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

function signCsrfToken(token: string): string {
  return createHmac('sha256', process.env.CSRF_SECRET!).update(token).digest('base64url')
}
```

**Client side** — NextAuth's `useSession()` hook exposes `csrfToken` (when using the Pages Router + `getCsrfToken` from server). Send it as `X-CSRF-Token` on every mutation:

```ts
// lib/fetcher.ts
export const apiFetch = async (url: string, init?: RequestInit) => {
  const csrf = await getCsrfToken()   // or from session
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'X-CSRF-Token': csrf,
    },
    credentials: 'include',
  })
}
```

**Important:** For SPAs that call API routes from a different origin, CSRF must be paired with **CORS allowlist** + `SameSite=Lax` cookies.

### 8.6 Path Traversal Prevention

Wherever you read or write files by user-supplied path:

```ts
import { resolve, sep } from 'path'

function safeJoin(base: string, ...parts: string[]): string {
  const resolved = resolve(base, ...parts)
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    throw new Error('Path traversal attempt')
  }
  return resolved
}

// S3 keys
function safeS3Key(userPath: string): string {
  return userPath
    .replace(/^\/+/, '')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
    .replace(/\.\./g, '%2E%2E')  // belt and suspenders
}
```

For S3, **prefer generated keys** over user-supplied ones:
```ts
const key = `uploads/${userId}/${cuid()}/${sanitize(filename)}`
```

### 8.7 File Upload Validation

Three-layer validation:

#### 8.7.1 Size + MIME (cheap, first line)

```ts
if (file.size > MAX_SIZE) throw new ValidationError('File too large')
if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new ValidationError('Disallowed type')
```

#### 8.7.2 Magic Bytes (authoritative)

```ts
// lib/security/magic-bytes.ts
import { readFile } from 'fs/promises'

const MAGIC = {
  'image/png':  Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),  // RIFF (WebP container)
  'image/gif':  Buffer.from([0x47, 0x49, 0x46]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),  // %PDF
}

export async function validateMagicBytes(filePath: string, declaredType: string): Promise<boolean> {
  const fd = await readFile(filePath, { flag: 'r' })
  const header = fd.subarray(0, 8)
  const expected = MAGIC[declaredType as keyof typeof MAGIC]
  return expected ? header.subarray(0, expected.length).equals(expected) : false
}
```

**Use `file-type` package** (magic-byte detection across all formats):
```ts
import { fileTypeFromBuffer } from 'file-type'
const detected = await fileTypeFromBuffer(buffer)
if (detected?.mime !== declaredType) throw new ValidationError('MIME mismatch')
```

#### 8.7.3 Antivirus (ClamAV)

For environments handling user uploads:

```ts
// lib/security/av-scan.ts
import { NodeClam } from 'clamscan'

const clam = await new NodeClam().init({
  removeInfected: true,
  quarantineInfected: false,
  scanLog: '/var/log/clamav/scan.log',
  debugMode: false,
  fileList: null,
  scanRecursive: true,
  clamscan: {
    path: '/usr/bin/clamscan',
    scanArchives: true,
    active: process.env.NODE_ENV === 'production',
  },
})

export async function scanFile(path: string): Promise<{ isInfected: boolean; viruses: string[] }> {
  const { goodFiles, badFiles } = await clam.scanFile(path)
  return { isInfected: badFiles.length > 0, viruses: badFiles }
}
```

Run as a background job (BullMQ) — don't block the upload response.

#### 8.7.4 Image-Specific Hardening

For image uploads, **re-encode** to strip EXIF metadata and embedded payloads:
```ts
import sharp from 'sharp'
const sanitized = await sharp(buffer)
  .rotate()   // auto-rotate based on EXIF, then strip
  .toFormat('webp', { quality: 85 })
  .toBuffer()
```

For SVG, **never trust user-provided SVG** (it can contain `<script>`). Either reject SVG or run through `DOMPurify` with a strict SVG profile.

---

## 9. Audit, Monitoring & Detection

### 9.1 Audit Log

Capture every state-changing action. Schema:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  actorId     String?  // null = system action
  actorType   String   @default("user")  // user, system, api_key, scim
  action      String   // "WORK_PACKAGE_CREATED", "ROLE_UPDATED", "USER_DELETED", etc.
  resourceType String  // "WorkPackage", "Role", "User"
  resourceId   String?
  projectId    String?  // for project-scoped resources
  changes     Json?    // { before: {...}, after: {...} } diff
  metadata    Json?    // request_id, ip, user_agent, etc.
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([resourceType, resourceId, createdAt])
  @@index([projectId, createdAt])
  @@index([action, createdAt])
}
```

**What to log:**
- Auth: login, logout, failed login, 2FA enroll/disable, password change, password reset request
- User: create, update (with diff), delete, role change, status change (active/locked)
- Project: create, update, archive, delete, member add/remove, role change
- Work package: create, update (with diff), comment, status change, delete
- Wiki: create, update, delete, attachment
- Admin: settings change, role permission change, API key create/revoke
- Security: permission denial, suspicious activity, account lockout

**What NOT to log:**
- Passwords (even hashed)
- API tokens (only their creation/revocation)
- 2FA secrets
- Session tokens
- Credit card numbers, PII in cleartext

#### 9.1.1 Audit Logger

```ts
// lib/audit.ts
import { prisma } from './prisma'

export async function audit(
  action: string,
  options: {
    actorId?: string | null
    actorType?: 'user' | 'system' | 'api_key' | 'scim'
    resourceType?: string
    resourceId?: string
    projectId?: string
    changes?: { before?: unknown; after?: unknown }
    metadata?: Record<string, unknown>
    req?: NextApiRequest
  } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.actorId ?? null,
        actorType: options.actorType ?? 'user',
        action,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        projectId: options.projectId,
        changes: options.changes as any,
        metadata: options.metadata as any,
        ipAddress: hashIp(options.req?.headers['x-forwarded-for'] ?? options.req?.socket?.remoteAddress),
        userAgent: options.req?.headers['user-agent'],
      },
    })
  } catch (err) {
    // Never let audit failure break the request
    Sentry.captureException(err, { tags: { area: 'audit' } })
  }
}
```

#### 9.1.2 Diff Generation

```ts
import { diff } from 'deep-diff'

const before = await prisma.workPackage.findUnique({ where: { id } })
const after = await prisma.workPackage.update({ where: { id }, data: input })
const changes = diff(before, after)  // structured diff
await audit('WORK_PACKAGE_UPDATED', { changes, resourceId: id, ... })
```

**Privacy in audit log:** the `changes` field can contain PII (e.g., `email` field updated). For GDPR, the audit log is part of the user's data and must be exportable. Consider storing only IDs of PII fields, not the PII itself.

### 9.2 Security Event Log

Separate from the business audit log. Higher severity, alertable.

```prisma
model SecurityEvent {
  id        String   @id @default(cuid())
  type      String   // "FAILED_LOGIN", "ACCOUNT_LOCKED", "PERMISSION_DENIED", "SUSPICIOUS_IP"
  severity  String   // "info", "warning", "critical"
  userId    String?
  ipAddress String?
  userAgent String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([type, createdAt])
  @@index([userId, createdAt])
  @@index([severity, createdAt])
}
```

**Events:**
- `FAILED_LOGIN` — 5+ in 15min → lock account
- `ACCOUNT_LOCKED` — admin alert
- `PERMISSION_DENIED` — 10+ in 5min → suspicious
- `MFA_BYPASS_ATTEMPT` — user disabled 2FA unexpectedly
- `NEW_DEVICE_LOGIN` — email user
- `IMPOSSIBLE_TRAVEL` — login from new geo
- `BRUTE_FORCE` — 50+ failed logins in 1h from same IP
- `SQL_INJECTION_ATTEMPT` — request body matches SQLi regex
- `XSS_ATTEMPT` — request body matches XSS regex
- `PRIVILEGE_ESCALATION` — user got a new role
- `ADMIN_ACTION` — admin changed a setting

### 9.3 Anomaly Detection

Rules (implement in `lib/security/anomaly.ts`):

```ts
const RULES = {
  BRUTE_FORCE: { window: '15m', threshold: 10, action: 'rate_limit+alert' },
  IMPOSSIBLE_TRAVEL: { checkGeo: true, action: 'require_2fa' },
  UNUSUAL_VOLUME: { window: '1h', multiplier: 5, baseline: '7d_avg', action: 'throttle' },
  UNUSUAL_TIME: { outsideBusinessHours: true, action: 'log' },
  NEW_IP: { firstSeenInDays: 30, action: 'notify' },
  PRIVILEGE_ESCALATION: { action: 'require_admin_approval' },
  PERMISSION_ENUMERATION: { window: '5m', uniqueResources: 50, action: 'lock' },
}
```

Implement using Redis sliding windows + baseline profiles.

### 9.4 Sentry Integration

Sentry is already configured. Add **beforeSend** hook to scrub PII:

```ts
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
      event.user.id = hash(event.user.id)  // pseudonymous
    }
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers?.['authorization']
      delete event.request.headers?.['cookie']
    }
    return event
  },
  // ...
})
```

Sentry alerts (configure in Sentry UI):
- Failed login spike → Slack #security
- Permission denial burst → Slack #security
- New admin action → Slack #admin-audit
- 5xx spike → PagerDuty

### 9.5 Application Metrics

Add Prometheus metrics (already `metrics.ts` in code):

```ts
// lib/metrics.ts (additions)
export const SecurityMetrics = {
  failedLogins: new Counter({ name: 'auth_failed_logins_total', labelNames: ['reason'] }),
  successfulLogins: new Counter({ name: 'auth_successful_logins_total', labelNames: ['method', 'mfa'] }),
  permissionDenials: new Counter({ name: 'authz_permission_denials_total', labelNames: ['permission'] }),
  rateLimited: new Counter({ name: 'ratelimit_blocked_total', labelNames: ['scope'] }),
  mfaEnrollments: new Counter({ name: 'mfa_enrollments_total', labelNames: ['type'] }),
  apiKeyUsage: new Counter({ name: 'api_key_usage_total', labelNames: ['scope'] }),
  securityEvents: new Counter({ name: 'security_events_total', labelNames: ['type', 'severity'] }),
}
```

Expose via `/api/metrics` (Prometheus scrape endpoint, IP-restricted).

---

## 10. OWASP Top 10 (2021) Review

Mapping current code vs. each item:

| OWASP Item | Risk | Current Code | Gap | Fix |
|---|---|---|---|---|
| **A01:2021 Broken Access Control** | Critical | `lib/permissions/work-packages.ts` exists; route enforcement inconsistent | 32 routes use 1-arg getServerSession; many resources have no permission module | Section 5, CRITICAL #1, #2 |
| **A02:2021 Cryptographic Failures** | High | bcrypt for passwords; HTTPS assumed | No field encryption; TLS not enforced in code; HIBP not checked | Sections 4.2, 7 |
| **A03:2021 Injection** | High | Prisma parameterizes; isomorphic-dompurify in deps | LDAP injection in `client.ts`; no Zod on most inputs; no template-injection check | CRITICAL #4, Section 8 |
| **A04:2021 Insecure Design** | High | Some threat modeling done | No formal threat model; missing rate limit on auth, missing idempotency | Sections 6.1, 6.5 |
| **A05:2021 Security Misconfiguration** | Critical | None observed | No security headers; no HSTS; no CSP; default error pages may leak stack traces | CRITICAL #3, Section 16 |
| **A06:2021 Vulnerable & Outdated Components** | Medium | Unknown | No `npm audit` in CI; no Snyk/Dependabot | Section 13 |
| **A07:2021 Identification & Authentication Failures** | Critical | 2FA exists but unenforced; bcrypt with cost unknown | 2FA optional; no breach check; no session revocation; session fixation possible; admin accounts can have no MFA | Sections 4.2-4.4 |
| **A08:2021 Software & Data Integrity Failures** | Medium | Prisma migrations | Webhook payloads not signature-verified; npm install not pinned; no SRI on CDN scripts | Section 6 + SRI in CSP |
| **A09:2021 Security Logging & Monitoring Failures** | High | Sentry configured | No audit log; no security event log; no anomaly detection | Section 9 |
| **A10:2021 Server-Side Request Forgery (SSRF)** | Medium | None observed | Avatar URL fetch, webhook delivery, OIDC discovery URL — all unvalidated | Section 10.1 |

### 10.1 SSRF Defenses

Three sinks in the codebase likely:
1. **Avatar URL** — `User.avatarUrl` may be fetched (e.g., from Gravatar)
2. **Webhook delivery** — POST to a user-supplied URL
3. **OIDC discovery** — fetch `/.well-known/openid-configuration` from IdP

**Defense:**
```ts
// lib/security/safe-fetch.ts
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  '169.254.169.254',  // AWS metadata
  'metadata.google.internal',
  '10.', '172.16.', '192.168.',  // RFC 1918 (partial)
])

const BLOCKED_RANGES = [
  /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
  /^127\./, /^169\.254\./, /^fc00:/, /^fe80:/,
]

export async function safeFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol')
  }
  if (BLOCKED_HOSTS.has(parsed.hostname)) throw new Error('Blocked host')
  if (BLOCKED_RANGES.some(rx => rx.test(parsed.hostname))) throw new Error('Blocked range')

  // Resolve hostname and check IP at fetch time
  const { address } = await dnsLookup(parsed.hostname)
  if (BLOCKED_RANGES.some(rx => rx.test(address))) throw new Error('Blocked resolved IP')

  return fetch(url, { ...opts, redirect: 'manual' })
}
```

---

## 11. Compliance — GDPR & SOC 2

### 11.1 GDPR

#### 11.1.1 Data Inventory

| Data | Lawful Basis | Retention |
|---|---|---|
| User profile (name, email) | Contract | Account lifetime + 30d |
| IP address (audit log) | Legitimate interest | 90d |
| Cookies (session) | Consent (analytics) | 30d / session |
| Cookies (essential) | Legitimate interest | Session |
| Work content | Contract | Account lifetime + 30d |
| Billing data | Contract | 7y (tax) |
| Support tickets | Legitimate interest | 2y |

#### 11.1.2 Right to Access (Article 15)

```ts
// pages/api/users/me/export.ts
export default withApiAuth(async (req, res, { session }) => {
  const userData = await exportUserData(session.user.id)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="op-data-${session.user.id}.json"`)
  res.status(200).send(JSON.stringify(userData, null, 2))
})

async function exportUserData(userId: string) {
  const [user, projects, workPackages, comments, timeEntries, auditLog] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.member.findMany({ where: { userId }, include: { project: true } }),
    prisma.workPackage.findMany({ where: { OR: [{ authorId: userId }, { assigneeId: userId }] } }),
    prisma.comment.findMany({ where: { authorId: userId } }),
    prisma.timeEntry.findMany({ where: { userId } }),
    prisma.auditLog.findMany({ where: { actorId: userId } }),
  ])
  return { exportedAt: new Date().toISOString(), user, projects, workPackages, comments, timeEntries, auditLog }
}
```

Run async for large exports, email a download link valid 7 days.

#### 11.1.3 Right to Erasure (Article 17)

Two modes:
- **Soft delete** (default): `User.status = 'deleted'`, anonymize PII, retain business records
- **Hard delete** (GDPR DSAR): require email confirmation, system admin approval, 30-day grace

```ts
async function anonymizeUser(userId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${cuid()}@example.invalid`,
        name: 'Deleted User',
        avatarUrl: null,
        phone: null,
        address: null,
        status: 'deleted',
        deletedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.webAuthnCredential.deleteMany({ where: { userId } }),
  ])
}
```

#### 11.1.4 Right to Rectification (Article 16)

Standard PATCH /users/[id] — no special handling needed.

#### 11.1.5 Consent (Article 7)

- Cookie consent banner (essential vs. analytics vs. marketing)
- Marketing email opt-in (double opt-in)
- Track consent: `User.consent { analytics: boolean, marketing: boolean, acceptedAt: Date, ipAddress: String }`

#### 11.1.6 Data Processing Agreement (DPA)

For customers: a self-service DPA flow.
- Sub-processor list: AWS (hosting, KMS), Sentry (errors), Twilio (SMS), Postmark (email), Datadog (metrics).
- Published at `/legal/sub-processors`.
- 30-day notice on changes.

#### 11.1.7 Breach Notification (Article 33)

- Notify supervisory authority within **72 hours**
- Notify affected users "without undue delay" if high risk
- Internal runbook in Section 17

### 11.2 SOC 2

| Trust Service Criteria | Implementation |
|---|---|
| **CC6.1** Logical access | RBAC + ABAC, MFA for admins |
| **CC6.2** New user registration | Approval flow for org accounts |
| **CC6.3** Role changes | Audit log; dual-control for role elevation |
| **CC6.6** Network controls | TLS, WAF, rate limit |
| **CC6.7** Data classification | PII tag, encrypted at rest |
| **CC6.8** Malicious software | ClamAV on uploads, Dependabot |
| **CC7.1** Detection | Anomaly detection, Sentry alerts |
| **CC7.2** Monitoring | Uptime, error rate, security events dashboard |
| **CC7.3** Incident response | Runbook (Section 17) |
| **CC7.4** Recovery | Backups, RPO 1h, RTO 4h |
| **CC8.1** Change management | PR review, CI/CD with audit log |
| **A1.1** Availability | Multi-AZ, health checks |
| **C1.1** Confidentiality | Field encryption |
| **P1.1** Privacy | GDPR alignment |

---

## 12. Penetration Testing Checklist

### 12.1 Pre-Test (in-scope verification)

- [ ] All API routes enumerated (use `swagger.json` or static analysis)
- [ ] Auth flow tested (credentials, OAuth, 2FA)
- [ ] Staging environment mirror of production
- [ ] Test accounts: regular user, project admin, system admin, locked user
- [ ] Scope defined (URLs, excluded paths, rate of testing)

### 12.2 Test Categories

#### Authentication
- [ ] Credential stuffing (HIBP top 10k)
- [ ] Brute force (verify lockout)
- [ ] Password reset flow (token reuse, TTL, channel)
- [ ] Session fixation
- [ ] Session hijacking (cookie flags, XSS)
- [ ] MFA bypass (rate limit on TOTP, WebAuthn challenge reuse)
- [ ] OAuth flow (state parameter, redirect URI)
- [ ] SAML flow (signature validation, replay)

#### Authorization
- [ ] Horizontal privilege escalation (User A accesses User B's data)
- [ ] Vertical privilege escalation (regular user → admin)
- [ ] IDOR in work package, wiki, comment, time entry
- [ ] Project boundary violations (cross-project access)
- [ ] Custom role permission bypass
- [ ] Anonymous access to protected routes
- [ ] Permission inheritance bugs

#### Input
- [ ] SQL injection (Prisma + raw queries)
- [ ] XSS (stored, reflected, DOM-based)
- [ ] LDAP injection
- [ ] Command injection
- [ ] SSTI (server-side template injection)
- [ ] XXE (if any XML processing)
- [ ] SSRF (avatar, webhook, OIDC)
- [ ] Path traversal
- [ ] Header injection (CRLF)
- [ ] Prototype pollution
- [ ] ReDoS (regex DoS)

#### Business Logic
- [ ] Workflow bypass (status transitions)
- [ ] Race conditions (concurrent edits)
- [ ] Price/tampering (if billing)
- [ ] Negative quantities
- [ ] Self-assigning impossible roles

#### API
- [ ] Rate limit evasion
- [ ] CORS misconfiguration
- [ ] Mass assignment (e.g., `isSystemAdmin: true` in PATCH /users/[id])
- [ ] HTTP method tampering (POST-only routes accepting GET)
- [ ] Content-type confusion
- [ ] GraphQL introspection / batching attacks (if applicable)
- [ ] JWT alg confusion (none, HS256 with public key)

#### Cryptography
- [ ] TLS version / cipher scan (testssl.sh, sslyze)
- [ ] Cookie flags (HttpOnly, Secure, SameSite)
- [ ] CSRF token entropy / predictability
- [ ] Random number generation (test with known seeds)
- [ ] Hash cracking on leaked database
- [ ] JWT secret strength

#### Client
- [ ] XSS in markdown
- [ ] Open redirects
- [ ] Clickjacking (X-Frame-Options)
- [ ] DOM-based vulnerabilities
- [ ] postMessage origin checks
- [ ] Storage exposure (localStorage secrets)

#### Infrastructure
- [ ] Subdomain takeover
- [ ] Exposed admin panels
- [ ] Default credentials on services
- [ ] Outdated software versions (nmap)
- [ ] Open ports
- [ ] Information disclosure in error pages

### 12.3 Frequency

- **External pen test:** Annually + on major releases
- **Internal scans:** Weekly (Nessus, Qualys, or Snyk)
- **DAST in CI:** On every PR (OWASP ZAP)
- **SAST in CI:** On every PR (Semgrep, CodeQL)

### 12.4 Tooling Stack

| Layer | Tool |
|---|---|
| DAST | OWASP ZAP, Burp Suite Pro |
| SAST | Semgrep, Snyk Code, GitHub CodeQL |
| Dependency | Snyk Open Source, Dependabot, npm audit |
| Container | Trivy, Snyk Container |
| IaC | tfsec, checkov |
| Secrets | gitleaks, truffleHog |
| TLS | testssl.sh, sslyze |
| Cloud | ScoutSuite, Prowler (AWS) |

---

## 13. Dependency Security

### 13.1 Detection

**In CI:**
```yaml
# .github/workflows/security.yml
name: Security
on:
  pull_request:
  schedule:
    - cron: '0 6 * * *'  # daily
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
      - uses: github/codeql-action/analyze@v3
        with:
          languages: typescript
      - uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten p/javascript p/typescript
```

### 13.2 Tools

- **npm audit** — built-in, free, noisy
- **Snyk** — best-in-class, free for OSS, paid for private
- **Dependabot** — GitHub-native, auto-PRs updates
- **Renovate** — more configurable than Dependabot

### 13.3 Policy

- **Critical/High CVEs:** Block deploy. Must be patched in 24h.
- **Medium:** PR auto-created, fix in sprint.
- **Low:** Tracked, fixed opportunistically.
- **Zero-day:** Subscribe to advisories for key deps (next-auth, prisma, next).

### 13.4 Lock File Hygiene

- Commit `package-lock.json`
- Use `npm ci` in CI (deterministic)
- Verify integrity hashes (`npm install --ignore-scripts` to prevent post-install attacks; then explicitly run only known scripts)
- Pin Node.js version in `.nvmrc` AND Docker

### 13.5 Subresource Integrity (SRI)

For any CDN-loaded scripts:
```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous">
</script>
```

CSP `require-sri-for script;` enforces SRI on all scripts.

---

## 14. 15 Specific Bugs Likely in Current Code

Based on the code patterns observed and common Next.js + NextAuth v5 mistakes, here are 15 specific issues and fixes. The first 5 are CRITICAL.

### 🐛 #1 — 1-arg `getServerSession` returning null silently
**File:** 32+ routes
**Issue:** `getServerSession(authOptions)` (1-arg) is a v4 form. In v5 it should be `await auth()`. The 1-arg form may return `null` in non-pages contexts, leading to unauthenticated access.
**Fix:** `import { auth } from '@/lib/auth'; const session = await auth()`

### 🐛 #2 — `passwordHash` has no length cap
**File:** `pages/api/users/*` (registration/password set)
**Issue:** A 1MB password gets bcrypt'd — bcrypt silently truncates at 72 bytes, but the DB stores the full 1MB. DoS via large body.
**Fix:** Validate password length ≤ 128 bytes before hashing. Add a body size limit (Section 6.4).

### 🐛 #3 — LDAP filter injection
**File:** `lib/ldap/client.ts:76`
**Issue:** User-supplied `username` interpolated into LDAP filter without escaping. `*` or `()` in username = bypass.
**Fix:** RFC 4515 escape. See CRITICAL #4.

### 🐛 #4 — WebAuthn challenge not persisted
**File:** `lib/2fa/webauthn.ts:17`
**Issue:** `randomChallenge()` is generated but never stored. The `expectedChallenge` parameter at verify time is `process.env.WEBAUTHN_RP_ID ?? 'localhost'` (looking at the call site). This is broken — no user can ever complete WebAuthn.
**Fix:** Store challenge in Redis with 5-min TTL, single-use. See CRITICAL #5.

### 🐛 #5 — No security response headers
**File:** `middleware.ts`, `next.config.ts`
**Issue:** No CSP, HSTS, X-Frame-Options, etc. Clickjacking, MITM, XSS amplification all possible.
**Fix:** Add the middleware in [Section 16](#16-security-headers-middleware).

### 🐛 #6 — JWT never re-validates `isSystemAdmin`
**File:** `lib/auth.ts:117-130`
**Issue:** `isSystemAdmin` is set at login and frozen for the JWT lifetime (8h). If admin is demoted, their token still has admin powers.
**Fix:** On every `jwt` callback, re-fetch `isSystemAdmin` from DB if `trigger === 'update'` or after 30m.

### 🐛 #7 — No rate limit on `authorize()`
**File:** `lib/auth.ts:65-103`
**Issue:** Credentials provider's `authorize` is hit directly by NextAuth. No rate limit → credential stuffing.
**Fix:** Add rate-limit middleware to `/api/auth/callback/credentials` (5/15min per IP, 10/hour per email).

### 🐛 #8 — Backup codes likely stored in cleartext
**File:** `lib/2fa/backup-codes.ts` (not read yet)
**Issue:** If backup codes are stored as plaintext strings, a DB leak = account takeover.
**Fix:** Hash with bcrypt before storage; mark single-use.

### 🐛 #9 — No CSRF for non-NextAuth POST routes
**File:** All custom POST routes
**Issue:** NextAuth's CSRF token is for NextAuth's own callback. Custom POSTs (e.g., `POST /api/work-packages`) are not protected.
**Fix:** Add CSRF middleware (Section 8.5).

### 🐛 #10 — `getServerSession` is called per-request without caching
**File:** Many
**Issue:** Each API call does a DB query to fetch the user (in the `jwt` callback for re-fetching `isSystemAdmin`). At 1000 req/s = 1000 DB queries/s just for auth.
**Fix:** Cache session in Redis (5-min TTL), invalidated on user update.

### 🐛 #11 — Prisma client not disposed; connection pool exhaustion
**File:** `lib/prisma.ts` (singleton)
**Issue:** In serverless or under load, Prisma connections may leak, exhausting Postgres connection limits.
**Fix:** Configure connection pooler (PgBouncer or Prisma Data Proxy) and proper `connection_limit` in DATABASE_URL.

### 🐛 #12 — LDAP bind with user input as DN
**File:** `lib/ldap/client.ts:84`
**Issue:** `await userClient.bind(userDN, password)` where `userDN` came from search results — but if the search returns 0 entries, the code may fall through with empty `userDN` and bind anonymously.
**Fix:** Explicitly require exactly 1 search result. Reject 0 or >1.

### 🐛 #13 — Sentry DSN in env (not secret) and not scrubbed
**File:** `sentry.server.config.ts`
**Issue:** If Sentry captures user emails or session tokens, they leak to Sentry's project.
**Fix:** `beforeSend` scrubber (Section 9.4). Also: project should not have `send_default_pii: true`.

### 🐛 #14 — No file upload magic-byte validation
**File:** `pages/api/files/*` (likely)
**Issue:** MIME type is client-declared. A `.exe` renamed to `.png` is accepted.
**Fix:** Section 8.7.2.

### 🐛 #15 — `passwordHash` compared in non-constant time for migration
**File:** `lib/auth.ts:48-50`
**Issue:** `if (user.passwordMigrationRequired) return false` — this leaks whether the user is pre-migration. Timing attack reveals user existence/enumeration.
**Fix:** Always run `bcrypt.compare(input, dummyHash)` even on migration-required users (constant time). Reject after.

Bonus: **Cookie name should include `__Host-` prefix in production** for additional integrity guarantees.

---

## 15. Concrete Code Examples

### 15.1 Secure API Route Pattern

This is the canonical pattern. Every API route should match this shape.

```ts
// pages/api/work-packages/[id].ts
import { z } from 'zod'
import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { withIdempotency } from '@/lib/api/idempotency'
import { WorkPackageUpdateSchema } from '@/lib/schemas/work-package'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { recordSecurityEvent } from '@/lib/security/events'
import { rateLimit } from '@/lib/ratelimit/limiters'
import { authorizeOrThrow } from '@/lib/permissions/check'
import { sanitizeHtml } from '@/lib/sanitize'

export default withApiAuth(
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    permission: 'WORK_PACKAGE_VIEW',  // base permission; mutating ops add their own
    rateLimit: { scope: 'read', identifier: 'user' },
  },
  async (req: NextApiRequest, res: NextApiResponse, ctx) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.query)

    // Fetch resource once
    const wp = await prisma.workPackage.findUnique({
      where: { id },
      select: { id: true, projectId: true, authorId: true, status: true, subject: true, description: true },
    })
    if (!wp) return res.status(404).json({ code: 'NOT_FOUND' })

    // Authorize against the specific resource
    await authorizeOrThrow({
      user: ctx.session.user,
      action: req.method === 'GET' ? 'WORK_PACKAGE_VIEW' : req.method === 'PATCH' ? 'WORK_PACKAGE_EDIT' : 'WORK_PACKAGE_DELETE',
      resource: { type: 'work_package', id: wp.id, projectId: wp.projectId, ownerId: wp.authorId, status: wp.status },
    })

    if (req.method === 'GET') {
      return res.status(200).json(wp)
    }

    if (req.method === 'PATCH') {
      return withIdempotency(req, `wp:${id}`, async () => {
        const data = WorkPackageUpdateSchema.parse(req.body)
        const sanitized = { ...data, description: data.description && sanitizeHtml(data.description) }

        const before = wp
        const after = await prisma.workPackage.update({ where: { id }, data: sanitized })

        await audit('WORK_PACKAGE_UPDATED', {
          actorId: ctx.session.user.id,
          resourceType: 'WorkPackage',
          resourceId: id,
          projectId: wp.projectId,
          changes: { before, after },
          req,
        })

        return { status: 200, body: after }
      })
    }

    if (req.method === 'DELETE') {
      await prisma.workPackage.delete({ where: { id } })
      await audit('WORK_PACKAGE_DELETED', {
        actorId: ctx.session.user.id,
        resourceType: 'WorkPackage',
        resourceId: id,
        projectId: wp.projectId,
        req,
      })
      return res.status(204).end()
    }
  }
)
```

### 15.2 `withApiAuth` Implementation

```ts
// lib/api/with-api-auth.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/ratelimit/limiters'
import { isSystemAdmin } from '@/lib/permissions/global'
import { recordSecurityEvent } from '@/lib/security/events'
import { ForbiddenError, UnauthorizedError, MethodNotAllowedError, RateLimitedError } from '@/lib/errors'

type ApiContext = {
  session: NonNullable<Awaited<ReturnType<typeof auth>>>
  requestId: string
  user: { id: string; isSystemAdmin: boolean }
}

type Options = {
  methods: string[]
  permission?: string
  rateLimit?: { scope: keyof typeof rateLimitScopes; identifier: 'user' | 'ip' }
  requireMfa?: boolean
}

export function withApiAuth(options: Options, handler: (req: NextApiRequest, res: NextApiResponse, ctx: ApiContext) => Promise<unknown>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID()
    res.setHeader('X-Request-Id', requestId)

    // 1. Method check
    if (!options.methods.includes(req.method ?? '')) {
      res.setHeader('Allow', options.methods.join(', '))
      return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' })
    }

    // 2. Auth
    const session = await auth()
    if (!session?.user?.id) {
      await recordSecurityEvent('UNAUTHENTICATED_API_ACCESS', null, { url: req.url, method: req.method, requestId, ip: req.socket.remoteAddress })
      return res.status(401).json({ code: 'UNAUTHENTICATED' })
    }
    const user = { id: session.user.id, isSystemAdmin: await isSystemAdmin(session.user.id) }

    // 3. MFA enforcement
    if (options.requireMfa && !session.user.mfaVerified) {
      return res.status(403).json({ code: 'MFA_REQUIRED' })
    }

    // 4. Rate limit
    if (options.rateLimit) {
      const id = options.rateLimit.identifier === 'user' ? user.id : (req.headers['x-forwarded-for']?.[0] ?? req.socket.remoteAddress ?? 'unknown')
      const result = await rateLimit(options.rateLimit.scope, id)
      res.setHeader('X-RateLimit-Limit', result.limit)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', result.reset)
      if (!result.success) {
        res.setHeader('Retry-After', Math.ceil((result.reset - Date.now()) / 1000))
        return res.status(429).json({ code: 'RATE_LIMITED' })
      }
    }

    // 5. Optional permission check (resource-scoped checks are in handler)
    //    This is the global pre-check; resource-specific check uses authorizeOrThrow
    //    Implementers should add additional checks at the resource level.

    // 6. Handler
    try {
      const result = await handler(req, res, { session, user, requestId })
      // If handler returned a value, send it
      if (result !== undefined && !res.writableEnded) {
        res.status(200).json(result)
      }
    } catch (err: any) {
      if (err instanceof ForbiddenError) {
        await recordSecurityEvent('PERMISSION_DENIED', user.id, { permission: options.permission, url: req.url, requestId })
        return res.status(403).json({ code: 'FORBIDDEN', message: err.message })
      }
      if (err instanceof UnauthorizedError) {
        return res.status(401).json({ code: 'UNAUTHORIZED' })
      }
      if (err.name === 'ZodError') {
        return res.status(400).json({ code: 'VALIDATION_ERROR', issues: err.issues })
      }
      // Unexpected error
      Sentry.captureException(err, { tags: { requestId, userId: user.id, url: req.url } })
      return res.status(500).json({ code: 'INTERNAL_ERROR', requestId })
    }
  }
}
```

### 15.3 Authorization Helper

```ts
// lib/permissions/check.ts
import { prisma } from '@/lib/prisma'
import { recordSecurityEvent } from '@/lib/security/events'

export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}

interface AccessRequest {
  user: { id: string; isSystemAdmin: boolean }
  action: string
  resource?: {
    type: 'work_package' | 'wiki' | 'forum' | 'project' | 'time_entry' | 'role' | 'user'
    id?: string
    ownerId?: string
    projectId?: string
    status?: string
  }
}

export async function can(req: AccessRequest): Promise<boolean> {
  // System admin: everything
  if (req.user.isSystemAdmin) return true

  // Global permissions (admin.*) require system admin only
  if (req.action.startsWith('admin.')) return false

  // Resource-level policies
  if (req.resource?.type === 'work_package' && req.resource.projectId) {
    return checkWorkPackagePolicy(req.user.id, req.action, req.resource)
  }
  if (req.resource?.type === 'wiki' && req.resource.projectId) {
    return checkWikiPolicy(req.user.id, req.action, req.resource)
  }
  if (req.resource?.type === 'time_entry' && req.resource.ownerId) {
    return checkTimeEntryPolicy(req.user.id, req.action, req.resource)
  }
  // Fall back to membership-only check
  if (req.resource?.projectId) {
    return hasProjectPermission(req.user.id, req.resource.projectId, req.action)
  }
  return false
}

export async function authorizeOrThrow(req: AccessRequest): Promise<void> {
  if (!(await can(req))) {
    await recordSecurityEvent('PERMISSION_DENIED', req.user.id, { action: req.action, resource: req.resource })
    throw new ForbiddenError(`Missing permission: ${req.action}`)
  }
}

async function checkWorkPackagePolicy(userId: string, action: string, resource: any): Promise<boolean> {
  // Author can always edit their own (subject to status)
  if (resource.ownerId === userId && ['WORK_PACKAGE_EDIT', 'WORK_PACKAGE_COMMENT'].includes(action)) {
    return true
  }
  // Otherwise, project membership
  return hasProjectPermission(userId, resource.projectId, action)
}

async function hasProjectPermission(userId: string, projectId: string, action: string): Promise<boolean> {
  // Direct membership
  const member = await prisma.member.findFirst({
    where: { userId, projectId, principalType: 'USER' },
    include: { role: true },
  })
  if (member?.role.permissions.includes(action)) return true

  // Group membership
  const groupIds = await prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } })
  const groupMember = await prisma.member.findFirst({
    where: { projectId, principalType: 'GROUP', principal: { in: groupIds.map(g => g.groupId) } },
    include: { role: true },
  })
  if (groupMember?.role.permissions.includes(action)) return true

  // Inheritance
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { parentId: true, inheritMembers: true } })
  if (project?.parentId && project.inheritMembers) {
    return hasProjectPermission(userId, project.parentId, action)
  }
  return false
}
```

### 15.4 WebAuthn Fix (Persistent Challenge)

```ts
// lib/2fa/webauthn.ts — FIXED
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoUint8ArrayToBase64, isoBase64ToUint8Array } from '@simplewebauthn/server/helpers'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

const redis = Redis.fromEnv()

const CHALLENGE_TTL = 300  // 5 min

function randomChallenge(): string {
  return isoUint8ArrayToBase64(randomBytes(32))
}

export async function generateRegistrationOptionsForUser(user: { id: string; name: string; displayName: string }) {
  const challenge = randomChallenge()
  await redis.setex(`webauthn:challenge:${user.id}`, CHALLENGE_TTL, challenge)

  return generateRegistrationOptions({
    rpName: 'OpenProject',
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    userID: user.id,
    userName: user.name,
    userDisplayName: user.displayName,
    attestationType: 'none',
    excludeCredentials: await getUserCredentials(user.id),
    timeout: 60000,
    challenge,
  })
}

export async function generateAuthOptionsForUser(userId: string) {
  const challenge = randomChallenge()
  await redis.setex(`webauthn:challenge:${userId}`, CHALLENGE_TTL, challenge)

  const creds = await prisma.webAuthnCredential.findMany({
    where: { userId },
    select: { id: true, type: true },
  })
  return generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    allowCredentials: creds.map(c => ({ id: isoBase64ToUint8Array(c.id), type: c.type as any })),
    userVerification: 'preferred',
    timeout: 60000,
    challenge,
  })
}

export async function verifyRegistration(response: any, userId: string) {
  const challenge = await redis.getdel(`webauthn:challenge:${userId}`)
  if (!challenge) return { verified: false, error: 'Challenge expired' }
  if (Array.isArray(challenge)) challenge = challenge[0]

  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge as string,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    })
    if (result.verified && result.registrationInfo) {
      await prisma.webAuthnCredential.create({
        data: {
          id: result.registrationInfo.credentialID,
          userId,
          publicKey: Buffer.from(result.registrationInfo.credentialPublicKey),
          counter: result.registrationInfo.counter,
          type: 'public-key',
          transports: response.response.transports ?? [],
          aaguid: result.registrationInfo.aaguid,
        },
      })
    }
    return { verified: result.verified }
  } catch (err) {
    return { verified: false, error: (err as Error).message }
  }
}

export async function verifyAuthentication(response: any, userId: string) {
  const challenge = await redis.getdel(`webauthn:challenge:${userId}`)
  if (!challenge) return { verified: false, error: 'Challenge expired' }
  if (Array.isArray(challenge)) challenge = challenge[0]

  const cred = await prisma.webAuthnCredential.findUnique({ where: { id: response.id } })
  if (!cred || cred.userId !== userId) return { verified: false, error: 'Unknown credential' }

  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge as string,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      authenticator: {
        credentialID: cred.id,
        credentialPublicKey: cred.publicKey,
        counter: cred.counter,
      },
    })
    if (result.verified) {
      // Sign-count verification (cloned-key detection)
      const newCounter = result.authenticationInfo.newCounter
      if (cred.counter > 0 && newCounter <= cred.counter) {
        await recordSecurityEvent('WEBAUTHN_CLONED_KEY_SUSPECTED', userId, { credId: cred.id })
        return { verified: false, error: 'Counter did not increase' }
      }
      await prisma.webAuthnCredential.update({
        where: { id: cred.id },
        data: { counter: newCounter, lastUsedAt: new Date() },
      })
    }
    return { verified: result.verified }
  } catch (err) {
    return { verified: false, error: (err as Error).message }
  }
}
```

---

## 16. Security Headers Middleware

```ts
// middleware.ts — REPLACE existing
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// Security headers applied to all responses
function applySecurityHeaders(res: NextResponse, req: NextRequest): NextResponse {
  // 1. HSTS — 2 years, include subdomains, preload-ready
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )

  // 2. CSP — strict default, allow specific sources
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    `default-src 'self'`,
    // Next.js needs unsafe-eval in dev for HMR
    `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'nonce-{NONCE}'`,
    // Strict dynamic for production
    isDev ? '' : `'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,  // Tailwind injects styles
    `img-src 'self' data: blob: https:`,  // allow HTTPS images, gravatar, S3
    `font-src 'self' data:`,
    `connect-src 'self' https://api.openproject.com wss://*.openproject.com`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-src 'self' https://*.openproject.com`,  // allow SSO iframes
    `frame-ancestors 'none'`,  // strict — combine with X-Frame-Options
    `form-action 'self'`,
    `base-uri 'self'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    `upgrade-insecure-requests`,
    `block-all-mixed-content`,
    `report-uri /api/csp-report`,
    `report-to csp-endpoint`,
  ].filter(Boolean).join('; ')

  // For simplicity, no nonce in this example. See /api/csp-report for violation handling.
  res.headers.set('Content-Security-Policy', csp)

  // 3. Clickjacking
  res.headers.set('X-Frame-Options', 'DENY')

  // 4. MIME sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff')

  // 5. Referrer
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 6. Permissions Policy — disable powerful features
  res.headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  )

  // 7. Cross-origin isolation
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.headers.set('Cross-Origin-Resource-Policy', 'same-site')

  // 8. Remove identifying headers
  res.headers.delete('X-Powered-By')
  res.headers.delete('Server')

  return res
}

export async function middleware(req: NextRequest) {
  // Apply headers to all responses, even error pages
  const res = NextResponse.next()
  applySecurityHeaders(res, req)

  // Auth check for protected routes
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isLoggedIn = !!token
  const pathname = req.nextUrl.pathname
  const isOnProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/projects')
  const isOnAuthRoute = pathname.startsWith('/login')

  if (isOnAuthRoute && isLoggedIn) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)), req)
  }
  if (isOnProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl), req)
  }
  return res
}

export const config = {
  matcher: [
    // Run on everything except static files, _next internals, and api/auth (NextAuth handles its own)
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
```

### 16.1 CSP Violation Reporting

```ts
// pages/api/csp-report.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  // CSP report format
  const report = req.body['csp-report']
  if (report) {
    Sentry.captureMessage('CSP Violation', {
      level: 'warning',
      extra: { blockedUri: report['blocked-uri'], violatedDirective: report['violated-directive'], documentUri: report['document-uri'] },
    })
  }
  res.status(204).end()
}
```

### 16.2 next.config.ts Additions

```ts
// next.config.ts — add `headers()` function
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ]
}
```

---

## 17. Incident Response Plan

### 17.1 Severity Levels

| Sev | Definition | Examples | MTTR Target |
|---|---|---|---|
| **Sev-1** | Active breach, data exfiltration, admin compromise | DB dump, API key leak, OAuth token theft | ≤ 4h |
| **Sev-2** | Vulnerability discovered, no evidence of exploitation | Critical CVE in dep, public PoC for an unpatched issue | ≤ 24h |
| **Sev-3** | Suspicious activity, not yet confirmed | Anomaly detection alert, user report of phishing | ≤ 72h |
| **Sev-4** | Minor issue, low impact | Config drift, non-sensitive info disclosure | Next sprint |

### 17.2 On-Call Rotation

- **Primary:** Security engineer (1 week rotation)
- **Secondary:** Backend lead
- **Escalation:** CISO
- **Pager:** PagerDuty integration with Sev-1/Sev-2

### 17.3 Sev-1 Runbook (Active Breach)

#### 0-15 minutes: Detect & Triage
1. Alert fires (Sentry, anomaly detection, user report)
2. On-call acknowledges, opens #inc-<id> Slack channel
3. Page CISO, lead engineer, comms
4. Snapshot affected systems (don't restart, don't redeploy)

#### 15-60 minutes: Contain
1. **Identify vector:** review audit log, Sentry, DB query log, nginx access log
2. **Revoke compromised credentials:**
   - Rotate `NEXTAUTH_SECRET` (invalidates all JWTs)
   - Revoke leaked API keys (`UPDATE ApiKey SET revokedAt = NOW() WHERE ...`)
   - Force password reset for affected users
   - Revoke OAuth tokens (via provider's API)
3. **Block the vector:**
   - WAF rule for IP/CIDR
   - Disable vulnerable feature flag
   - Roll back deploy if needed
4. **Preserve evidence:** full DB snapshot to immutable storage (S3 Object Lock)

#### 1-4 hours: Eradicate
1. Patch the vulnerability (or take vulnerable feature offline)
2. Deploy fix
3. Verify: scan with OWASP ZAP, run smoke tests
4. Confirm no remaining attacker access (audit log review)

#### 4-24 hours: Recover
1. Restore any corrupted data from backup
2. Communicate to affected users (template in [17.4](#174-communication-templates))
3. Reset all admin passwords
4. Force MFA re-enrollment
5. Monitor for 7 days for re-entry

#### 1-7 days: Post-Incident
1. **Postmortem** within 5 business days. Blameless. Timeline, root cause, contributing factors.
2. **Action items** with owners and due dates.
3. **Update runbook** with lessons learned.
4. **Customer notification** if GDPR-triggered (within 72h to authority; "without undue delay" to users if high risk).

### 17.4 Communication Templates

#### Internal (Sev-1 alert)
```
🚨 SEV-1 INCIDENT — <short description>
Vector: <attack vector>
Impact: <scope — # of users, data types>
Status: <DETECTING|CONTAINING|ERADICATING|RECOVERING>
Lead: <name>
Channel: #inc-<id>
Bridge: <Zoom link>
Next update: <time>
```

#### Customer (data breach)
```
Subject: Important security notice for your OpenProject account

Dear <name>,

We are writing to inform you of a security incident affecting OpenProject that may
have involved your account information. We discovered the incident on <date> and
have since <containment actions>.

What happened: <plain-English description>
What information was involved: <list>
What we are doing: <list>
What you should do: <password reset link, MFA enrollment, monitor accounts>

We are sorry. We take the security of your data seriously.

<contact info>
```

#### Regulatory (GDPR Article 33)
```
To: <Supervisory Authority>
Re: Personal data breach notification (Article 33 GDPR)

1. Nature of breach: <categories and approximate numbers>
2. Categories of data subjects: <users, admins, etc.>
3. Likely consequences: <risk assessment>
4. Measures taken: <containment, mitigation>
5. DPO contact: <name, email, phone>
```

### 17.5 Tabletop Exercises

Quarterly:
- Day 1: Scenario announced (e.g., "OAuth token leak via malicious dependency")
- Day 1-2: Team responds, follows runbook
- Day 3: After-action review, gaps identified

Scenarios to rotate:
- Compromised CI/CD pipeline (npm postinstall script)
- Insider threat (malicious admin)
- Third-party breach (e.g., Sentry, Auth0 compromised)
- DDoS attack
- Ransomware (DB encrypted by attacker)

### 17.6 Pre-Breach Preparation Checklist

- [ ] Incident response plan documented and accessible offline
- [ ] On-call rotation in PagerDuty with phone tree
- [ ] Runbooks for top 10 incident types printed in office
- [ ] Communication templates pre-approved by legal
- [ ] Immutable backup storage (S3 Object Lock) configured
- [ ] Disaster recovery tested quarterly
- [ ] Cyber insurance policy reviewed annually
- [ ] External IR retainer (e.g., Mandiant, CrowdStrike) on standby
- [ ] Lawyer (privacy-specialized) on retainer
- [ ] PR/comms contact identified
- [ ] Customer support briefed on how to escalate

---

## 18. Implementation Roadmap

### Phase 1 — Critical Fixes (Week 1-2, ~20 dev-days)

- [ ] **CRITICAL #1:** Migrate 32 routes to `await auth()` (1-2 days)
- [ ] **CRITICAL #2:** Build `withApiAuth` wrapper, migrate 10 most-used routes (3-4 days)
- [ ] **CRITICAL #3:** Security headers middleware (1 day)
- [ ] **CRITICAL #4:** LDAP filter escaping (0.5 day)
- [ ] **CRITICAL #5:** Persist WebAuthn challenges (1 day)
- [ ] Add Zod validation to top 20 most-used API routes (3-4 days)
- [ ] Add `AuditLog` model and start logging auth events (2-3 days)
- [ ] Set up Snyk + Dependabot (1 day)

### Phase 2 — Hardening (Week 3-6, ~40 dev-days)

- [ ] Migrate remaining 22 API routes to `withApiAuth` (3-4 days)
- [ ] Add HIBP password check to registration and password change (1-2 days)
- [ ] Add rate limit to `authorize()` and per-endpoint tiers (2-3 days)
- [ ] Add CSRF middleware for custom POST routes (2 days)
- [ ] Build session device-tracking UI (3-4 days)
- [ ] Add `SecurityEvent` model + anomaly detection rules (3-4 days)
- [ ] Add field-level encryption for PII (User.phone, User.address) (3-4 days)
- [ ] Token storage migration: bcrypt → argon2id for new tokens (1-2 days)
- [ ] Add idempotency-key support to top 5 mutation endpoints (2-3 days)
- [ ] Implement password history (5 last passwords) (1-2 days)

### Phase 3 — Enterprise Features (Week 7-10, ~30 dev-days)

- [ ] SAML SSO (one IdP at a time) (5-7 days)
- [ ] SCIM 2.0 endpoints (5-7 days)
- [ ] MFA enforcement for admins (2-3 days)
- [ ] LDAP multiple-forest support (2-3 days)
- [ ] Additional OAuth providers (GitLab, Microsoft, Keycloak) (1-2 days per provider)
- [ ] GDPR data export and anonymization flows (3-4 days)
- [ ] Add CORS strict allowlist (1 day)

### Phase 4 — Compliance & Testing (Week 11-14, ~30 dev-days)

- [ ] SOC 2 logging and access control evidence collection (10 days)
- [ ] External penetration test (procurement + execution) (10 days)
- [ ] Fix all high/critical findings from pen test (estimate 5-10 days)
- [ ] DAST in CI (OWASP ZAP) (1-2 days)
- [ ] SAST in CI (Semgrep, CodeQL) (1-2 days)
- [ ] Run first tabletop exercise (1 day)
- [ ] Document incident response plan, on-call rotation (1 day)

### Phase 5 — Continuous Improvement (Ongoing)

- [ ] Quarterly pen tests
- [ ] Weekly dependency scans
- [ ] Monthly security review of audit log
- [ ] Quarterly tabletop exercise
- [ ] Annual SOC 2 audit
- [ ] Track OWASP Top 10 evolution (2025 release coming)

---

## Appendix A — Environment Variables Checklist

| Variable | Required | Source | Notes |
|---|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Secrets Manager | 32+ bytes random; rotate 90d |
| `NEXTAUTH_URL` | Yes | Config | Exact origin; no trailing slash |
| `DATABASE_URL` | Yes | Secrets Manager | `?sslmode=verify-full` |
| `REDIS_URL` | Yes | Secrets Manager | rediss:// for TLS |
| `SENTRY_DSN` | Yes | Config | Server, client, edge DSNs separate |
| `KMS_KEY_ID` | Yes | Config | For field encryption |
| `CSRF_SECRET` | Yes | Secrets Manager | 32+ bytes random |
| `WEBAUTHN_RP_ID` | Yes | Config | e.g., `openproject.com` |
| `GOOGLE_CLIENT_ID/SECRET` | If Google enabled | Secrets Manager | |
| `GITHUB_CLIENT_ID/SECRET` | If GitHub enabled | Secrets Manager | |
| `GITLAB_CLIENT_ID/SECRET` | If GitLab enabled | Secrets Manager | |
| `AZURE_AD_*` | If Microsoft enabled | Secrets Manager | |
| `KEYCLOAK_*` | If Keycloak enabled | Secrets Manager | |
| `TWILIO_*` | If SMS 2FA enabled | Secrets Manager | |
| `SMTP_*` | Yes | Secrets Manager | STARTTLS required |
| `S3_*` | Yes | Secrets Manager | Per-environment bucket |
| `HIBP_API_KEY` | Optional | Config | For higher rate limits |
| `CORS_ALLOWED_ORIGINS` | Yes | Config | Comma-separated |
| `BODY_SIZE_LIMIT_DEFAULT` | Optional | Config | Default 1MB |
| `SESSION_MAX_AGE_SECONDS` | Optional | Config | Default 28800 (8h) |
| `RATE_LIMIT_*` | Optional | Config | Per-tier overrides |

## Appendix B — Pre-Deployment Security Gate

A deployment must pass:

- [ ] All `withApiAuth` migrated routes: unit tests pass
- [ ] `npm audit` shows no high/critical
- [ ] Snyk scan shows no high/critical
- [ ] OWASP ZAP baseline scan shows no high findings
- [ ] Semgrep/CodeQL scan: no high findings
- [ ] All secrets in Secrets Manager (none in env files)
- [ ] CSP, HSTS, X-Frame-Options verified in headers
- [ ] Backup verified (can restore from last night's snapshot)
- [ ] Sentry error rate < 0.1%
- [ ] All 5 CRITICAL fixes verified
- [ ] Pen test (if last test > 6 months ago)

---

**End of Security & Authentication Overhaul Document**

This document, combined with the other 9 expert deliverables in `revamp-v2/design/`, forms the complete security posture for the OpenProject Rewrite. The CRITICAL fixes in Section 3 are the immediate next steps; the rest is roadmap.
