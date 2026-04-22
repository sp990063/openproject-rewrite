import NextAuth, { type DefaultSession } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

// Extend NextAuth types to include user.id, isSystemAdmin, passwordMigrationRequired in session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      isSystemAdmin: boolean
      passwordMigrationRequired: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth' {
  interface JWT {
    id: string
    isSystemAdmin?: boolean
    passwordMigrationRequired?: boolean
  }
}

// ⚠️ L2 FIX: System admin check — used by Phase 3 GDPR hard-delete endpoint
// Checks if user has the isSystemAdmin flag set on their User record.
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  });
  return user?.isSystemAdmin ?? false;
}

// ⚠️ S2 FIX: Validate password with migration support
// Detects pre-migration accounts and rejects login until password is reset.
// migrated users have scrypt hashes — bcrypt.compare would fail, so we short-circuit
async function validatePassword(inputPassword: string, user: {
  passwordHash: string;
  passwordMigrationRequired: boolean;
}): Promise<boolean> {
  if (user.passwordMigrationRequired) {
    // Old migrated user — must reset password first (scrypt hash can't be verified with bcrypt)
    return false;
  }
  return bcrypt.compare(inputPassword, user.passwordHash);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // ⚠️ S2 FIX: migrated users must reset password before they can login
        if (user.passwordMigrationRequired) {
          // Don't reveal whether the account exists
          return null
        }

        const isValid = await validatePassword(credentials.password as string, user);

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // ⚠️ L2/S2 FIX: persist admin + migration flags to token so API routes can read without extra DB query
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
        if (dbUser) {
          token.passwordMigrationRequired = dbUser.passwordMigrationRequired
          token.isSystemAdmin = dbUser.isSystemAdmin
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // Cast through unknown to satisfy strict TS (next-auth session user type doesn't include custom fields)
        const t = token as unknown as { isSystemAdmin?: boolean; passwordMigrationRequired?: boolean }
        session.user.isSystemAdmin = !!t.isSystemAdmin
        session.user.passwordMigrationRequired = !!t.passwordMigrationRequired
      }
      return session
    },
  },
})
