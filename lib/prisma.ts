import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPool(connectionString: string): Pool {
  // DB-11: bound the pool to avoid exhausting Postgres connection limits
  // under serverless cold-start load. Defaults are conservative; tune via env.
  return new Pool({
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT_MS ?? '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECT_TIMEOUT_MS ?? '5000', 10),
  })
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // DB-11: cache the pg.Pool globally so serverless cold starts reuse the pool
  // instead of opening a new one every invocation. Also bounds the pool size
  // and timeouts so we don't exhaust Postgres connection limits under load.
  const pool = globalForPrisma.pool ?? createPool(connectionString)
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pool = pool
  }
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
