import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      passwordMigrationRequired: boolean
      isSystemAdmin: boolean
    } & DefaultSession['user']
  }
}
